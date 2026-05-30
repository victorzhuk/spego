/**
 * Metadata commands: `commands` and `workflows`.
 * Both are read-only listings backed by static registries.
 */

import type { Command } from 'commander';
import { COMMAND_REGISTRY } from '../../commands/registry.js';
import type { CommandMeta } from '../../commands/registry.js';
import { WORKFLOW_REGISTRY } from '../../workflows/registry.js';
import { renderHeader, renderTable } from '../render.js';
import { runCommand } from '../runtime.js';

function renderCommandsHuman(): string {
  const order: Array<CommandMeta['category']> = ['workspace', 'artifact', 'view', 'planning'];
  const titles: Record<CommandMeta['category'], string> = {
    workspace: 'Workspace',
    artifact: 'Artifacts',
    view: 'View',
    planning: 'Planning',
  };
  const sections = order
    .map((cat) => {
      const items = COMMAND_REGISTRY.filter((c) => c.category === cat);
      if (items.length === 0) return '';
      const table = renderTable(['name', 'description'], items.map((c) => [c.name, c.description]));
      return `${titles[cat]}\n${table}`;
    })
    .filter((s) => s.length > 0);
  return [renderHeader('🛠️', 'Commands'), '', sections.join('\n\n')].join('\n');
}

function renderWorkflowsHuman(): string {
  const rows = WORKFLOW_REGISTRY.map((w) => [w.name, String(w.phases.length), w.description]);
  const table = renderTable(['name', 'phases', 'description'], rows, { maxWidth: 80 });
  return [renderHeader('🧭', 'Workflows'), '', table].join('\n');
}

export function registerMeta(program: Command): void {
  program
    .command('commands')
    .description('List available spego commands with metadata')
    .action(async () => {
      await runCommand({ program }, async () => ({
        payload: COMMAND_REGISTRY,
        human: renderCommandsHuman,
      }));
    });

  program
    .command('workflows')
    .description('List available workflow skills')
    .action(async () => {
      await runCommand({ program }, async () => {
        const entries = WORKFLOW_REGISTRY.map((w) => ({
          name: w.name,
          description: w.description,
          personas: w.personas,
          phases: w.phases,
          inputs: w.inputs,
          outputs: w.outputs,
        }));
        return { payload: entries, human: renderWorkflowsHuman };
      });
    });
}
