/**
 * Delivery commands: read-only `epics` and `tasks` views over the configured
 * delivery adapter (default: OpenSpec). Mutating actions are rejected with
 * `DELIVERY_READ_ONLY` so users get a structured pointer to the right tool.
 */

import path from 'node:path';
import type { Command } from 'commander';
import { resolveWorkspacePaths } from '../../workspace/paths.js';
import { readConfig } from '../../workspace/config.js';
import { resolveAdapter } from '../../delivery/index.js';
import type { DeliveryEpicLink, DeliveryTaskSummary } from '../../delivery/index.js';
import { SpegoError } from '../../errors.js';
import { renderHeader, renderTable } from '../render.js';
import { runCommand } from '../runtime.js';

const READ_ONLY_ACTIONS = new Set(['list', 'get']);

function assertReadOnlyAction(action: string | undefined, surface: 'epics' | 'tasks'): void {
  if (!action || READ_ONLY_ACTIONS.has(action)) return;
  throw new SpegoError(
    'DELIVERY_READ_ONLY',
    `Cannot '${action}' delivery ${surface} through spego. Use the OpenSpec CLI for delivery mutations.`,
    { attemptedAction: action, suggestedTool: 'openspec' },
  );
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
    .description('List epics or get a single epic')
    .argument('[action]', 'list (default) or get')
    .option('--change <name>', 'get a single epic by name')
    .option('--cwd <dir>', 'project root')
    .action(async (action, opts) => {
      await runCommand<DeliveryEpicLink | DeliveryEpicLink[]>({ program }, async () => {
        assertReadOnlyAction(action, 'epics');
        const projectRoot = path.resolve(opts.cwd ?? process.cwd());
        const wsPaths = resolveWorkspacePaths(projectRoot);
        const config = await readConfig(wsPaths.configPath);
        const adapter = resolveAdapter(projectRoot, config);

        if (opts.change) {
          const epic = await adapter.getEpic(opts.change);
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
    .argument('[action]', 'list (default) or get')
    .requiredOption('--change <name>', 'the epic/change name')
    .option('--task <id>', 'get a single task by id')
    .option('--cwd <dir>', 'project root')
    .action(async (action, opts) => {
      await runCommand<DeliveryTaskSummary | DeliveryTaskSummary[]>({ program }, async () => {
        assertReadOnlyAction(action, 'tasks');
        const projectRoot = path.resolve(opts.cwd ?? process.cwd());
        const wsPaths = resolveWorkspacePaths(projectRoot);
        const config = await readConfig(wsPaths.configPath);
        const adapter = resolveAdapter(projectRoot, config);

        if (opts.task) {
          const task = await adapter.getTask(opts.change, opts.task);
          return {
            payload: task,
            human: () => {
              const table = renderTable(['done', 'title'], [renderTaskRow(task)]);
              return `${renderHeader('✅', `Task: ${opts.change} (${adapter.name})`)}\n${table}`;
            },
          };
        }
        const tasks = await adapter.listTasks(opts.change);
        return {
          payload: tasks,
          human: () => {
            if (tasks.length === 0) return `No tasks for ${opts.change}.`;
            const table = renderTable(['done', 'title'], tasks.map(renderTaskRow));
            return `${renderHeader('✅', `Tasks: ${opts.change} (${adapter.name})`)}\n${table}`;
          },
        };
      });
    });
}
