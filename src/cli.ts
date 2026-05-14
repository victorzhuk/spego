#!/usr/bin/env node
import { Command } from 'commander';
import fs from 'node:fs/promises';
import { initWorkspace, workspaceStatus } from './workspace/init.js';
import { ArtifactEngine } from './artifacts/engine.js';
import { viewArtifacts } from './export/view.js';
import path from 'node:path';
import { renderArtifactFile } from './artifacts/storage.js';
import { SpegoError } from './errors.js';
import { COMMAND_REGISTRY } from './commands/registry.js';
import type { CommandMeta } from './commands/registry.js';
import { WORKFLOW_REGISTRY } from './workflows/registry.js';
import { generateAll } from './generator/index.js';
import { resolveWorkspacePaths } from './workspace/paths.js';
import { readConfig } from './workspace/config.js';
import { resolveAdapter } from './delivery/index.js';
import type { DeliveryEpicLink, DeliveryTaskSummary } from './delivery/index.js';
import { renderBox, renderTable, renderHeader, renderDivider } from './cli/render.js';
import pkg from '../package.json' with { type: 'json' };

// ---------- output helpers ----------

function emitJson(payload: unknown): void {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

function emitHuman(text: string): void {
  process.stdout.write(text.endsWith('\n') ? text : `${text}\n`);
}

function output(json: boolean, payload: unknown, human: () => string): void {
  if (json) {
    emitJson(payload);
  } else {
    emitHuman(human());
  }
}

function deprecate(json: boolean, message: string): void {
  if (!json) {
    process.stderr.write(`deprecated: ${message}\n`);
  }
}

async function readBodyOption(opts: {
  body?: string;
  bodyFile?: string;
}): Promise<string | undefined> {
  if (opts.bodyFile) return fs.readFile(opts.bodyFile, 'utf8');
  return opts.body;
}

// ---------- per-domain renderers ----------

function renderEpicRow(epic: DeliveryEpicLink): string[] {
  const progress = epic.taskCount != null ? `${epic.tasksDone ?? 0}/${epic.taskCount}` : '—';
  return [epic.externalId, epic.status, progress, epic.title];
}

function renderTaskRow(task: DeliveryTaskSummary): string[] {
  return [task.status === 'done' ? '[x]' : '[ ]', task.title];
}

function renderArtifactHeader(fm: { type: string; slug: string; revision: number; id: string }): string {
  return `📄 ${fm.type}/${fm.slug}  rev ${fm.revision}  (${fm.id})`;
}

/**
 * Insert `─` dividers between consecutive artifact sections in a markdown
 * bundle. We mark a section by `## ` at the start of a line; the first
 * occurrence is preserved as-is, every subsequent occurrence is prefixed
 * with `\n<divider>\n\n`.
 */
function intersperseBundleDividers(markdown: string): string {
  const lines = markdown.split('\n');
  const out: string[] = [];
  let seenFirstSection = false;
  const divider = renderDivider();
  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (seenFirstSection) {
        out.push('', divider, '');
      }
      seenFirstSection = true;
    }
    out.push(line);
  }
  return out.join('\n');
}

function renderCommandsHuman(): string {
  const order: Array<CommandMeta['category']> = ['workspace', 'artifact', 'view', 'planning'];
  const titles: Record<CommandMeta['category'], string> = {
    workspace: 'Workspace',
    artifact: 'Artifacts',
    view: 'View',
    planning: 'Planning',
  };
  const sections = order
    .map((cat) => {
      const items = COMMAND_REGISTRY.filter((c) => c.category === cat);
      if (items.length === 0) return '';
      const table = renderTable(['name', 'description'], items.map((c) => [c.name, c.description]));
      return `${titles[cat]}\n${table}`;
    })
    .filter((s) => s.length > 0);
  return [renderHeader('🛠️', 'Commands'), '', sections.join('\n\n')].join('\n');
}

function renderWorkflowsHuman(): string {
  const rows = WORKFLOW_REGISTRY.map((w) => [w.name, String(w.phases.length), w.description]);
  const table = renderTable(['name', 'phases', 'description'], rows, { maxWidth: 80 });
  return [renderHeader('🧭', 'Workflows'), '', table].join('\n');
}

// ---------- error rendering ----------

function fail(err: unknown, json: boolean): never {
  if (err instanceof SpegoError) {
    if (json) {
      process.stderr.write(`${JSON.stringify({ error: err.toJSON() }, null, 2)}\n`);
    } else {
      process.stderr.write(`⚠️  [${err.code}] ${err.message}\n`);
    }
    process.exit(2);
  }
  if (json) {
    process.stderr.write(
      `${JSON.stringify({ error: { code: 'INTERNAL', message: (err as Error).message } }, null, 2)}\n`,
    );
  } else {
    process.stderr.write(`⚠️  [INTERNAL] ${(err as Error).message}\n`);
  }
  process.exit(1);
}

export function buildProgram(): Command {
  const program = new Command();
  program
    .name('spego')
    .description('Agent-first product orchestration: artifact engine')
    .option('--json', 'emit JSON output (deterministic, decoration-free)', false)
    .version(pkg.version);

  program.configureOutput({
    writeErr: (str: string) => {
      const json = program.opts().json as boolean;
      if (!json) {
        process.stderr.write(str);
      }
    },
  });

  program.exitOverride((err) => {
    const json = program.opts().json as boolean;
    if (json) {
      process.stderr.write(
        `${JSON.stringify({ error: { code: 'VALIDATION_FAILED', message: err.message } }, null, 2)}\n`,
      );
    } else {
      process.stderr.write(`⚠️  [VALIDATION_FAILED] ${err.message}\n`);
    }
    process.exit(2);
  });

  // ---------- meta: commands ----------
  program
    .command('commands')
    .description('List available spego commands with metadata')
    .action(() => {
      const json = program.opts().json as boolean;
      output(json, COMMAND_REGISTRY, renderCommandsHuman);
    });

  // ---------- meta: workflows ----------
  program
    .command('workflows')
    .description('List available workflow skills')
    .action(() => {
      const json = program.opts().json as boolean;
      const entries = WORKFLOW_REGISTRY.map((w) => ({
        name: w.name,
        description: w.description,
        personas: w.personas,
        phases: w.phases,
        inputs: w.inputs,
        outputs: w.outputs,
      }));
      output(json, entries, renderWorkflowsHuman);
    });

  // ---------- init ----------
  program
    .command('init')
    .description('Initialize a .spego/ workspace in the current project')
    .option('--agents <list>', 'comma-separated list of agent toolchains', 'claude')
    .option('--demo <bool>', 'seed demo artifacts (true|false)', 'false')
    .option('--force', 'overwrite config (does not delete artifacts)', false)
    .option('--cwd <dir>', 'project root (defaults to current directory)')
    .action(async (opts) => {
      const json = program.opts().json as boolean;
      try {
        const summary = await initWorkspace({
          projectRoot: opts.cwd,
          agents: String(opts.agents).split(',').map((s) => s.trim()).filter(Boolean),
          demo: opts.demo === 'true',
          force: opts.force,
        });
        output(json, summary, () => {
          const headerLabel = summary.alreadyInitialized
            ? 'Workspace already initialized'
            : 'Initialized spego workspace';
          const box = renderBox('Workspace', [
            ['root', summary.workspaceRoot],
            ['config', summary.configPath],
            ['artifacts', summary.artifactsRoot],
            ['index', summary.indexPath],
            ['agents', summary.config.agents.join(', ')],
          ]);
          return `${renderHeader('📦', headerLabel)}\n${box}`;
        });
      } catch (err) {
        fail(err, json);
      }
    });

  // ---------- status ----------
  program
    .command('status')
    .description('Report workspace status')
    .option('--cwd <dir>', 'project root')
    .action(async (opts) => {
      const json = program.opts().json as boolean;
      try {
        const status = await workspaceStatus(opts.cwd);
        output(json, status, () => {
          if (!status.initialized) {
            return `No spego workspace; run: spego init`;
          }
          const box = renderBox('Workspace status', [
            ['root', status.workspaceRoot ?? ''],
            ['agents', status.agents?.join(', ') ?? '(none)'],
            ['artifacts', status.artifactsRoot ?? ''],
            ['index', status.indexPath ?? ''],
          ]);
          return `${renderHeader('📦', 'Workspace ready')}\n${box}`;
        });
      } catch (err) {
        fail(err, json);
      }
    });

  // ---------- create ----------
  program
    .command('create')
    .description('Create an artifact')
    .requiredOption('--type <type>', 'artifact type, e.g. prd|api|architecture')
    .requiredOption('--title <title>', 'artifact title')
    .option('--slug <slug>', 'optional explicit slug')
    .option('--body <text>', 'inline markdown body')
    .option('--body-file <path>', 'read markdown body from a file (use - for stdin)')
    .option('--meta <json>', 'JSON object of metadata', '{}')
    .option('--cwd <dir>', 'project root')
    .action(async (opts) => {
      const json = program.opts().json as boolean;
      const engine = await ArtifactEngine.open({ projectRoot: opts.cwd }).catch((err) =>
        fail(err, json),
      );
      try {
        const body =
          opts.bodyFile === '-'
            ? await new Promise<string>((resolve, reject) => {
                let buf = '';
                process.stdin.setEncoding('utf8');
                process.stdin.on('data', (chunk) => (buf += chunk));
                process.stdin.on('end', () => resolve(buf));
                process.stdin.on('error', reject);
              })
            : (await readBodyOption(opts)) ?? '';
        const meta = JSON.parse(opts.meta);
        const record = await engine.create({
          type: opts.type,
          title: opts.title,
          slug: opts.slug,
          body,
          meta,
        });
        output(
          json,
          {
            id: record.frontmatter.id,
            type: record.frontmatter.type,
            slug: record.frontmatter.slug,
            revision: record.frontmatter.revision,
            path: record.path,
            markdown: renderArtifactFile(record.frontmatter, record.body),
          },
          () =>
            `✨ Created ${record.frontmatter.type}/${record.frontmatter.slug}  rev ${record.frontmatter.revision}\n   path: ${record.path}`,
        );
      } catch (err) {
        fail(err, json);
      } finally {
        engine.close();
      }
    });

  // ---------- read ----------
  program
    .command('read')
    .description('Read an artifact by id or type+slug')
    .option('--id <id>', 'artifact id')
    .option('--type <type>', 'artifact type (with --slug)')
    .option('--slug <slug>', 'artifact slug (with --type)')
    .option('--path <path>', 'read artifact by absolute file path')
    .option('--revision <n>', 'specific revision number')
    .option('--cwd <dir>', 'project root')
    .action(async (opts) => {
      const json = program.opts().json as boolean;
      const engine = await ArtifactEngine.open({ projectRoot: opts.cwd }).catch((err) =>
        fail(err, json),
      );
      try {
        let record;
        if (opts.id) {
          record =
            opts.revision !== undefined
              ? await engine.readRevision(opts.id, Number(opts.revision))
              : await engine.readById(opts.id);
        } else if (opts.type && opts.slug) {
          record = await engine.readByTypeSlug(opts.type, opts.slug);
        } else if (opts.path) {
          record = await engine.readByPath(path.resolve(opts.path));
        } else {
          throw new SpegoError('VALIDATION_FAILED', 'Provide --id, --type and --slug, or --path');
        }
        output(
          json,
          { frontmatter: record.frontmatter, body: record.body, path: record.path },
          () => `${renderArtifactHeader(record.frontmatter)}\n${renderDivider()}\n${record.body}`,
        );
      } catch (err) {
        fail(err, json);
      } finally {
        engine.close();
      }
    });

  // ---------- update ----------
  program
    .command('update')
    .description('Update an artifact (requires id)')
    .requiredOption('--id <id>', 'artifact id')
    .option('--title <title>', 'new title')
    .option('--body <text>', 'new markdown body')
    .option('--body-file <path>', 'read body from file')
    .option('--meta <json>', 'replace metadata (JSON object)')
    .option('--expected-revision <n>', 'expected current revision (optimistic concurrency)')
    .option('--cwd <dir>', 'project root')
    .action(async (opts) => {
      const json = program.opts().json as boolean;
      const engine = await ArtifactEngine.open({ projectRoot: opts.cwd }).catch((err) =>
        fail(err, json),
      );
      try {
        const body = await readBodyOption(opts);
        const patch: Record<string, unknown> = {};
        if (opts.title !== undefined) patch.title = opts.title;
        if (body !== undefined) patch.body = body;
        if (opts.meta !== undefined) patch.meta = JSON.parse(opts.meta);
        if (opts.expectedRevision !== undefined)
          patch.expectedRevision = Number(opts.expectedRevision);
        const record = await engine.update(opts.id, patch);
        output(
          json,
          { id: record.frontmatter.id, revision: record.frontmatter.revision, path: record.path },
          () => `${renderArtifactHeader(record.frontmatter)}\n${renderDivider()}\n${record.body}`,
        );
      } catch (err) {
        fail(err, json);
      } finally {
        engine.close();
      }
    });

  // ---------- delete ----------
  program
    .command('delete')
    .description('Soft-delete an artifact')
    .requiredOption('--id <id>', 'artifact id')
    .option('--cwd <dir>', 'project root')
    .action(async (opts) => {
      const json = program.opts().json as boolean;
      const engine = await ArtifactEngine.open({ projectRoot: opts.cwd }).catch((err) =>
        fail(err, json),
      );
      try {
        const record = await engine.softDelete(opts.id);
        output(
          json,
          {
            id: record.frontmatter.id,
            deletedAt: record.frontmatter.deletedAt,
            revision: record.frontmatter.revision,
          },
          () => `🗑  Deleted ${record.frontmatter.id} at ${record.frontmatter.deletedAt}`,
        );
      } catch (err) {
        fail(err, json);
      } finally {
        engine.close();
      }
    });

  // ---------- list ----------
  program
    .command('list')
    .description('List artifacts')
    .option('--type <type>', 'filter by type')
    .option('--include-deleted', 'include soft-deleted artifacts', false)
    .option('--cwd <dir>', 'project root')
    .action(async (opts) => {
      const json = program.opts().json as boolean;
      const engine = await ArtifactEngine.open({ projectRoot: opts.cwd }).catch((err) =>
        fail(err, json),
      );
      try {
        const items = engine.list({ type: opts.type, includeDeleted: opts.includeDeleted });
        output(json, items, () => {
          if (items.length === 0) return 'No artifacts.';
          const rows = items.map((a) => [
            `${a.type}/${a.slug}`,
            String(a.revision),
            a.deletedAt ? 'deleted' : 'active',
            a.title,
            a.id,
          ]);
          const table = renderTable(['type/slug', 'rev', 'status', 'title', 'id'], rows);
          return `${renderHeader('📦', 'Artifacts')}\n${table}`;
        });
      } catch (err) {
        fail(err, json);
      } finally {
        engine.close();
      }
    });

  // ---------- view ----------
  program
    .command('view')
    .description('Export artifact bundle as markdown (default) or JSON via --json')
    .option('--type <type>', 'filter by type')
    .option('--id <id>', 'limit to a single artifact')
    .option('--revision <n>', 'specific revision (requires --id)')
    .option('--include-deleted', 'include soft-deleted artifacts', false)
    .option('--format <fmt>', '[deprecated] markdown | json — use the global --json flag instead')
    .option('--cwd <dir>', 'project root')
    .action(async (opts) => {
      const globalJson = program.opts().json as boolean;
      // Deprecation: --format is still honored but warns in human mode.
      if (opts.format !== undefined) {
        deprecate(globalJson, "--format is deprecated; use the global --json flag");
      }
      const wantJson = globalJson || opts.format === 'json';
      const engine = await ArtifactEngine.open({ projectRoot: opts.cwd }).catch((err) =>
        fail(err, wantJson),
      );
      try {
        const view = await viewArtifacts(engine, {
          type: opts.type,
          id: opts.id,
          revision: opts.revision !== undefined ? Number(opts.revision) : undefined,
          includeDeleted: opts.includeDeleted,
        });
        if (wantJson) {
          emitJson(view.json);
        } else {
          const body = intersperseBundleDividers(view.markdown.content);
          process.stdout.write(`${renderHeader('📦', 'Artifact bundle')}\n${body}`);
        }
      } catch (err) {
        fail(err, wantJson);
      } finally {
        engine.close();
      }
    });

  // ---------- index rebuild ----------
  const indexCmd = program.command('index').description('Index maintenance');

  // ---------- skills ----------
  async function runSkillsCommand(json: boolean, cwd?: string): Promise<void> {
    const projectRoot = path.resolve(cwd ?? process.cwd());
    const wsPaths = resolveWorkspacePaths(projectRoot);
    const config = await readConfig(wsPaths.configPath);
    const reports = await generateAll(projectRoot, config.agents);
    output(json, reports, () => {
      const lines: string[] = [renderHeader('🛠️', 'Skill regeneration'), ''];
      for (const r of reports) {
        lines.push(`[${r.target}]`);
        for (const f of r.files) {
          lines.push(`  ${f.action}  ${f.path}`);
        }
      }
      return lines.join('\n');
    });
  }

  program
    .command('skills')
    .description('Regenerate agent skill and command files')
    .option('--cwd <dir>', 'project root')
    .action(async (opts) => {
      const json = program.opts().json as boolean;
      try {
        await runSkillsCommand(json, opts.cwd);
      } catch (err) {
        fail(err, json);
      }
    });

  program
    .command('regenerate', { hidden: true })
    .description('Regenerate agent skill and command files')
    .option('--cwd <dir>', 'project root')
    .action(async (opts) => {
      const json = program.opts().json as boolean;
      deprecate(json, "'spego regenerate' is now 'spego skills'");
      try {
        await runSkillsCommand(json, opts.cwd);
      } catch (err) {
        fail(err, json);
      }
    });
  // ---------- epics ----------
  program
    .command('epics')
    .description('List epics or get a single epic')
    .argument('[action]', 'list (default) or get')
    .option('--change <name>', 'get a single epic by name')
    .option('--cwd <dir>', 'project root')
    .action(async (action, opts) => {
      const json = program.opts().json as boolean;
      try {
        if (action && !['list', 'get'].includes(action)) {
          throw new SpegoError(
            'DELIVERY_READ_ONLY',
            `Cannot '${action}' delivery epics through spego. Use the OpenSpec CLI for delivery mutations.`,
            { attemptedAction: action, suggestedTool: 'openspec' },
          );
        }
        const projectRoot = path.resolve(opts.cwd ?? process.cwd());
        const wsPaths = resolveWorkspacePaths(projectRoot);
        const config = await readConfig(wsPaths.configPath);
        const adapter = resolveAdapter(projectRoot, config);

        if (opts.change) {
          const epic = await adapter.getEpic(opts.change);
          output(json, epic, () => {
            const table = renderTable(['id', 'status', 'progress', 'title'], [renderEpicRow(epic)]);
            return `${renderHeader('📚', `Epic (${adapter.name})`)}\n${table}`;
          });
        } else {
          const epics = await adapter.listEpics();
          output(json, epics, () => {
            if (epics.length === 0) return 'No epics.';
            const table = renderTable(
              ['id', 'status', 'progress', 'title'],
              epics.map(renderEpicRow),
            );
            return `${renderHeader('📚', `Epics (${adapter.name})`)}\n${table}`;
          });
        }
      } catch (err) {
        fail(err, json);
      }
    });

  // ---------- tasks ----------
  program
    .command('tasks')
    .description('List tasks for a change or get a single task')
    .argument('[action]', 'list (default) or get')
    .requiredOption('--change <name>', 'the epic/change name')
    .option('--task <id>', 'get a single task by id')
    .option('--cwd <dir>', 'project root')
    .action(async (action, opts) => {
      const json = program.opts().json as boolean;
      try {
        if (action && !['list', 'get'].includes(action)) {
          throw new SpegoError(
            'DELIVERY_READ_ONLY',
            `Cannot '${action}' delivery tasks through spego. Use the OpenSpec CLI for delivery mutations.`,
            { attemptedAction: action, suggestedTool: 'openspec' },
          );
        }
        const projectRoot = path.resolve(opts.cwd ?? process.cwd());
        const wsPaths = resolveWorkspacePaths(projectRoot);
        const config = await readConfig(wsPaths.configPath);
        const adapter = resolveAdapter(projectRoot, config);

        if (opts.task) {
          const task = await adapter.getTask(opts.change, opts.task);
          output(json, task, () => {
            const table = renderTable(['done', 'title'], [renderTaskRow(task)]);
            return `${renderHeader('✅', `Task: ${opts.change} (${adapter.name})`)}\n${table}`;
          });
        } else {
          const tasks = await adapter.listTasks(opts.change);
          output(json, tasks, () => {
            if (tasks.length === 0) return `No tasks for ${opts.change}.`;
            const table = renderTable(['done', 'title'], tasks.map(renderTaskRow));
            return `${renderHeader('✅', `Tasks: ${opts.change} (${adapter.name})`)}\n${table}`;
          });
        }
      } catch (err) {
        fail(err, json);
      }
    });

  indexCmd
    .command('rebuild')
    .description('Rebuild the SQLite index from markdown files')
    .option('--cwd <dir>', 'project root')
    .action(async (opts) => {
      const json = program.opts().json as boolean;
      const engine = await ArtifactEngine.open({ projectRoot: opts.cwd }).catch((err) =>
        fail(err, json),
      );
      try {
        const report = await engine.rebuildIndex();
        output(json, report, () => {
          const summary = renderBox('Index rebuild', [
            ['scanned', String(report.scannedFiles)],
            ['indexed', String(report.indexedArtifacts)],
            ['invalid', String(report.invalidFiles.length)],
          ]);
          if (report.invalidFiles.length === 0) return summary;
          const table = renderTable(
            ['path', 'error'],
            report.invalidFiles.map((i) => [i.path, i.error]),
            { maxWidth: 80 },
          );
          return `${summary}\n\nInvalid files:\n${table}`;
        });
      } catch (err) {
        fail(err, json);
      } finally {
        engine.close();
      }
    });

  return program;
}

const program = buildProgram();
program.parseAsync(process.argv).catch((err) => {
  fail(err, program.opts().json as boolean);
});
