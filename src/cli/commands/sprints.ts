/**
 * Sprint listing: `spego sprints` — a read-only view over `sprint-plan`
 * artifacts in board order. Membership stays owned by the groom workflow.
 */

import type { Command } from 'commander';
import { toMirrorArtifact } from '../../delivery/load.js';
import { summarizeSprints, type SprintSummary } from '../../delivery/mirror.js';
import { renderHeader, renderTable } from '../render.js';
import { runEngineCommand } from '../runtime.js';

function sprintRow(sprint: SprintSummary): string[] {
  const window = sprint.startDate || sprint.endDate
    ? `${sprint.startDate ?? '…'} → ${sprint.endDate ?? '…'}`
    : '—';
  return [sprint.slug, sprint.status, window, String(sprint.changes.length), sprint.title];
}

export function registerSprints(program: Command): void {
  program
    .command('sprints')
    .description('List sprint plans in board order')
    .option('--cwd <dir>', 'project root')
    .action(async (opts) => {
      await runEngineCommand({ program, cwd: opts.cwd }, async (engine) => {
        const sprints = summarizeSprints(engine.list({ type: 'sprint-plan' }).map(toMirrorArtifact));
        return {
          payload: sprints,
          human: () => {
            if (sprints.length === 0) return 'No sprint plans.';
            const table = renderTable(['sprint', 'status', 'window', 'changes', 'title'], sprints.map(sprintRow), { maxWidth: 48 });
            return `${renderHeader('🏃', 'Sprints')}\n${table}`;
          },
        };
      });
    });
}
