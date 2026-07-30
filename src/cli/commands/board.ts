import type { Command } from 'commander';
import { styleText } from 'node:util';
import { loadBoardState } from '../../delivery/load.js';
import {
  filterMirrorArchived,
  filterMirrorGaps,
  isSatisfied,
  type MirrorBoard,
  type MirrorChange,
  type MirrorInput,
  type MirrorWarning,
} from '../../delivery/mirror.js';
import { renderHeader, renderPanel, renderTable } from '../render.js';
import { deliveryStatusLabel } from '../status.js';
import { runEngineCommand } from '../runtime.js';

interface BoardOptions {
  cwd?: string;
  graph?: boolean;
  gaps?: boolean;
  plain?: boolean;
  archived?: boolean;
}

const BOARD_COLUMNS = ['id', 'change', 'status', 'group', 'blockers', 'gaps', 'missing', 'title'];

export function registerBoard(program: Command): void {
  program
    .command('board')
    .description('Show the delivery board (sprints, blockers, gaps)')
    .option('--graph', 'show dependency graph', false)
    .option('--gaps', 'show gaps, missing artifacts, and blockers', false)
    .option('--plain', 'disable ANSI color in human output', false)
    .option('--archived', 'include archived changes in the ungrouped list', false)
    .option('--cwd <dir>', 'project root')
    .action(async (opts: BoardOptions) => {
      await runEngineCommand({ program, cwd: opts.cwd }, async (engine) => {
        const state = await loadBoardState(engine, opts.cwd);
        const unarchived = opts.archived ? state.board : filterMirrorArchived(state.board);
        const payload = opts.gaps ? filterMirrorGaps(unarchived) : unarchived;
        return {
          payload,
          human: () => {
            if (opts.graph) return renderGraph(payload, state.input);
            if (opts.gaps) return renderGaps(payload);
            return renderBoard(payload, opts.plain === true);
          },
        };
      });
    });
}

interface BoardSection {
  title: string;
  table: string;
  styleRows: (table: string) => string;
}

function renderBoard(board: MirrorBoard, plain: boolean): string {
  const idBySlug = idMapFor(board);
  const lines = [renderHeader('📋', 'Delivery board'), ''];
  const sections = buildChangeSections(board, idBySlug);
  const warningsTable = board.warnings.length > 0
    ? renderTable(['code', 'message'], board.warnings.map((warning) => [warning.code, warning.message]), { maxWidth: 80 })
    : null;
  const width = Math.max(
    0,
    ...sections.map((section) => blockWidth(section.table)),
    warningsTable ? blockWidth(warningsTable) : 0,
  );

  if (sections.length === 0) {
    lines.push('No groomed delivery board.');
  } else {
    for (const section of sections) {
      lines.push(renderPanelSection(section.title, section.table, width, plain, section.styleRows));
      lines.push('');
    }
  }
  if (warningsTable) {
    lines.push(renderPanelSection('Warnings', warningsTable, width, plain));
    lines.push('');
  }
  lines.push(nextLine(board));
  return lines.filter((line, index, all) => !(line === '' && all[index - 1] === '')).join('\n');
}

function buildChangeSections(board: MirrorBoard, idBySlug: Map<string, string>): BoardSection[] {
  const sections: BoardSection[] = [];
  for (const sprint of board.sprints) {
    sections.push({
      title: `Sprint ${sprint.slug} — ${sprint.title} (${sprint.status})`,
      table: renderTable(BOARD_COLUMNS, sprint.changes.map((change) => changeRow(change, idBySlug)), { maxWidth: 36 }),
      styleRows: (table) => styleChangeRows(table, sprint.changes),
    });
  }
  if (board.ungrouped.length > 0) {
    sections.push({
      title: 'Ungrouped',
      table: renderTable(BOARD_COLUMNS, board.ungrouped.map((change) => changeRow(change, idBySlug)), { maxWidth: 36 }),
      styleRows: (table) => styleChangeRows(table, board.ungrouped),
    });
  }
  return sections;
}

/** Longest line in a plain (unstyled) block; measure before applying ANSI. */
function blockWidth(text: string): number {
  return text.split('\n').reduce((max, line) => Math.max(max, line.length), 0);
}

/** Wraps `table` in a panel with `title` embedded in the top rail, styled after the width/layout math runs on the plain title. */
function renderPanelSection(
  title: string,
  table: string,
  width: number,
  plain: boolean,
  styleRows?: (table: string) => string,
): string {
  const body = plain || !styleRows ? table : styleRows(table);
  const panel = renderPanel(title, body.split('\n'), { width });
  if (plain) return panel;
  const lines = panel.split('\n');
  lines[0] = lines[0]!.replace(title, () => styleText(['bold', 'underline'], title));
  return lines.join('\n');
}

/** Table body rows line up 1:1 with `changes`: line i+2 is changes[i]. A satisfied row (done/completed) is struck through even if it still carries a blocker. */
function styleChangeRows(table: string, changes: MirrorChange[]): string {
  const lines = table.split('\n');
  const header = lines.slice(0, 2);
  const body = lines.slice(2).map((line, index) => {
    const change = changes[index];
    if (!change) return line;
    if (isSatisfied(change.status)) return styleText(['strikethrough', 'dim'], line);
    if (change.blockers.length > 0) return styleText('dim', line);
    return line;
  });
  return [...header, ...body].join('\n');
}

function renderGraph(board: MirrorBoard, input: MirrorInput): string {
  const depsBySlug = dependencyMap(input);
  const changes = allChanges(board);
  const idBySlug = idMapFor(board);
  const visible = new Set(changes.map((change) => change.slug));
  const rows: string[][] = [];
  for (const change of changes) {
    const deps = depsBySlug.get(change.slug) ?? [];
    const blockers = formatBlockers(change, idBySlug);
    if (deps.length === 0) {
      rows.push([change.id, change.slug, '—', blockers, deliveryStatusLabel(change.status)]);
      continue;
    }
    for (const dep of deps) {
      rows.push([change.id, change.slug, visible.has(dep) ? dep : `${dep} (missing)`, blockers, deliveryStatusLabel(change.status)]);
    }
  }
  const lines = [renderHeader('🕸️', 'Dependency graph'), ''];
  if (rows.length === 0) lines.push('No dependency edges.');
  else lines.push(renderTable(['id', 'change', 'depends on', 'blockers', 'status'], rows, { maxWidth: 48 }));
  lines.push('');
  appendWarnings(lines, board.warnings);
  lines.push(nextLine(board));
  return lines.filter((line, index, all) => !(line === '' && all[index - 1] === '')).join('\n');
}

function renderGaps(board: MirrorBoard): string {
  const idBySlug = idMapFor(board);
  const rows: string[][] = [];
  for (const sprint of board.sprints) {
    for (const change of sprint.changes) {
      rows.push([change.id, change.slug, sprint.slug, formatBlockers(change, idBySlug), formatGaps(change), change.missing.join(', ') || '—']);
    }
  }
  for (const change of board.ungrouped) {
    rows.push([change.id, change.slug, '—', formatBlockers(change, idBySlug), formatGaps(change), change.missing.join(', ') || '—']);
  }
  const lines = [renderHeader('🧩', 'Delivery gaps'), ''];
  if (rows.length === 0) lines.push('No gaps, missing artifacts, or blockers.');
  else lines.push(renderTable(['id', 'change', 'sprint', 'blockers', 'gaps', 'missing'], rows, { maxWidth: 48 }));
  lines.push('');
  appendWarnings(lines, board.warnings);
  lines.push(nextLine(board));
  return lines.filter((line, index, all) => !(line === '' && all[index - 1] === '')).join('\n');
}

function changeRow(change: MirrorChange, idBySlug: Map<string, string>): string[] {
  return [
    change.id,
    change.slug,
    deliveryStatusLabel(change.status),
    change.group,
    formatBlockers(change, idBySlug),
    formatGaps(change),
    change.missing.join(', ') || '—',
    change.title,
  ];
}

function idMapFor(board: MirrorBoard): Map<string, string> {
  return new Map(allChanges(board).map((change) => [change.slug, change.id]));
}

function formatBlockers(change: MirrorChange, idBySlug: Map<string, string>): string {
  if (change.blockers.length === 0) return '—';
  return change.blockers.map((token) => idBySlug.get(token) ?? token).join(', ');
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
