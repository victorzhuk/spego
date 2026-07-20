import path from 'node:path';
import type { Command } from 'commander';
import type { ArtifactEngine } from '../../artifacts/engine.js';
import type { IndexedArtifact } from '../../index/indexer.js';
import { resolveAdapter } from '../../delivery/index.js';
import { discoverChanges } from '../../delivery/openspec-discover.js';
import {
  deriveMirror,
  filterMirrorGaps,
  type MirrorArtifact,
  type MirrorBoard,
  type MirrorChange,
  type MirrorInput,
  type MirrorWarning,
} from '../../delivery/mirror.js';
import type { DeliveryAdapter, DeliveryEpicLink, DeliveryStatus } from '../../delivery/types.js';
import { SpegoError } from '../../errors.js';
import { readConfig } from '../../workspace/config.js';
import { resolveWorkspacePaths } from '../../workspace/paths.js';
import { renderHeader, renderTable } from '../render.js';
import { runEngineCommand } from '../runtime.js';

interface MirrorCommandState {
  input: MirrorInput;
  board: MirrorBoard;
}

interface MirrorOptions {
  cwd?: string;
  graph?: boolean;
  gaps?: boolean;
}

export function registerMirror(program: Command): void {
  program
    .command('mirror')
    .description('Show delivery mirror board')
    .option('--graph', 'show dependency graph', false)
    .option('--gaps', 'show gaps, missing artifacts, and blockers', false)
    .option('--cwd <dir>', 'project root')
    .action(async (opts: MirrorOptions) => {
      await runEngineCommand({ program, cwd: opts.cwd }, async (engine) => {
        const state = await loadMirrorState(engine, opts.cwd);
        const payload = opts.gaps ? filterMirrorGaps(state.board) : state.board;
        return {
          payload,
          human: () => {
            if (opts.graph) return renderGraph(payload, state.input);
            if (opts.gaps) return renderGaps(payload);
            return renderBoard(payload);
          },
        };
      });
    });
}

async function loadMirrorState(engine: ArtifactEngine, cwd: string | undefined): Promise<MirrorCommandState> {
  const projectRoot = path.resolve(cwd ?? process.cwd());
  const wsPaths = resolveWorkspacePaths(projectRoot);
  const config = await readConfig(wsPaths.configPath);
  const adapter = resolveAdapter(projectRoot, config);
  try {
    const input = await collectMirrorInput(engine, projectRoot, adapter);
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
      };
      return { input, board: deriveMirror(input) };
    }
    throw err;
  }
}

async function collectMirrorInput(
  engine: ArtifactEngine,
  projectRoot: string,
  adapter: DeliveryAdapter,
): Promise<MirrorInput> {
  const adapterEpics = await adapter.listEpics();
  const discovered = await discoverChanges(projectRoot);
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

  const epics = engine.list({ type: 'epic' }).map(indexedArtifact);
  const sprints = engine.list({ type: 'sprint-plan' }).map(indexedArtifact);
  const linkedArtifacts = await resolveLinkedArtifacts(engine, epics);
  return { changes, epics, sprints, linkedArtifacts, warnings: [] };
}

function sourceChange(slug: string, archived: boolean, epic: DeliveryEpicLink | undefined) {
  const status: DeliveryStatus = archived ? 'completed' : (epic?.status ?? 'unknown');
  return {
    slug,
    title: epic?.title ?? slug,
    status,
    archived,
    warnings: epic?.warnings,
  };
}

function indexedArtifact(artifact: IndexedArtifact): MirrorArtifact {
  return {
    id: artifact.id,
    type: artifact.type,
    slug: artifact.slug,
    title: artifact.title,
    meta: artifact.meta,
  };
}

async function resolveLinkedArtifacts(
  engine: ArtifactEngine,
  epics: MirrorArtifact[],
): Promise<MirrorArtifact[]> {
  const ids = new Set<string>();
  for (const epic of epics) {
    const links = epic.meta.links;
    if (!Array.isArray(links)) continue;
    for (const link of links) {
      if (typeof link === 'string') ids.add(link);
    }
  }
  const artifacts: MirrorArtifact[] = [];
  for (const id of [...ids].sort()) {
    try {
      const record = await engine.readById(id);
      artifacts.push({
        id: record.frontmatter.id,
        type: record.frontmatter.type,
        slug: record.frontmatter.slug,
        title: record.frontmatter.title,
        meta: record.frontmatter.meta,
      });
    } catch (err) {
      if (err instanceof SpegoError && err.code === 'ARTIFACT_NOT_FOUND') continue;
      throw err;
    }
  }
  artifacts.sort((a, b) => {
    const bySlug = a.slug.localeCompare(b.slug);
    if (bySlug !== 0) return bySlug;
    return a.id.localeCompare(b.id);
  });
  return artifacts;
}

function renderBoard(board: MirrorBoard): string {
  const lines = [renderHeader('🪞', 'Mirror board'), ''];
  if (board.sprints.length === 0 && board.ungrouped.length === 0) {
    lines.push('No groomed delivery board.');
  }
  for (const sprint of board.sprints) {
    lines.push(`Sprint ${sprint.slug} — ${sprint.title} (${sprint.status})`);
    lines.push(renderTable(['change', 'status', 'blockers', 'gaps', 'missing', 'title'], sprint.changes.map(changeRow), { maxWidth: 36 }));
    lines.push('');
  }
  if (board.ungrouped.length > 0) {
    lines.push('Ungrouped');
    lines.push(renderTable(['change', 'status', 'blockers', 'gaps', 'missing', 'title'], board.ungrouped.map(changeRow), { maxWidth: 36 }));
    lines.push('');
  }
  appendWarnings(lines, board.warnings);
  lines.push(nextLine(board));
  return lines.filter((line, index, all) => !(line === '' && all[index - 1] === '')).join('\n');
}

function renderGraph(board: MirrorBoard, input: MirrorInput): string {
  const depsBySlug = dependencyMap(input);
  const visible = new Set(allChanges(board).map((change) => change.slug));
  const rows: string[][] = [];
  for (const change of allChanges(board)) {
    const deps = depsBySlug.get(change.slug) ?? [];
    if (deps.length === 0) {
      rows.push([change.slug, '—', change.blockers.join(', ') || '—', change.status]);
      continue;
    }
    for (const dep of deps) {
      rows.push([change.slug, visible.has(dep) ? dep : `${dep} (missing)`, change.blockers.join(', ') || '—', change.status]);
    }
  }
  const lines = [renderHeader('🕸️', 'Mirror dependency graph'), ''];
  if (rows.length === 0) lines.push('No dependency edges.');
  else lines.push(renderTable(['change', 'depends on', 'blockers', 'status'], rows, { maxWidth: 48 }));
  lines.push('');
  appendWarnings(lines, board.warnings);
  lines.push(nextLine(board));
  return lines.filter((line, index, all) => !(line === '' && all[index - 1] === '')).join('\n');
}

function renderGaps(board: MirrorBoard): string {
  const rows: string[][] = [];
  for (const sprint of board.sprints) {
    for (const change of sprint.changes) {
      rows.push([change.slug, sprint.slug, change.blockers.join(', ') || '—', formatGaps(change), change.missing.join(', ') || '—']);
    }
  }
  for (const change of board.ungrouped) {
    rows.push([change.slug, '—', change.blockers.join(', ') || '—', formatGaps(change), change.missing.join(', ') || '—']);
  }
  const lines = [renderHeader('🧩', 'Mirror gaps'), ''];
  if (rows.length === 0) lines.push('No gaps, missing artifacts, or blockers.');
  else lines.push(renderTable(['change', 'sprint', 'blockers', 'gaps', 'missing'], rows, { maxWidth: 48 }));
  lines.push('');
  appendWarnings(lines, board.warnings);
  lines.push(nextLine(board));
  return lines.filter((line, index, all) => !(line === '' && all[index - 1] === '')).join('\n');
}

function changeRow(change: MirrorChange): string[] {
  return [
    change.slug,
    change.status,
    change.blockers.join(', ') || '—',
    formatGaps(change),
    change.missing.join(', ') || '—',
    change.title,
  ];
}

function formatGaps(change: MirrorChange): string {
  if (change.gaps.length === 0) return '—';
  return change.gaps.map((gap) => gap.note ? `${gap.flag}: ${gap.note}` : gap.flag).join(', ');
}

function appendWarnings(lines: string[], warnings: MirrorWarning[]): void {
  if (warnings.length === 0) return;
  lines.push('Warnings');
  lines.push(renderTable(['code', 'message'], warnings.map((warning) => [warning.code, warning.message]), { maxWidth: 80 }));
  lines.push('');
}

function nextLine(board: MirrorBoard): string {
  if (board.next) {
    return `Suggestion: ${board.next.change} in ${board.next.sprint} — ${board.next.reason}.`;
  }
  return 'Suggestion: groom pending changes into an active sprint-plan.';
}

function dependencyMap(input: MirrorInput): Map<string, string[]> {
  const deps = new Map<string, string[]>();
  const epics = [...input.epics].sort((a, b) => a.slug.localeCompare(b.slug));
  for (const epic of epics) {
    const raw = epic.meta.deps;
    if (!Array.isArray(raw)) {
      deps.set(epic.slug, []);
      continue;
    }
    const values = raw.filter((dep): dep is string => typeof dep === 'string');
    deps.set(epic.slug, [...new Set(values)].sort());
  }
  return deps;
}

function allChanges(board: MirrorBoard): MirrorChange[] {
  const changes: MirrorChange[] = [];
  for (const sprint of board.sprints) changes.push(...sprint.changes);
  changes.push(...board.ungrouped);
  return changes;
}
