/**
 * Workspace lifecycle commands: `init` and `status`.
 */

import type { Command } from 'commander';
import { initWorkspace, workspaceStatus } from '../../workspace/init.js';
import { renderBox, renderHeader } from '../render.js';
import { runCommand } from '../runtime.js';

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
          return `${renderHeader('📦', headerLabel)}\n${box}`;
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
        const human = (): string => {
          if (!status.initialized) return `No spego workspace; run: spego init`;
          const box = renderBox('Workspace status', [
            ['root', status.workspaceRoot ?? ''],
            ['agents', status.agents?.join(', ') ?? '(none)'],
            ['artifacts', status.artifactsRoot ?? ''],
            ['index', status.indexPath ?? ''],
          ]);
          return `${renderHeader('📦', 'Workspace ready')}\n${box}`;
        };
        return { payload: status, human };
      });
    });
}
