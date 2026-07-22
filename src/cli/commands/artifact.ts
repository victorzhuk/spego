/**
 * Artifact CRUD commands: `create`, `read`, `update`, `delete`, `list`.
 *
 * All five share the artifact-engine runtime helper so neither engine
 * lifecycle nor `--json` resolution is duplicated per command.
 */

import path from 'node:path';
import type { Command } from 'commander';
import { z } from 'zod';
import type { ArtifactEngine } from '../../artifacts/engine.js';
import { makeSlug } from '../../artifacts/slug.js';
import type { ArtifactRecord } from '../../artifacts/types.js';
import { resolveAdapter, type DeliveryAdapter } from '../../delivery/index.js';
import { assertWorkspace } from '../../delivery/openspec-discover.js';
import { SpegoError } from '../../errors.js';
import { renderDivider, renderHeader, renderSection, renderTable } from '../render.js';
import { runEngineCommand } from '../runtime.js';
import { resolveBody } from '../body-input.js';
import { assertEpicSlugActive } from '../epic-slug.js';

function renderArtifactHeader(fm: ArtifactRecord['frontmatter']): string {
 return `📄 ${fm.type}/${fm.slug}  rev ${fm.revision}  (${fm.id})`;
}

function renderRecordHuman(record: ArtifactRecord): string {
 return `${renderArtifactHeader(record.frontmatter)}\n${renderDivider()}\n${record.body}`;
}

function parseMeta(meta: string): unknown {
 try {
  return JSON.parse(meta);
 } catch (err) {
  throw new SpegoError('VALIDATION_FAILED', 'Invalid JSON for --meta', {
   option: '--meta',
   cause: err instanceof Error ? err.message : String(err),
  });
 }
}

function parseRevision(revision: string): number {
 const result = z.coerce.number().int().positive().safeParse(revision);
 if (result.success) return result.data;
 throw new SpegoError('VALIDATION_FAILED', 'Invalid --revision; expected a positive integer', {
  option: '--revision',
 });
}


async function resolveEpicAdapter(engine: ArtifactEngine): Promise<DeliveryAdapter | null> {
 const adapter = resolveAdapter(engine.paths.projectRoot, engine.config);
 try {
  await assertWorkspace(engine.paths.projectRoot);
 } catch (err) {
  if (err instanceof SpegoError && err.code === 'DELIVERY_ADAPTER_ERROR') {
   return null;
  }
  throw err;
 }
 return adapter;
}


export function registerArtifact(program: Command): void {
 program
  .command('create')
  .description('Create an artifact')
  .requiredOption('--type <type>', 'artifact type, e.g. prd|epic|sprint-plan|api|architecture')
  .requiredOption('--title <title>', 'artifact title')
  .option('--slug <slug>', 'optional explicit slug')
  .option('--body <text>', 'inline markdown body')
  .option('--body-file <path>', 'read markdown body from a file (use - for stdin)')
  .option('--meta <json>', 'JSON object of metadata', '{}')
  .option('--cwd <dir>', 'project root')
  .action(async (opts) => {
   let body = '';
   let meta: unknown = {};
   await runEngineCommand(
    {
     program,
     cwd: opts.cwd,
     validate: async () => {
      body = (await resolveBody(opts)) ?? '';
      meta = parseMeta(opts.meta);
     },
    },
    async (engine) => {
     if (opts.type === 'epic') {
      const adapter = await resolveEpicAdapter(engine);
      const slug = opts.slug ? makeSlug(opts.slug) : makeSlug(opts.title);
      await assertEpicSlugActive(adapter, slug);
     }
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
      markdown: engine.renderMarkdown(record),
     };
     const human = (): string =>
      [
       renderHeader('✨', `Created ${record.frontmatter.type}/${record.frontmatter.slug}  rev ${record.frontmatter.revision}`),
       `   path: ${record.path}`,
      ].join('\n');
     return { payload, human };
    },
   );
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
   let revision: number | undefined;
   await runEngineCommand(
    {
     program,
     cwd: opts.cwd,
     validate: () => {
      revision = opts.revision === undefined ? undefined : parseRevision(opts.revision);
     },
    },
    async (engine) => {
     let record: ArtifactRecord;
     if (opts.id) {
      record =
       revision !== undefined
        ? await engine.readRevision(opts.id, revision)
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
    },
   );
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
   let body: string | undefined;
   let meta: unknown;
   await runEngineCommand(
    {
     program,
     cwd: opts.cwd,
     validate: async () => {
      body = await resolveBody(opts);
      meta = opts.meta === undefined ? undefined : parseMeta(opts.meta);
     },
    },
    async (engine) => {
     const current = await engine.readById(opts.id);
     if (current.frontmatter.type === 'epic') {
      const adapter = await resolveEpicAdapter(engine);
      await assertEpicSlugActive(adapter, current.frontmatter.slug);
     }
     const patch: Record<string, unknown> = {};
     if (opts.title !== undefined) patch.title = opts.title;
     if (body !== undefined) patch.body = body;
     if (meta !== undefined) patch.meta = meta;
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
    },
   );
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
     if (items.length === 0) return renderSection('📦', 'Artifacts', 'No artifacts.');
     const rows = items.map((a) => [
      `${a.type}/${a.slug}`,
      String(a.revision),
      a.deletedAt ? 'deleted' : 'active',
      a.title,
      a.id,
     ]);
     const table = renderTable(['type/slug', 'rev', 'status', 'title', 'id'], rows);
     return renderSection('📦', 'Artifacts', table);
    };
    return { payload: items, human };
   });
  });
}
