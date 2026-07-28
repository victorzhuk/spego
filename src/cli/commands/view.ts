/**
 * Bundle export: `spego view`.
 */

import type { Command } from 'commander';
import { z } from 'zod';
import { SpegoError } from '../../errors.js';
import { viewArtifacts, type OverviewBundle } from '../../export/view.js';
import { loadBoardState } from '../../delivery/load.js';
import { intersperseBundleDividers, renderBox, renderSection, renderTable } from '../render.js';
import { runEngineCommand } from '../runtime.js';
import type { ArtifactEngine } from '../../artifacts/engine.js';

async function resolveEpicStatusBySlug(
 engine: ArtifactEngine,
 cwd: string | undefined,
): Promise<Map<string, string>> {
 try {
  const state = await loadBoardState(engine, cwd);
  return new Map(state.input.changes.map((change) => [change.slug, change.status]));
 } catch {
  return new Map();
 }
}

function renderOverviewHuman(overview: OverviewBundle, filterType: string | undefined, includeDeleted: boolean): string {
 if (overview.count === 0) return renderSection('📦', 'Artifact bundle', 'No artifacts.');
 const boxRows: Array<[string, string]> = [
  ['artifacts', String(overview.count)],
  ['types', String(overview.groups.length)],
  ['latest', overview.latestUpdated ?? '—'],
 ];
 if (filterType) boxRows.push(['filter', `type=${filterType}`]);
 const blocks = [renderBox('Overview', boxRows)];
 for (const group of overview.groups) {
  const columns = includeDeleted
   ? ['slug', 'rev', 'status', 'lines', 'updated', 'state', 'title']
   : ['slug', 'rev', 'status', 'lines', 'updated', 'title'];
  const rows = group.rows.map((row) => {
   const cells = [row.slug, String(row.revision), row.status, String(row.lines), row.updated];
   if (includeDeleted) cells.push(row.deleted ? 'deleted' : 'active');
   cells.push(row.title);
   return cells;
  });
  blocks.push(`${group.type} (${group.rows.length})\n${renderTable(columns, rows, { maxWidth: 28 })}`);
 }
 return renderSection('📦', 'Artifact bundle', ...blocks);
}

export function registerView(program: Command): void {
 program
  .command('view')
  .description('Overview of artifacts as a scannable table; --detail exports the full markdown bundle, --json exports full JSON')
  .option('--type <type>', 'filter by type')
  .option('--id <id>', 'limit to a single artifact')
  .option('--revision <n>', 'specific revision (requires --id)')
  .option('--include-deleted', 'include soft-deleted artifacts', false)
  .option('--detail', 'print full artifact bodies', false)
  .option('--cwd <dir>', 'project root')
  .action(async (opts) => {
   let revision: number | undefined;
   await runEngineCommand(
    {
     program,
     cwd: opts.cwd,
     validate: () => {
      if (opts.revision === undefined) return;
      const result = z.coerce.number().int().positive().safeParse(opts.revision);
      if (result.success) {
       revision = result.data;
       return;
      }
      throw new SpegoError('VALIDATION_FAILED', 'Invalid --revision; expected a positive integer', {
       option: '--revision',
      });
     },
    },
    async (engine) => {
     const detail = Boolean(opts.detail) || Boolean(opts.id);
     const indexed = engine.list({ type: opts.type, includeDeleted: opts.includeDeleted });
     const filtered = opts.id ? indexed.filter((a) => a.id === opts.id) : indexed;
     const hasEpics = !detail && filtered.some((a) => a.type === 'epic');
     const statusBySlug = hasEpics ? await resolveEpicStatusBySlug(engine, opts.cwd) : new Map<string, string>();
     const view = await viewArtifacts(
      engine,
      { type: opts.type, id: opts.id, revision, includeDeleted: opts.includeDeleted },
      { statusBySlug },
     );
     return {
      payload: view.json,
      human: () =>
       detail
        ? renderSection('📦', 'Artifact bundle', intersperseBundleDividers(view.markdown.content))
        : renderOverviewHuman(view.overview, opts.type, Boolean(opts.includeDeleted)),
     };
    },
   );
  });
}
