import { SpegoError } from '../errors.js';
import { assertWorkspace, discoverChanges, fetchCliStatus } from './openspec-discover.js';
import { parseTasks, readProposalTitle } from './openspec-parse.js';
import type { DeliveryAdapter, DeliveryEpicLink, DeliveryStatus, DeliveryTaskSummary } from './types.js';

export function createOpenSpecAdapter(projectRoot: string): DeliveryAdapter {
  return {
    name: 'openspec',

    async listEpics(): Promise<DeliveryEpicLink[]> {
      await assertWorkspace(projectRoot);
      const changes = (await discoverChanges(projectRoot)).filter(c => !c.archived);
      const epics: DeliveryEpicLink[] = [];
      for (const change of changes) {
        const title = await readProposalTitle(projectRoot, change.relPath);
        const { total, done, status, warnings } = await resolveEpicStatus(projectRoot, change.name, change.relPath);
        epics.push({
          adapterName: 'openspec',
          externalId: change.name,
          title,
          status,
          sourcePath: change.relPath,
          taskCount: total,
          tasksDone: done,
          warnings,
        });
      }
      return epics;
    },

    async getEpic(externalId: string): Promise<DeliveryEpicLink> {
      await assertWorkspace(projectRoot);
      const changes = await discoverChanges(projectRoot);
      const change = changes.find(c => c.name === externalId);
      if (!change || change.archived) {
        throw new SpegoError('DELIVERY_ADAPTER_ERROR', `Change "${externalId}" not found`, {
          changeName: externalId,
        });
      }
      const title = await readProposalTitle(projectRoot, change.relPath);
      const { total, done, status, warnings } = await resolveEpicStatus(projectRoot, change.name, change.relPath);
      return {
        adapterName: 'openspec',
        externalId: change.name,
        title,
        status,
        sourcePath: change.relPath,
        taskCount: total,
        tasksDone: done,
        warnings,
      };
    },

    async listTasks(externalId: string): Promise<DeliveryTaskSummary[]> {
      await assertWorkspace(projectRoot);
      const changes = await discoverChanges(projectRoot);
      const change = changes.find(c => c.name === externalId);
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
      const task = tasks.find(t => t.externalId === taskId);
      if (!task) {
        throw new SpegoError('DELIVERY_ADAPTER_ERROR', `Task "${taskId}" not found in change "${externalId}"`, {
          changeName: externalId,
          taskId,
        });
      }
      return task;
    },
  };
}

async function resolveEpicStatus(
  projectRoot: string,
  changeName: string,
  changeRelPath: string,
): Promise<{ total: number; done: number; status: DeliveryStatus; warnings?: string[] }> {
  const cli = await fetchCliStatus(projectRoot, changeName);
  if (cli && typeof cli.taskCount === 'number' && typeof cli.tasksDone === 'number') {
    const total = cli.taskCount as number;
    const done = cli.tasksDone as number;
    if (total === 0) return { total: 0, done: 0, status: 'planning-incomplete' };
    return { total, done, status: done === total ? 'completed' : 'active' };
  }
  const result = await parseTasks(projectRoot, changeRelPath, changeName);
  return { ...result, warnings: ['OpenSpec CLI status unavailable, using filesystem fallback'] };
}
