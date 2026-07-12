/**
 * Bundle export: `spego view`.
 *
 * Honors the deprecated `--format` flag during the deprecation window in
 * addition to the global `--json` flag.
 */

import type { Command } from 'commander';
import { z } from 'zod';
import { SpegoError } from '../../errors.js';
import { viewArtifacts } from '../../export/view.js';
import { intersperseBundleDividers, renderHeader } from '../render.js';
import { deprecate } from '../output.js';
import { getJsonMode, runEngineCommand } from '../runtime.js';

export function registerView(program: Command): void {
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
   const globalJson = getJsonMode(program);
   if (opts.format !== undefined) {
    deprecate(globalJson, '--format is deprecated; use the global --json flag');
   }
   const wantJson = globalJson || opts.format === 'json';

   let revision: number | undefined;
   await runEngineCommand(
    {
     program,
     cwd: opts.cwd,
     jsonOverride: wantJson,
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
     const view = await viewArtifacts(engine, {
      type: opts.type,
      id: opts.id,
      revision,
      includeDeleted: opts.includeDeleted,
     });
     const body = intersperseBundleDividers(view.markdown.content);
     return {
      payload: view.json,
      human: () => `${renderHeader('📦', 'Artifact bundle')}\n${body}`,
     };
    },
   );
  });
}
