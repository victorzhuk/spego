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
import { generateAll } from './generator/index.js';
import { resolveWorkspacePaths } from './workspace/paths.js';
import { readConfig } from './workspace/config.js';
import { resolveAdapter } from './delivery/index.js';
import type { DeliveryEpicLink, DeliveryTaskSummary } from './delivery/index.js';
import pkg from '../package.json' with { type: 'json' };

function output(json: boolean, payload: unknown, human?: () => string): void {
  if (json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } else if (human) {
    process.stdout.write(`${human()}\n`);
  } else {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  }
}

async function readBodyOption(opts: {
  body?: string;
  bodyFile?: string;
}): Promise<string | undefined> {
  if (opts.bodyFile) return fs.readFile(opts.bodyFile, 'utf8');
  return opts.body;
}

function renderEpic(epic: DeliveryEpicLink): string {
  const progress = epic.taskCount != null ? ` (${epic.tasksDone ?? 0}/${epic.taskCount} tasks)` : '';
  return `- **${epic.externalId}** [${epic.status}]${progress}\n  title: ${epic.title}\n  source: ${epic.sourcePath}`;
}

function renderTask(task: DeliveryTaskSummary): string {
  const check = task.status === 'done' ? 'x' : ' ';
  return `- [${check}] ${task.title}`;
}

function fail(err: unknown, json: boolean): never {
  if (err instanceof SpegoError) {
    if (json) {
      process.stderr.write(`${JSON.stringify({ error: err.toJSON() }, null, 2)}\n`);
    } else {
      process.stderr.write(`error: [${err.code}] ${err.message}\n`);
    }
    process.exit(2);
  }
  if (json) {
    process.stderr.write(
      `${JSON.stringify({ error: { code: 'INTERNAL', message: (err as Error).message } }, null, 2)}\n`,
    );
  } else {
    process.stderr.write(`error: ${(err as Error).message}\n`);
  }
  process.exit(1);
}

export function buildProgram(): Command {
  const program = new Command();
  program
    .name('spego')
    .description('Agent-first product orchestration: artifact engine')
    .option('--json', 'emit JSON output', false)
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
    }
    process.exit(2);
  });

  program
    .command('commands')
    .description('List available spego commands with metadata (JSON)')
    .action(() => {
      process.stdout.write(JSON.stringify(COMMAND_REGISTRY, null, 2) + '\n');
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
        output(json, summary, () =>
          [
            summary.alreadyInitialized
              ? `Workspace already initialized at ${summary.workspaceRoot}`
              : `Initialized spego workspace at ${summary.workspaceRoot}`,
            `  config:    ${summary.configPath}`,
            `  artifacts: ${summary.artifactsRoot}`,
            `  index:     ${summary.indexPath}`,
            `  agents:    ${summary.config.agents.join(', ')}`,
          ].join('\n'),
        );
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
        output(json, status, () =>
          status.initialized
            ? `Workspace ready at ${status.workspaceRoot}\n  agents: ${status.agents?.join(', ') ?? '(none)'}`
            : `No spego workspace found in ${status.projectRoot}.\nRun: ${status.initCommand}`,
        );
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
        output(json, {
          id: record.frontmatter.id,
          type: record.frontmatter.type,
          slug: record.frontmatter.slug,
          revision: record.frontmatter.revision,
          path: record.path,
          markdown: renderArtifactFile(record.frontmatter, record.body),
        }, () => `Created ${record.frontmatter.type}/${record.frontmatter.slug} (${record.frontmatter.id})\n  path: ${record.path}`);
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
          record = opts.revision !== undefined
            ? await engine.readRevision(opts.id, Number(opts.revision))
            : await engine.readById(opts.id);
        } else if (opts.type && opts.slug) {
          record = await engine.readByTypeSlug(opts.type, opts.slug);
        } else if (opts.path) {
          record = await engine.readByPath(path.resolve(opts.path));
        } else {
          throw new SpegoError('VALIDATION_FAILED', 'Provide --id, --type and --slug, or --path');
        }
        output(json, {
          frontmatter: record.frontmatter,
          body: record.body,
          path: record.path,
        }, () => `# ${record.frontmatter.title}\n\n${record.body}`);
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
        output(json, {
          id: record.frontmatter.id,
          revision: record.frontmatter.revision,
          path: record.path,
        }, () => `# ${record.frontmatter.title}\n\n${record.body}`);
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
        output(json, {
          id: record.frontmatter.id,
          deletedAt: record.frontmatter.deletedAt,
          revision: record.frontmatter.revision,
        }, () => `Deleted ${record.frontmatter.id} at ${record.frontmatter.deletedAt}`);
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
        output(json, items, () =>
          items.length === 0
            ? 'No artifacts.'
            : items
                .map(
                  (a) =>
                    `${a.type}/${a.slug}  rev ${a.revision}  ${a.deletedAt ? '[deleted] ' : ''}${a.title}  (${a.id})`,
                )
                .join('\n'),
        );
      } catch (err) {
        fail(err, json);
      } finally {
        engine.close();
      }
    });

  // ---------- view ----------
  program
    .command('view')
    .description('Export artifact bundle as markdown (default) or JSON')
    .option('--type <type>', 'filter by type')
    .option('--id <id>', 'limit to a single artifact')
    .option('--revision <n>', 'specific revision (requires --id)')
    .option('--include-deleted', 'include soft-deleted artifacts', false)
    .option('--format <fmt>', 'markdown | json', 'markdown')
    .option('--cwd <dir>', 'project root')
    .action(async (opts) => {
      const json = program.opts().json as boolean || opts.format === 'json';
      const engine = await ArtifactEngine.open({ projectRoot: opts.cwd }).catch((err) =>
        fail(err, json),
      );
      try {
        const view = await viewArtifacts(engine, {
          type: opts.type,
          id: opts.id,
          revision: opts.revision !== undefined ? Number(opts.revision) : undefined,
          includeDeleted: opts.includeDeleted,
        });
        if (opts.format === 'json' || program.opts().json) {
          process.stdout.write(`${JSON.stringify(view.json, null, 2)}\n`);
        } else {
          process.stdout.write(view.markdown.content);
        }
      } catch (err) {
        fail(err, json);
      } finally {
        engine.close();
      }
    });

  // ---------- index rebuild ----------
  const indexCmd = program.command('index').description('Index maintenance');

  // ---------- regenerate ----------
  program
    .command('regenerate')
    .description('Regenerate agent skill and command files')
    .option('--cwd <dir>', 'project root')
    .action(async (opts) => {
      const json = program.opts().json as boolean;
      try {
        const projectRoot = path.resolve(opts.cwd ?? process.cwd());
        const wsPaths = resolveWorkspacePaths(projectRoot);
        const config = await readConfig(wsPaths.configPath);
        const reports = await generateAll(projectRoot, config.agents);
        output(json, reports, () =>
          reports
            .flatMap((r) => r.files.map((f) => `[${r.target}] ${f.action}: ${f.path}`))
            .join('\n'),
        );
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
          throw new SpegoError('DELIVERY_READ_ONLY',
            `Cannot '${action}' delivery epics through spego. Use the OpenSpec CLI for delivery mutations.`,
            { attemptedAction: action, suggestedTool: 'openspec' });
        }
        const projectRoot = path.resolve(opts.cwd ?? process.cwd());
        const wsPaths = resolveWorkspacePaths(projectRoot);
        const config = await readConfig(wsPaths.configPath);
        const adapter = resolveAdapter(projectRoot, config);

        if (opts.change) {
          const epic = await adapter.getEpic(opts.change);
          output(json, epic, () => renderEpic(epic));
        } else {
          const epics = await adapter.listEpics();
          output(json, epics, () =>
            epics.length === 0
              ? 'No epics.'
              : `## Epics (${adapter.name})\n\n` + epics.map(renderEpic).join('\n\n'),
          );
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
          throw new SpegoError('DELIVERY_READ_ONLY',
            `Cannot '${action}' delivery tasks through spego. Use the OpenSpec CLI for delivery mutations.`,
            { attemptedAction: action, suggestedTool: 'openspec' });
        }
        const projectRoot = path.resolve(opts.cwd ?? process.cwd());
        const wsPaths = resolveWorkspacePaths(projectRoot);
        const config = await readConfig(wsPaths.configPath);
        const adapter = resolveAdapter(projectRoot, config);

        if (opts.task) {
          const task = await adapter.getTask(opts.change, opts.task);
          output(json, task, () => renderTask(task));
        } else {
          const tasks = await adapter.listTasks(opts.change);
          output(json, tasks, () =>
            tasks.length === 0
              ? `No tasks for ${opts.change}.`
              : `## Tasks: ${opts.change} (${adapter.name})\n\n` + tasks.map(renderTask).join('\n'),
          );
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
        output(json, report, () =>
          [
            `Scanned ${report.scannedFiles} file(s); indexed ${report.indexedArtifacts}.`,
            ...(report.invalidFiles.length
              ? ['Invalid files:', ...report.invalidFiles.map((i) => `  ${i.path}: ${i.error}`)]
              : []),
          ].join('\n'),
        );
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
