import type { Command } from 'commander';
import { loadBoardState } from '../../delivery/load.js';
import {
  filterMirrorGaps,
  type MirrorBoard,
  type MirrorChange,
  type MirrorInput,
  type MirrorWarning,
} from '../../delivery/mirror.js';
import { renderHeader, renderTable } from '../render.js';
import { runEngineCommand } from '../runtime.js';

interface BoardOptions {
  cwd?: string;
  graph?: boolean;
  gaps?: boolean;
}

export function registerBoard(program: Command): void {
  program
    .command('board')
    .description('Show the delivery board (sprints, blockers, gaps)')
    .option('--graph', 'show dependency graph', false)
    .option('--gaps', 'show gaps, missing artifacts, and blockers', false)
    .option('--cwd <dir>', 'project root')
    .action(async (opts: BoardOptions) => {
      await runEngineCommand({ program, cwd: opts.cwd }, async (engine) => {
        const state = await loadBoardState(engine, opts.cwd);
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

function renderBoard(board: MirrorBoard): string {
  const lines = [renderHeader('🪞', 'Delivery board'), ''];
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
  const lines = [renderHeader('🕸️', 'Dependency graph'), ''];
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
  const lines = [renderHeader('🧩', 'Delivery gaps'), ''];
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
