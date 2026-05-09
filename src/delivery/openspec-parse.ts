import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { DeliveryEpicLink, DeliveryItemStatus, DeliveryStatus, DeliveryTaskSummary } from './types.js';

export async function readProposalTitle(projectRoot: string, changeRelPath: string): Promise<string> {
  const filePath = join(projectRoot, changeRelPath, 'proposal.md');
  let content: string;
  try {
    content = await readFile(filePath, 'utf8');
  } catch {
    return changeRelPath.split('/').pop() ?? changeRelPath;
  }

  const genericHeadings = new Set(['why', 'what changes', 'context', 'what', 'overview', 'background', 'description']);
  const folderName = changeRelPath.split('/').pop() ?? changeRelPath;

  const headings = [...content.matchAll(/^#{1,4}\s+(.+)$/gm)];
  for (const m of headings) {
    const text = m[1]!.trim();
    if (!genericHeadings.has(text.toLowerCase())) return text;
  }

  return folderName;
}

export interface TasksResult {
  tasks: DeliveryTaskSummary[];
  total: number;
  done: number;
  status: DeliveryStatus;
}

const TASK_RE = /^-\s*\[([ xX])\]\s*(.+)$/;

export async function parseTasks(
  projectRoot: string,
  changeRelPath: string,
  changeName: string,
): Promise<TasksResult> {
  const tasksPath = join(projectRoot, changeRelPath, 'tasks.md');
  let content: string;
  try {
    const s = await stat(tasksPath);
    if (!s.isFile()) return noTasks();
    content = await readFile(tasksPath, 'utf8');
  } catch {
    return noTasks();
  }

  const tasks: DeliveryTaskSummary[] = [];
  let done = 0;

  for (const line of content.split('\n')) {
    const m = TASK_RE.exec(line);
    if (!m) continue;
    const checked = m[1]!.toLowerCase() === 'x';
    const text = m[2]!.trim();
    if (checked) done++;
    tasks.push({
      adapterName: 'openspec',
      externalId: text,
      title: text,
      status: checked ? 'done' as DeliveryItemStatus : 'pending' as DeliveryItemStatus,
      parentEpicId: changeName,
      sourcePath: join(changeRelPath, 'tasks.md'),
    });
  }

  const total = tasks.length;
  if (total === 0) return noTasks();
  const status: DeliveryStatus = done === total ? 'completed' : 'active';

  return { tasks, total, done, status };
}

function noTasks(): TasksResult {
  return { tasks: [], total: 0, done: 0, status: 'planning-incomplete' };
}
