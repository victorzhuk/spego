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
  type MirrorSprint,
  type MirrorWarning,
} from '../../delivery/mirror.js';
import { deriveSyncPlan } from '../../delivery/sync.js';
import { applySyncPlan, resolveEpicAdapter } from './sync.js';
import { columnWidths, padRight, renderHeader, renderPanel, renderTable } from '../render.js';
import { deliveryStatusLabel } from '../status.js';
import { runEngineCommand } from '../runtime.js';

interface BoardOptions {
  cwd?: string;
  graph?: boolean;
  gaps?: boolean;
  plain?: boolean;
  archived?: boolean;
  closed?: boolean;
  sync?: boolean;
}

const BOARD_COLUMNS = ['id', 'change', 'status', 'group', 'signals'];
const DEFAULT_TERMINAL_WIDTH = 120;
const PANEL_CHROME_WIDTH = 4; // "│ " prefix + " │" suffix

export function registerBoard(program: Command): void {
  program
    .command('board')
    .description('Show the delivery board (sprints, blockers, gaps)')
    .option('--graph', 'show dependency graph', false)
    .option('--gaps', 'show gaps, missing artifacts, and blockers', false)
    .option('--plain', 'disable ANSI color in human output', false)
    .option('--archived', 'include archived changes in the ungrouped list', false)
    .option('--closed', 'show closed and completed sprints (does not affect --archived, which only controls the ungrouped list)', false)
    .option('--sync', 'apply the mechanical reconciliation plan before rendering', false)
    .option('--cwd <dir>', 'project root')
    .action(async (opts: BoardOptions) => {
      await runEngineCommand({ program, cwd: opts.cwd }, async (engine) => {
        let state = await loadBoardState(engine, opts.cwd);
        if (opts.sync) {
          const syncPlan = deriveSyncPlan(state.board, state.input);
          if (syncPlan.actions.length > 0) {
            const adapter = syncPlan.actions.some((action) => action.kind === 'create-epic')
              ? await resolveEpicAdapter(engine)
              : null;
            await applySyncPlan(engine, syncPlan, adapter);
            state = await loadBoardState(engine, opts.cwd);
          }
        }
        const unarchived = opts.archived ? state.board : filterMirrorArchived(state.board);
        const payload = opts.gaps ? filterMirrorGaps(unarchived) : unarchived;
        return {
          payload,
          human: () => {
            if (opts.graph) return renderGraph(payload, state.input);
            if (opts.gaps) return renderGaps(payload);
            return renderBoard(payload, state.input, opts.plain === true, opts.closed === true, terminalWidth());
          },
        };
      });
    });
}

function terminalWidth(): number {
  return process.stdout.columns ?? (Number(process.env.COLUMNS) || DEFAULT_TERMINAL_WIDTH);
}

/** True when every change is satisfied and the sprint is either derived-complete or explicitly closed — an empty closed sprint hides, one still holding pending changes stays visible. */
function isFinished(sprint: MirrorSprint): boolean {
  return sprint.changes.every((change) => isSatisfied(change.status)) && (sprint.complete || sprint.status === 'closed');
}

interface BoardSection {
  title: string;
  changes: MirrorChange[];
  finished: boolean;
}

function renderBoard(board: MirrorBoard, input: MirrorInput, plain: boolean, showClosed: boolean, budget: number): string {
  const lines = [renderHeader('📋', 'Delivery board'), ''];
  const allSections = buildChangeSections(board);
  const sections = showClosed ? allSections : allSections.filter((section) => !section.finished);
  const hiddenCount = allSections.length - sections.length;

  const totalWidth = Math.max(0, budget - PANEL_CHROME_WIDTH);
  const rowsByColumn = sections.flatMap((section) => section.changes.map((change) => changeRow(change)));
  const widths = columnWidths(BOARD_COLUMNS, rowsByColumn, { maxWidth: 36, totalWidth, protect: [1] });
  const warningRows = aggregateWarningRows(board.warnings);
  const warningWidths = columnWidths(['code', 'message'], warningRows, { maxWidth: totalWidth, totalWidth });
  const panelWidth = Math.max(tableWidth(widths), board.warnings.length > 0 ? tableWidth(warningWidths) : 0);
  // Whichever table computed narrower than the shared panel grows its last (free-text) column
  // to close the gap, instead of leaving blank space inside the panel.
  growLastColumn(widths, panelWidth);
  if (board.warnings.length > 0) growLastColumn(warningWidths, panelWidth);

  if (sections.length === 0 && hiddenCount === 0) {
    lines.push('No groomed delivery board.');
  } else {
    for (const section of sections) {
      const table = renderTable(BOARD_COLUMNS, section.changes.map((change) => changeRow(change)), { widths });
      lines.push(renderPanelSection(section.title, table, panelWidth, plain, section.finished, (l) => styleChangeRows(l, section.changes)));
      lines.push('');
    }
  }

  if (board.warnings.length > 0) {
    const warningsTable = renderTable(['code', 'message'], warningRows, { widths: warningWidths, wrapLastColumn: true });
    lines.push(renderPanelSection('Warnings', warningsTable, panelWidth, plain, false));
    lines.push('');
  }

  if (hiddenCount > 0) {
    const noun = hiddenCount === 1 ? 'sprint' : 'sprints';
    const note = `${hiddenCount} closed ${noun} hidden (--closed to show).`;
    lines.push(plain ? note : styleText('dim', note));
    lines.push('');
  }
  const renderedChanges = sections.flatMap((section) => section.changes);
  if (renderedChanges.some((change) => change.blockers.length + change.gaps.length + change.missing.length > 0)) {
    const note = 'Detail: spego board --gaps';
    lines.push(plain ? note : styleText('dim', note));
  }
  const syncActions = deriveSyncPlan(board, input).actions.length;
  if (syncActions > 0) {
    const noun = syncActions === 1 ? 'fix' : 'fixes';
    const note = `${syncActions} mechanical ${noun} — run spego sync`;
    lines.push(plain ? note : styleText('dim', note));
  }
  lines.push(nextLine(board));
  return lines.filter((line, index, all) => !(line === '' && all[index - 1] === '')).join('\n');
}

function buildChangeSections(board: MirrorBoard): BoardSection[] {
  const sections: BoardSection[] = board.sprints.map((sprint) => ({
    title: `${sprint.title} · ${sprint.status} · ${sprint.slug}`,
    changes: sprint.changes,
    finished: isFinished(sprint),
  }));
  if (board.ungrouped.length > 0) {
    sections.push({ title: 'Ungrouped', changes: board.ungrouped, finished: false });
  }
  return sections;
}

/** Total rendered width of a table built from `widths`: columns plus the two-space separators between them. */
function tableWidth(widths: number[]): number {
  return widths.reduce((sum, w) => sum + w, 0) + 2 * Math.max(0, widths.length - 1);
}

/** Widens the last column of `widths` in place to make the table reach `targetWidth`; a no-op once it already does. */
function growLastColumn(widths: number[], targetWidth: number): void {
  const gap = targetWidth - tableWidth(widths);
  if (gap > 0 && widths.length > 0) widths[widths.length - 1]! += gap;
}

/**
 * Wraps `table` in a panel with `title` embedded in the top rail. Every line
 * is padded to `width` before `styleRows` runs, so strikethrough/dim spans
 * the full row instead of stopping where ANSI-inflated `.length` would
 * otherwise defeat `renderPanel`'s own padding. A `finished` section renders
 * fully dim with no bold/underline title — the muted state for a closed
 * sprint shown only via `--closed`.
 */
function renderPanelSection(
  title: string,
  table: string,
  width: number,
  plain: boolean,
  finished: boolean,
  styleRows?: (lines: string[]) => string[],
): string {
  // Pad on the unstyled line: styling happens after, so padRight measures raw length and the right rail stays aligned.
  const padded = table.split('\n').map((line) => padRight(line, width));
  const body = plain
    ? padded
    : finished
      ? padded.map((line) => styleText('dim', line))
      : (styleRows?.(padded) ?? padded);
  const panel = renderPanel(title, body, { width });
  if (plain) return panel;
  const lines = panel.split('\n');
  lines[0] = lines[0]!.replace(title, () => styleText(finished ? 'dim' : 'bold', title));
  return lines.join('\n');
}

/** Body lines line up 1:1 with `changes`: line i+2 is changes[i]. A satisfied row (done/completed) is struck through even if it still carries a blocker. */
function styleChangeRows(lines: string[], changes: MirrorChange[]): string[] {
  const header = lines.slice(0, 2);
  const body = lines.slice(2).map((line, index) => {
    const change = changes[index];
    if (!change) return line;
    if (isSatisfied(change.status)) return styleText(['strikethrough', 'dim'], line);
    if (change.blockers.length > 0) return styleText('dim', line);
    return line;
  });
  return [...header, ...body];
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

function changeRow(change: MirrorChange): string[] {
  return [
    change.id,
    change.slug,
    deliveryStatusLabel(change.status),
    change.group,
    formatSignals(change),
  ];
}

/**
 * Collapse the board's per-fact warnings into the rows the human board prints,
 * one row per repair. Grouping is keyed per code: `orphan-epic` by reason (a
 * `missing` epic and an `archived` one never merge — different repairs),
 * `dangling-dep`/`out-of-order-dep` by the dependent change, and
 * `closable-sprint`/`dep-cycle`/`ungroomed-change` by
 * code. `adapter-warning`/`adapter-unavailable` pass through untouched. A
 * single-member group keeps its original message; a multi-member group lists
 * every affected slug. The JSON payload stays per-fact — this only shapes the
 * human table.
 */
export function aggregateWarningRows(warnings: MirrorWarning[]): Array<[string, string]> {
  const groups = new Map<string, MirrorWarning[]>();
  const order: Array<{ code: string; message?: string; key?: string }> = [];
  for (const warning of warnings) {
    if (warning.code === 'adapter-warning' || warning.code === 'adapter-unavailable') {
      order.push({ code: warning.code, message: warning.message });
      continue;
    }
    const key = `${warning.code}::${warningDiscriminator(warning)}`;
    let members = groups.get(key);
    if (!members) {
      members = [];
      groups.set(key, members);
      order.push({ code: warning.code, key });
    }
    members.push(warning);
  }
  return order.map((slot) =>
    slot.message !== undefined
      ? [slot.code, slot.message]
      : renderWarningGroup(slot.code, groups.get(slot.key!)!),
  );
}

function warningDiscriminator(warning: MirrorWarning): string {
  const details = warning.details ?? {};
  switch (warning.code) {
    case 'orphan-epic':
      return `reason:${details.reason ?? ''}`;
    case 'dangling-dep':
    case 'out-of-order-dep':
      return `change:${details.change ?? ''}`;
    default:
      return '';
  }
}

function renderWarningGroup(code: string, members: MirrorWarning[]): [string, string] {
  if (members.length === 1) return [code, members[0]!.message];
  const changes = uniqueStrings(members.map((m) => (m.details ?? {}).change));
  const first = members[0]!.details ?? {};
  switch (code) {
    case 'orphan-epic':
      return first.reason === 'archived'
        ? [code, `Epics ${quoteSlugs(changes)} point at archived OpenSpec changes.`]
        : [code, `Epics ${quoteSlugs(changes)} do not resolve to an OpenSpec change.`];
    case 'closable-sprint': {
      const sprints = uniqueStrings(members.map((m) => (m.details ?? {}).sprint));
      return [code, `Sprints ${quoteSlugs(sprints)} have no pending changes and can be closed.`];
    }
    case 'dep-cycle':
      return [code, `Changes ${quoteSlugs(changes)} are part of a dependency cycle.`];
    case 'dangling-dep': {
      const deps = uniqueStrings(members.map((m) => (m.details ?? {}).dep));
      return [code, `Change "${first.change}" depends on unknown changes: ${quoteSlugs(deps)}.`];
    }
    case 'out-of-order-dep': {
      const deps = uniqueStrings(members.map((m) => (m.details ?? {}).dep));
      return [code, `Change "${first.change}" depends on ${quoteSlugs(deps)}, each scheduled in a later sprint.`];
    }
    default:
      return [code, `Active changes ${quoteSlugs(changes)} have no epic artifacts.`];
  }
}

/** Deduplicate `values` (coerced to strings), preserving first-seen order. */
function uniqueStrings(values: unknown[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const text = String(value);
    if (!seen.has(text)) {
      seen.add(text);
      out.push(text);
    }
  }
  return out;
}

/** Quote each slug and join with commas: `["a", "b"]` → `"a", "b"`. */
function quoteSlugs(slugs: string[]): string {
  return slugs.map((slug) => `"${slug}"`).join(', ');
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

function formatSignals(change: MirrorChange): string {
  const parts: string[] = [];
  if (change.blockers.length > 0) parts.push(`${change.blockers.length} blk`);
  if (change.gaps.length > 0) parts.push(`${change.gaps.length} gap`);
  if (change.missing.length > 0) parts.push(`${change.missing.length} mis`);
  return parts.length === 0 ? '—' : parts.join(' · ');
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
