/**
 * `spego orchestrate` — run the multi-agent orchestration pipeline over an
 * OpenSpec change and emit a structured verdict in human or `--json` mode.
 */

import path from 'node:path';
import type { Command } from 'commander';
import { orchestrateChange } from '../../orchestration/index.js';
import type { ExecutionMode, OrchestrationOutcome } from '../../orchestration/index.js';
import { renderHeader, renderTable } from '../render.js';
import { runCommand } from '../runtime.js';

const VALID_MODES = new Set<ExecutionMode>(['sequential', 'parallel', 'adaptive']);

export function registerOrchestrate(program: Command): void {
  program
    .command('orchestrate')
    .description('Run the multi-agent orchestration pipeline for an OpenSpec change')
    .requiredOption('--change <name>', 'OpenSpec change name to orchestrate')
    .option('--mode <mode>', 'sequential | parallel | adaptive (default: from breakdown)')
    .option('--skip-verify', 'skip the verifier step', false)
    .option('--cwd <dir>', 'project root')
    .action(async (opts) => {
      await runCommand<OrchestrationOutcome>({ program }, async () => {
        const mode = opts.mode && VALID_MODES.has(opts.mode) ? (opts.mode as ExecutionMode) : undefined;
        const outcome = await orchestrateChange({
          projectRoot: path.resolve(opts.cwd ?? process.cwd()),
          changeName: opts.change,
          mode,
          skipVerify: Boolean(opts.skipVerify),
        });
        return {
          payload: outcome,
          human: () => {
            const verdict = outcome.verdict.passed ? 'PASS' : 'FAIL';
            const rows = outcome.results.map((r) => [
              r.success ? '[x]' : '[ ]',
              r.subtaskId,
              r.error ?? '',
            ]);
            const table = renderTable(['ok', 'subtask', 'error'], rows);
            return [
              renderHeader('🧭', `Orchestrate: ${outcome.changeName}`),
              `goal     ${outcome.goal}`,
              `mode     ${outcome.executionMode}`,
              `tasks    ${outcome.tasksSucceeded}/${outcome.tasksTotal} succeeded`,
              `verdict  ${verdict}`,
              '',
              table,
            ].join('\n');
          },
        };
      });
    });
}
