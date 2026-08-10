/**
 * The cross-project run store: an append-only JSONL file outside any repo,
 * holding recorded runs keyed by Flow and Size Tier so evidence gathered in
 * one workspace can price another. It is plain data, not a spego workspace;
 * losing it costs evidence, not correctness — the pricing ladder simply falls
 * back a rung.
 */
import fs from 'node:fs/promises';
import { SIZE_TIERS } from '../artifacts/types.js';
import { storeRunsPath } from '../workspace/paths.js';

/** One cross-project run: the Flow, the Size Tier of the change it ran, and the Flow Hours it took. Carries no repo attribution. */
export interface StoreRun {
  flow: string;
  tier: string;
  hours: number;
}

/** Append one run to the store under `storeRoot`, creating the root on first write. */
export async function appendStoreRun(storeRoot: string, run: StoreRun): Promise<void> {
  await fs.mkdir(storeRoot, { recursive: true });
  await fs.appendFile(storeRunsPath(storeRoot), `${JSON.stringify(run)}\n`, 'utf8');
}

/**
 * Read every well-formed run from the store. A missing store reads as empty;
 * malformed lines are dropped so one bad append cannot void the history
 * around it — the same guard `parseActuals` gives an epic.
 */
export async function readStoreRuns(storeRoot: string): Promise<StoreRun[]> {
  let raw: string;
  try {
    raw = await fs.readFile(storeRunsPath(storeRoot), 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
  const runs: StoreRun[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      continue;
    }
    if (typeof parsed !== 'object' || parsed === null) continue;
    const record = parsed as Record<string, unknown>;
    if (typeof record.flow !== 'string' || record.flow.length === 0) continue;
    if (typeof record.tier !== 'string' || !(SIZE_TIERS as readonly string[]).includes(record.tier)) continue;
    if (typeof record.hours !== 'number' || !Number.isFinite(record.hours) || record.hours < 0) continue;
    runs.push({ flow: record.flow, tier: record.tier, hours: record.hours });
  }
  return runs;
}
