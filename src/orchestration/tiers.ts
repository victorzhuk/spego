/**
 * Dependency-tier construction for the swarm scheduler.
 *
 * Uses Kahn's algorithm to group sub-tasks into tiers: tasks within a tier
 * have no dependency on one another and can run in parallel. When a cycle is
 * detected, the remaining tasks are emitted as single-task tiers so they run
 * sequentially rather than concurrently.
 */

import type { SubTask } from './types.js';

export interface DependencyTiers {
  tiers: SubTask[][];
  hadCycle: boolean;
}

export function buildDependencyTiers(tasks: SubTask[]): DependencyTiers {
  const byId = new Map<string, SubTask>(tasks.map((t) => [t.id, t]));
  const inDegree = new Map<string, number>(tasks.map((t) => [t.id, 0]));
  for (const task of tasks) {
    for (const dep of task.dependsOn) {
      if (inDegree.has(dep)) {
        inDegree.set(task.id, (inDegree.get(task.id) ?? 0) + 1);
      }
    }
  }

  const tiers: SubTask[][] = [];
  const remaining = new Set<string>(tasks.map((t) => t.id));
  let hadCycle = false;

  const priorityOf = (id: string): number => byId.get(id)?.priority ?? 0;

  while (remaining.size > 0) {
    const ready = [...remaining].filter((id) => (inDegree.get(id) ?? 0) === 0);

    if (ready.length === 0) {
      // Cycle: drain the remainder one task at a time, lowest priority first.
      hadCycle = true;
      const ordered = [...remaining].sort((a, b) => priorityOf(a) - priorityOf(b));
      for (const id of ordered) {
        const task = byId.get(id);
        if (task) tiers.push([task]);
        remaining.delete(id);
      }
      break;
    }

    const tier = ready
      .sort((a, b) => priorityOf(a) - priorityOf(b))
      .map((id) => byId.get(id))
      .filter((t): t is SubTask => t !== undefined);
    tiers.push(tier);

    for (const id of ready) remaining.delete(id);
    for (const id of remaining) {
      const task = byId.get(id);
      if (!task) continue;
      for (const dep of task.dependsOn) {
        if (ready.includes(dep)) {
          inDegree.set(id, (inDegree.get(id) ?? 0) - 1);
        }
      }
    }
  }

  return { tiers, hadCycle };
}
