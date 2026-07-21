import { SpegoError } from '../errors.js';
import { assertWorkspace, discoverChanges, type DiscoveredChange } from './openspec-discover.js';
import { parseTasks, readProposalTitle } from './openspec-parse.js';
import type { DeliveryAdapter, DeliveryEpicLink, DeliveryTaskSummary } from './types.js';

export function createOpenSpecAdapter(projectRoot: string): DeliveryAdapter {
  return {
    name: 'openspec',

    async listEpics(): Promise<DeliveryEpicLink[]> {
      await assertWorkspace(projectRoot);
      const changes = (await discoverChanges(projectRoot)).filter((change) => !change.archived);
      return listEpicsFromDiscovered(projectRoot, changes);
    },

    async getEpic(externalId: string): Promise<DeliveryEpicLink> {
      await assertWorkspace(projectRoot);
      const changes = await discoverChanges(projectRoot);
      const change = changes.find((item) => item.name === externalId);
      if (!change || change.archived) {
        throw new SpegoError('DELIVERY_ADAPTER_ERROR', `Change "${externalId}" not found`, {
          changeName: externalId,
        });
      }
      const { title, taskCount, tasksDone, status } = await resolveEpic(projectRoot, change);
      return {
        adapterName: 'openspec',
        externalId: change.name,
        title,
        status,
        sourcePath: change.relPath,
        taskCount,
        tasksDone,
      };
    },

    async listTasks(externalId: string): Promise<DeliveryTaskSummary[]> {
      await assertWorkspace(projectRoot);
      const changes = await discoverChanges(projectRoot);
      const change = changes.find((item) => item.name === externalId);
      if (!change || change.archived) {
        throw new SpegoError('DELIVERY_ADAPTER_ERROR', `Change "${externalId}" not found`, {
          changeName: externalId,
        });
      }
      const { tasks } = await parseTasks(projectRoot, change.relPath, change.name);
      return tasks;
    },

    async getTask(externalId: string, taskId: string): Promise<DeliveryTaskSummary> {
      const tasks = await this.listTasks(externalId);
      const task = tasks.find((item) => item.externalId === taskId);
      if (!task) {
        throw new SpegoError(
          'DELIVERY_ADAPTER_ERROR',
          `Task "${taskId}" not found in change "${externalId}"`,
          {
            changeName: externalId,
            taskId,
          },
        );
      }
      return task;
    },
  };
}

export async function listEpicsFromDiscovered(
  projectRoot: string,
  changes: DiscoveredChange[],
): Promise<DeliveryEpicLink[]> {
  return Promise.all(
    changes.map(async (change) => {
      const { title, status, taskCount, tasksDone } = await resolveEpic(projectRoot, change);
      return {
        adapterName: 'openspec',
        externalId: change.name,
        title,
        status,
        sourcePath: change.relPath,
        taskCount,
        tasksDone,
      };
    }),
  );
}

async function resolveEpic(
  projectRoot: string,
  change: DiscoveredChange,
): Promise<{
  title: string;
  taskCount: number;
  tasksDone: number;
  status: DeliveryEpicLink['status'];
}> {
  const [title, { total, done, status }] = await Promise.all([
    readProposalTitle(projectRoot, change.relPath),
    parseTasks(projectRoot, change.relPath, change.name),
  ]);

  return {
    title,
    taskCount: total,
    tasksDone: done,
    status,
  };
}
