/**
 * Bundle export: `spego view`.
 */

import type { Command } from 'commander';
import { z } from 'zod';
import { SpegoError } from '../../errors.js';
import { viewArtifacts } from '../../export/view.js';
import { intersperseBundleDividers, renderSection } from '../render.js';
import { runEngineCommand } from '../runtime.js';

export function registerView(program: Command): void {
 program
  .command('view')
  .description('Export artifact bundle as markdown (default) or JSON via --json')
  .option('--type <type>', 'filter by type')
  .option('--id <id>', 'limit to a single artifact')
  .option('--revision <n>', 'specific revision (requires --id)')
  .option('--include-deleted', 'include soft-deleted artifacts', false)
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
     const view = await viewArtifacts(engine, {
      type: opts.type,
      id: opts.id,
      revision,
      includeDeleted: opts.includeDeleted,
     });
     const body = intersperseBundleDividers(view.markdown.content);
     return {
      payload: view.json,
      human: () => renderSection('📦', 'Artifact bundle', body),
     };
    },
   );
  });
}
