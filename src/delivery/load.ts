/**
 * Loads mirror input from the engine plus the delivery adapter and derives
 * the board. Shared by the `board` command and the `status` drift summary.
 */

import path from 'node:path';
import type { ListOptions, IndexedArtifact } from '../index/indexer.js';
import type { ArtifactEngine } from '../artifacts/engine.js';
import { SpegoError } from '../errors.js';
import { readConfig } from '../workspace/config.js';
import { resolveStoreRoot, resolveWorkspacePaths } from '../workspace/paths.js';
import { assertWorkspace, discoverChanges } from './openspec-discover.js';
import { listEpicsFromDiscovered } from './openspec-adapter.js';
import { resolveAdapter } from './resolve.js';
import { readStoreRuns, type StoreRun } from './store.js';
import { loadFreshSnapshot, type FreshSnapshot } from './fresh-snapshot.js';
import {
  deriveMirror,
  type MirrorArtifact,
  type MirrorBoard,
  type MirrorInput,
  type MirrorWarning,
} from './mirror.js';

import type { DeliveryAdapter, DeliveryEpicLink, DeliveryStatus } from './types.js';

export interface BoardState {
  input: MirrorInput;
  board: MirrorBoard;
}

export interface LoadBoardOptions {
  /** Read artifacts from canonical files instead of the index for this invocation. */
  fresh?: boolean;
}

export async function loadBoardState(
  engine: ArtifactEngine,
  cwd: string | undefined,
  opts: LoadBoardOptions = {},
): Promise<BoardState> {
  const projectRoot = path.resolve(cwd ?? process.cwd());
  const wsPaths = resolveWorkspacePaths(projectRoot);
  const config = await readConfig(wsPaths.configPath);
  const adapter = resolveAdapter(projectRoot, config);
  // The store is resolved only when the workspace opts in: with the flag off,
  // pricing is reproducible from the repo and the config directory stays unread.
  const storeRuns = config.flows?.crossProject ? await readStoreRuns(resolveStoreRoot()) : undefined;
  try {
    const artifacts = opts.fresh ? await loadFreshSnapshot(wsPaths, config) : engine;
    const input = await collectMirrorInput(artifacts, projectRoot, adapter, config.flows, storeRuns);
    return { input, board: deriveMirror(input) };
  } catch (err) {
    if (err instanceof SpegoError && err.code === 'DELIVERY_ADAPTER_ERROR') {
      const warning: MirrorWarning = {
        code: 'adapter-unavailable',
        message: 'OpenSpec workspace unavailable; mirror board is empty.',
        details: err.details,
      };
      const input: MirrorInput = {
        changes: [],
        epics: [],
        sprints: [],
        linkedArtifacts: [],
        warnings: [warning],
        flows: config.flows,
        storeRuns,
      };
      return { input, board: deriveMirror(input) };
    }
    throw err;
  }
}

interface ArtifactSource {
  list(opts?: ListOptions): IndexedArtifact[];
}

async function collectMirrorInput(
  artifacts: ArtifactSource | FreshSnapshot,
  projectRoot: string,
  adapter: DeliveryAdapter,
  flows: MirrorInput['flows'],
  storeRuns: StoreRun[] | undefined,
): Promise<MirrorInput> {
  if (adapter.name === 'openspec') await assertWorkspace(projectRoot);
  const discovered = await discoverChanges(projectRoot);
  const adapterEpics =
    adapter.name === 'openspec'
      ? await listEpicsFromDiscovered(
        projectRoot,
        discovered.filter((change) => !change.archived),
      )
      : await adapter.listEpics();
  const adapterBySlug = new Map(adapterEpics.map((epic) => [epic.externalId, epic]));
  const seen = new Set<string>();
  const changes = discovered
    .map((item) => {
      seen.add(item.name);
      const adapterEpic = adapterBySlug.get(item.name);
      return sourceChange(item.name, item.archived, adapterEpic);
    })
    .sort((a, b) => a.slug.localeCompare(b.slug));
  for (const epic of adapterEpics) {
    if (seen.has(epic.externalId)) continue;
    changes.push(sourceChange(epic.externalId, false, epic));
  }
  changes.sort((a, b) => a.slug.localeCompare(b.slug));

  // Retired (soft-deleted) epics stay in the input: their recorded actuals
  // must keep feeding closed-sprint rows and pricing buckets. deriveMirror
  // keeps them off planning surfaces via deletedAt.
  const epics = artifacts.list({ type: 'epic', includeDeleted: true }).map(toMirrorArtifact);
  const sprints = artifacts.list({ type: 'sprint-plan' }).map(toMirrorArtifact);
  const linkedArtifacts = await resolveLinkedArtifacts(artifacts, [...epics, ...sprints]);
  return { changes, epics, sprints, linkedArtifacts, warnings: [], flows, storeRuns };
}

function sourceChange(slug: string, archived: boolean, epic: DeliveryEpicLink | undefined) {
  const status: DeliveryStatus = archived ? 'completed' : (epic?.status ?? 'unknown');
  return {
    slug,
    title: epic?.title ?? slug,
    status,
    archived,
    warnings: epic?.warnings,
    taskCount: epic?.taskCount,
    tasksDone: epic?.tasksDone,
    hasTaskPlan: epic?.hasTaskPlan,
  };
}

export function toMirrorArtifact(artifact: IndexedArtifact): MirrorArtifact {
  return {
    id: artifact.id,
    type: artifact.type,
    slug: artifact.slug,
    title: artifact.title,
    meta: artifact.meta,
    deletedAt: artifact.deletedAt,
  };
}

/** Epics and sprint-plans both carry `links`; a sprint's supporting artifacts resolve the same way. */
async function resolveLinkedArtifacts(
  artifacts: ArtifactSource | FreshSnapshot,
  owners: MirrorArtifact[],
): Promise<MirrorArtifact[]> {
  const ids = new Set<string>();
  for (const owner of owners) {
    const links = owner.meta.links;
    if (!Array.isArray(links)) continue;
    for (const link of links) {
      if (typeof link === 'string') ids.add(link);
    }
  }
  const linked: MirrorArtifact[] = [];
  for (const id of [...ids].sort()) {
    const record = await readLinked(artifacts, id);
    if (record) linked.push(record);
  }
  linked.sort((a, b) => {
    const bySlug = a.slug.localeCompare(b.slug);
    if (bySlug !== 0) return bySlug;
    return a.id.localeCompare(b.id);
  });
  return linked;
}

/** Linked-artifact read through either source; missing and deleted links are skipped like `readById` does. */
async function readLinked(
  artifacts: ArtifactSource | FreshSnapshot,
  id: string,
): Promise<MirrorArtifact | null> {
  if ('byId' in artifacts) {
    const row = artifacts.byId(id);
    return row
      ? { id: row.id, type: row.type, slug: row.slug, title: row.title, meta: row.meta }
      : null;
  }
  try {
    const record = await (artifacts as ArtifactEngine).readById(id);
    const fm = record.frontmatter;
    return { id: fm.id, type: fm.type, slug: fm.slug, title: fm.title, meta: fm.meta };
  } catch (err) {
    if (err instanceof SpegoError && err.code === 'ARTIFACT_NOT_FOUND') return null;
    throw err;
  }
}
