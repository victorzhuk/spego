/**
 * Delivery commands: read-only `epics` and `tasks` views over the configured
 * delivery adapter (default: OpenSpec). Mutation verbs in the name position
 * are rejected with `DELIVERY_READ_ONLY` so agents get a structured pointer
 * to the right tool.
 */

import path from 'node:path';
import type { Command } from 'commander';
import { resolveWorkspacePaths } from '../../workspace/paths.js';
import { readConfig } from '../../workspace/config.js';
import { resolveAdapter } from '../../delivery/index.js';
import type { DeliveryAdapter, DeliveryEpicLink, DeliveryTaskSummary } from '../../delivery/index.js';
import { SpegoError } from '../../errors.js';
import { renderHeader, renderTable } from '../render.js';
import { runCommand } from '../runtime.js';

const MUTATING_ACTIONS = new Set([
  'create', 'update', 'delete', 'add', 'remove', 'edit', 'set', 'complete', 'close', 'archive',
]);

function assertReadOnly(name: string | undefined, surface: 'epics' | 'tasks', usage: string): void {
  if (!name) return;
  if (MUTATING_ACTIONS.has(name)) {
    throw new SpegoError(
      'DELIVERY_READ_ONLY',
      `Cannot '${name}' delivery ${surface} through spego. Use the OpenSpec CLI for delivery mutations.`,
      { attemptedAction: name, suggestedTool: 'openspec' },
    );
  }
  if (name === 'get') {
    throw new SpegoError('VALIDATION_FAILED', `'get' is no longer an action; usage: ${usage}`, { usage });
  }
}

async function loadAdapter(cwd: string | undefined): Promise<DeliveryAdapter> {
  const projectRoot = path.resolve(cwd ?? process.cwd());
  const wsPaths = resolveWorkspacePaths(projectRoot);
  const config = await readConfig(wsPaths.configPath);
  return resolveAdapter(projectRoot, config);
}

function renderEpicRow(epic: DeliveryEpicLink): string[] {
  const progress = epic.taskCount != null ? `${epic.tasksDone ?? 0}/${epic.taskCount}` : '—';
  return [epic.externalId, epic.status, progress, epic.title];
}

function renderTaskRow(task: DeliveryTaskSummary): string[] {
  return [task.status === 'done' ? '[x]' : '[ ]', task.title];
}

export function registerDelivery(program: Command): void {
  program
    .command('epics')
    .description('List epics or get a single epic by change name')
    .argument('[name]', 'change name to get a single epic')
    .option('--cwd <dir>', 'project root')
    .action(async (name: string | undefined, opts) => {
      await runCommand<DeliveryEpicLink | DeliveryEpicLink[]>({ program }, async () => {
        assertReadOnly(name, 'epics', 'spego epics <name>');
        const adapter = await loadAdapter(opts.cwd);

        if (name && name !== 'list') {
          const epic = await adapter.getEpic(name);
          return {
            payload: epic,
            human: () => {
              const table = renderTable(['id', 'status', 'progress', 'title'], [renderEpicRow(epic)]);
              return `${renderHeader('📚', `Epic (${adapter.name})`)}\n${table}`;
            },
          };
        }
        const epics = await adapter.listEpics();
        return {
          payload: epics,
          human: () => {
            if (epics.length === 0) return 'No epics.';
            const table = renderTable(
              ['id', 'status', 'progress', 'title'],
              epics.map(renderEpicRow),
            );
            return `${renderHeader('📚', `Epics (${adapter.name})`)}\n${table}`;
          },
        };
      });
    });

  program
    .command('tasks')
    .description('List tasks for a change or get a single task')
    .argument('<change>', 'change or epic name')
    .argument('[task]', 'task id to get a single task')
    .option('--cwd <dir>', 'project root')
    .action(async (change: string, task: string | undefined, opts) => {
      await runCommand<DeliveryTaskSummary | DeliveryTaskSummary[]>({ program }, async () => {
        assertReadOnly(change, 'tasks', 'spego tasks <change> [task]');
        const adapter = await loadAdapter(opts.cwd);

        if (task) {
          const found = await adapter.getTask(change, task);
          return {
            payload: found,
            human: () => {
              const table = renderTable(['done', 'title'], [renderTaskRow(found)]);
              return `${renderHeader('✅', `Task: ${change} (${adapter.name})`)}\n${table}`;
            },
          };
        }
        const tasks = await adapter.listTasks(change);
        return {
          payload: tasks,
          human: () => {
            if (tasks.length === 0) return `No tasks for ${change}.`;
            const table = renderTable(['done', 'title'], tasks.map(renderTaskRow));
            return `${renderHeader('✅', `Tasks: ${change} (${adapter.name})`)}\n${table}`;
          },
        };
      });
    });
}
