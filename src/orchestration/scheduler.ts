/**
 * Swarm scheduler. Executes sub-tasks in `sequential`, `parallel`, or
 * `adaptive` mode, honoring `dependsOn` edges and bounding concurrency.
 *
 * The actual per-task work is injected via `runTask`, keeping the scheduler
 * free of any OpenCode/IO coupling and trivially unit-testable.
 */

import { buildDependencyTiers } from './tiers.js';
import type { ExecutionMode, SubTask, SubtaskResult, TaskBreakdown } from './types.js';

export interface SwarmOptions {
  mode?: ExecutionMode;
  maxParallel: number;
  runTask: (task: SubTask) => Promise<SubtaskResult>;
}

export interface SwarmOutcome {
  results: SubtaskResult[];
  warnings: string[];
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workerCount = Math.max(1, Math.min(limit, items.length));
  const workers = Array.from({ length: workerCount }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      const item = items[index];
      if (item === undefined) continue;
      results[index] = await fn(item);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function runSwarm(breakdown: TaskBreakdown, opts: SwarmOptions): Promise<SwarmOutcome> {
  const mode = opts.mode ?? breakdown.executionMode;
  const tasks = [...breakdown.subtasks].sort((a, b) => a.priority - b.priority);
  const warnings: string[] = [];

  const { tiers, hadCycle } = buildDependencyTiers(tasks);
  if (hadCycle) {
    warnings.push('Dependency cycle detected — affected sub-tasks ran sequentially');
  }

  if (mode === 'sequential') {
    const ordered = tiers.flat();
    const results: SubtaskResult[] = [];
    for (const task of ordered) {
      results.push(await opts.runTask(task));
    }
    return { results, warnings };
  }

  // parallel + adaptive: run dependency tiers sequentially, parallel within each tier.
  const results: SubtaskResult[] = [];
  for (const tier of tiers) {
    const tierResults = await mapWithConcurrency(tier, opts.maxParallel, opts.runTask);
    results.push(...tierResults);
  }
  return { results, warnings };
}
