/**
 * Workspace lifecycle commands: `init` and `status`.
 */

import type { Command } from 'commander';
import { ArtifactEngine } from '../../artifacts/engine.js';
import { loadBoardState } from '../../delivery/load.js';
import { initWorkspace, workspaceStatus } from '../../workspace/init.js';
import { renderBox, renderSection } from '../render.js';
import { runCommand } from '../runtime.js';

const DRIFT_CODES = new Set([
  'dangling-dep', 'dep-cycle', 'ungroomed-change', 'orphan-epic', 'archived-in-sprint', 'closable-sprint',
]);

interface DriftSummary {
  warnings: number;
  codes: Record<string, number>;
}

/**
 * Drift is advisory: any failure to derive the board (no OpenSpec workspace,
 * broken adapter) silently yields no summary so `status` never breaks.
 */
async function collectDrift(cwd: string | undefined): Promise<DriftSummary | undefined> {
  let engine: ArtifactEngine;
  try {
    engine = await ArtifactEngine.open({ projectRoot: cwd });
  } catch {
    return undefined;
  }
  try {
    const { board } = await loadBoardState(engine, cwd);
    if (board.warnings.some((warning) => warning.code === 'adapter-unavailable')) return undefined;
    const codes: Record<string, number> = {};
    let warnings = 0;
    for (const warning of board.warnings) {
      if (!DRIFT_CODES.has(warning.code)) continue;
      warnings += 1;
      codes[warning.code] = (codes[warning.code] ?? 0) + 1;
    }
    return { warnings, codes };
  } catch {
    return undefined;
  } finally {
    engine.close();
  }
}

function driftLine(drift: DriftSummary): string {
  const parts = Object.entries(drift.codes)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code, count]) => (count > 1 ? `${code} ×${count}` : code));
  return `Delivery drift: ${parts.join(', ')} — run the spego-groom workflow.`;
}

export function registerWorkspace(program: Command): void {
  program
    .command('init')
    .description('Initialize a .spego/ workspace in the current project')
    .option('--agents <list>', 'comma-separated list of agent toolchains', 'claude')
    .option('--demo <bool>', 'seed demo artifacts (true|false)', 'false')
    .option('--force', 'overwrite config (does not delete artifacts)', false)
    .option('--cwd <dir>', 'project root (defaults to current directory)')
    .action(async (opts) => {
      await runCommand({ program }, async () => {
        const summary = await initWorkspace({
          projectRoot: opts.cwd,
          agents: String(opts.agents).split(',').map((s: string) => s.trim()).filter(Boolean),
          demo: opts.demo === 'true',
          force: opts.force,
        });
        const human = (): string => {
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
          return renderSection('📦', headerLabel, box);
        };
        return { payload: summary, human };
      });
    });

  program
    .command('status')
    .description('Report workspace status')
    .option('--cwd <dir>', 'project root')
    .action(async (opts) => {
      await runCommand({ program }, async () => {
        const status = await workspaceStatus(opts.cwd);
        const drift = status.initialized ? await collectDrift(opts.cwd) : undefined;
        const human = (): string => {
          if (!status.initialized) return `No spego workspace; run: spego init`;
          const box = renderBox('Workspace status', [
            ['root', status.workspaceRoot ?? ''],
            ['agents', status.agents?.join(', ') ?? '(none)'],
            ['artifacts', status.artifactsRoot ?? ''],
            ['index', status.indexPath ?? ''],
          ]);
          const blocks = [box];
          if (drift && drift.warnings > 0) blocks.push(driftLine(drift));
          return renderSection('📦', 'Workspace ready', ...blocks);
        };
        return { payload: drift === undefined ? status : { ...status, drift }, human };
      });
    });
}
