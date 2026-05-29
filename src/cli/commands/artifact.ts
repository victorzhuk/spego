/**
 * Artifact CRUD commands: `create`, `read`, `update`, `delete`, `list`.
 *
 * All five share the artifact-engine runtime helper so neither engine
 * lifecycle nor `--json` resolution is duplicated per command.
 */

import path from 'node:path';
import type { Command } from 'commander';
import { renderArtifactFile } from '../../artifacts/storage.js';
import type { ArtifactRecord } from '../../artifacts/types.js';
import { SpegoError } from '../../errors.js';
import { renderDivider, renderHeader, renderTable } from '../render.js';
import { runEngineCommand } from '../runtime.js';
import { resolveBody } from '../body-input.js';

function renderArtifactHeader(fm: ArtifactRecord['frontmatter']): string {
  return `📄 ${fm.type}/${fm.slug}  rev ${fm.revision}  (${fm.id})`;
}

function renderRecordHuman(record: ArtifactRecord): string {
  return `${renderArtifactHeader(record.frontmatter)}\n${renderDivider()}\n${record.body}`;
}

export function registerArtifact(program: Command): void {
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
      await runEngineCommand({ program, cwd: opts.cwd }, async (engine) => {
        const body = (await resolveBody(opts)) ?? '';
        const meta = JSON.parse(opts.meta);
        const record = await engine.create({
          type: opts.type,
          title: opts.title,
          slug: opts.slug,
          body,
          meta,
        });
        const payload = {
          id: record.frontmatter.id,
          type: record.frontmatter.type,
          slug: record.frontmatter.slug,
          revision: record.frontmatter.revision,
          path: record.path,
          markdown: renderArtifactFile(record.frontmatter, record.body),
        };
        const human = (): string =>
          [
            renderHeader('✨', `Created ${record.frontmatter.type}/${record.frontmatter.slug}  rev ${record.frontmatter.revision}`),
            `   path: ${record.path}`,
          ].join('\n');
        return { payload, human };
      });
    });

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
      await runEngineCommand({ program, cwd: opts.cwd }, async (engine) => {
        let record: ArtifactRecord;
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
        return {
          payload: { frontmatter: record.frontmatter, body: record.body, path: record.path },
          human: () => renderRecordHuman(record),
        };
      });
    });

  program
    .command('update')
    .description('Update an artifact (requires id)')
    .requiredOption('--id <id>', 'artifact id')
    .option('--title <title>', 'new title')
    .option('--body <text>', 'new markdown body')
    .option('--body-file <path>', 'read body from file (use - for stdin)')
    .option('--meta <json>', 'replace metadata (JSON object)')
    .option('--expected-revision <n>', 'expected current revision (optimistic concurrency)')
    .option('--cwd <dir>', 'project root')
    .action(async (opts) => {
      await runEngineCommand({ program, cwd: opts.cwd }, async (engine) => {
        const body = await resolveBody(opts);
        const patch: Record<string, unknown> = {};
        if (opts.title !== undefined) patch.title = opts.title;
        if (body !== undefined) patch.body = body;
        if (opts.meta !== undefined) patch.meta = JSON.parse(opts.meta);
        if (opts.expectedRevision !== undefined)
          patch.expectedRevision = Number(opts.expectedRevision);
        const record = await engine.update(opts.id, patch);
        return {
          payload: {
            id: record.frontmatter.id,
            revision: record.frontmatter.revision,
            path: record.path,
            frontmatter: record.frontmatter,
            body: record.body,
          },
          human: () => renderRecordHuman(record),
        };
      });
    });

  program
    .command('delete')
    .description('Soft-delete an artifact')
    .requiredOption('--id <id>', 'artifact id')
    .option('--cwd <dir>', 'project root')
    .action(async (opts) => {
      await runEngineCommand({ program, cwd: opts.cwd }, async (engine) => {
        const record = await engine.softDelete(opts.id);
        return {
          payload: {
            id: record.frontmatter.id,
            deletedAt: record.frontmatter.deletedAt,
            revision: record.frontmatter.revision,
          },
          human: () =>
            [
              renderHeader('🗑', `Deleted ${record.frontmatter.id}`),
              `   at: ${record.frontmatter.deletedAt}`,
            ].join('\n'),
        };
      });
    });

  program
    .command('list')
    .description('List artifacts')
    .option('--type <type>', 'filter by type')
    .option('--include-deleted', 'include soft-deleted artifacts', false)
    .option('--cwd <dir>', 'project root')
    .action(async (opts) => {
      await runEngineCommand({ program, cwd: opts.cwd }, async (engine) => {
        const items = engine.list({ type: opts.type, includeDeleted: opts.includeDeleted });
        const human = (): string => {
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
        };
        return { payload: items, human };
      });
    });
}
