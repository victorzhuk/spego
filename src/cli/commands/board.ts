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
  type MirrorSourceChange,
  type MirrorSprint,
  type MirrorWarning,
} from '../../delivery/mirror.js';
import { deriveSyncPlan } from '../../delivery/sync.js';
import { applySyncPlan, resolveEpicAdapter } from './sync.js';
import { columnWidths, padRight, renderHeader, renderPanel, renderTable, truncate } from '../render.js';
import { deliveryStatusLabel } from '../status.js';
import { runEngineCommand } from '../runtime.js';

interface BoardOptions {
  cwd?: string;
  graph?: boolean;
  gaps?: boolean;
  plain?: boolean;
  nerdFont?: boolean;
  archived?: boolean;
  closed?: boolean;
  sync?: boolean;
}

const BOARD_COLUMNS = ['id', 'change', 'status', 'tasks', 'plan', 'signals'];
const PRICED_BOARD_COLUMNS = ['id', 'change', 'status', 'tasks', 'plan', 'hours', 'signals'];
const DEFAULT_TERMINAL_WIDTH = 120;
const PANEL_CHROME_WIDTH = 4; // "│ " prefix + " │" suffix

export function registerBoard(program: Command): void {
  program
    .command('board')
    .description('Show the delivery board (sprints, blockers, gaps)')
    .option('--graph', 'show dependency graph', false)
    .option('--gaps', 'show gaps, missing artifacts, and blockers', false)
    .option('--plain', 'disable ANSI color in human output', false)
    .option('--nerd-font', 'render status icons with Nerd Fonts glyphs', false)
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
            return renderBoard(payload, state.input, opts.plain === true, opts.nerdFont === true, opts.closed === true, terminalWidth());
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

function renderBoard(board: MirrorBoard, input: MirrorInput, plain: boolean, nerdFont: boolean, showClosed: boolean, budget: number): string {
  const priced = input.flows !== undefined;
  const columns = priced ? PRICED_BOARD_COLUMNS : BOARD_COLUMNS;
  const allSections = buildChangeSections(board);
  const sections = showClosed ? allSections : allSections.filter((section) => !section.finished);
  const hiddenCount = allSections.length - sections.length;
  const sourcesBySlug = new Map(input.changes.map((source) => [source.slug, source]));
  const icons = plain ? undefined : statusIcons(nerdFont);
  const planGlyphs = plain ? undefined : planIcons(nerdFont);

  const totalWidth = Math.max(0, budget - PANEL_CHROME_WIDTH);
  const row = (change: MirrorChange) => changeRow(change, priced, sourcesBySlug.get(change.slug), icons, planGlyphs);
  const rowsByColumn = sections.flatMap((section) => section.changes.map(row));
  const widths = columnWidths(columns, rowsByColumn, { maxWidth: 36, totalWidth, protect: [1] });
  const warningRows = aggregateWarningRows(board.warnings);
  const warningWidths = columnWidths(['code', 'message'], warningRows, { maxWidth: totalWidth, totalWidth });
  // Every panel — each sprint's table, Warnings, and the title rail — shares one width, capped
  // at the terminal budget. A table or title narrower than that shared width is right-padded
  // with plain blank space by `renderPanelSection`, not stretched: no individual table column
  // grows to close the gap, so a long Warnings message never blows up the `signals` divider.
  const titleWidths = sections.map((section) => section.title.length + 3);
  if (board.warnings.length > 0) titleWidths.push('Warnings'.length + 3);
  const panelWidth = Math.max(
    tableWidth(widths),
    board.warnings.length > 0 ? tableWidth(warningWidths) : 0,
    Math.min(Math.max(0, ...titleWidths), totalWidth),
  );

  const renderedChanges = sections.flatMap((section) => section.changes);
  const heading = boardHeading(panelWidth + PANEL_CHROME_WIDTH, plain);
  const lines = [...heading];
  const headingLineCount = lines.length;
  if (icons && renderedChanges.length > 0) lines.push(...statusLegend(renderedChanges, icons, planGlyphs, panelWidth + PANEL_CHROME_WIDTH));

  if (sections.length === 0 && hiddenCount === 0) {
    lines.push('No groomed delivery board.');
  } else {
    for (const section of sections) {
      const table = renderTable(columns, section.changes.map(row), { widths });
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
  if (renderedChanges.some((change) => change.blockers.length + change.gaps.length + change.missing.length > 0)) {
    const note = 'Detail: spego board --gaps';
    lines.push(plain ? note : styleText('dim', note));
  }
  if (renderedChanges.some((change) => change.rung === 'observed')) {
    const note = '* observed — median of recorded runs';
    lines.push(plain ? note : styleText('dim', note));
  }
  if (renderedChanges.some((change) => change.rung === 'planned')) {
    const note = '† planned — the plan\'s chunk count at the measured cost per chunk';
    lines.push(plain ? note : styleText('dim', note));
  }
  const syncActions = deriveSyncPlan(board, input).actions.length;
  if (syncActions > 0) {
    const noun = syncActions === 1 ? 'fix' : 'fixes';
    const note = `${syncActions} mechanical ${noun} — run spego sync`;
    lines.push(plain ? note : styleText('dim', note));
  }
  lines.push(nextLine(board));
  // The blank-line dedupe must not eat the heading block's own blank-line margins.
  const body = lines.slice(headingLineCount).filter((line, index, all) => !(line === '' && all[index - 1] === ''));
  // Swap the archived placeholder in only after layout, styling, and join are done.
  return [...lines.slice(0, headingLineCount), ...body].join('\n').split(PORTABLE_COMPLETED_TOKEN).join(PORTABLE_TRASH);
}

/**
 * The `📋 Delivery board` heading, centered over the full rendered panel width
 * (`panelWidth + 4`). The emoji occupies two terminal cells, so the visible
 * heading width is `2 + 1 + label.length`; padding clamps at zero on narrow
 * terminals. Normal output styles the heading bold+underline; `--plain` gets a
 * literal, aligned underline rule instead. Either way the block carries one
 * empty line before and after it.
 */
function boardHeading(fullWidth: number, plain: boolean): string[] {
  const label = 'Delivery board';
  const visible = 2 + 1 + label.length;
  const pad = ' '.repeat(Math.max(0, Math.floor((fullWidth - visible) / 2)));
  if (plain) {
    return ['', pad + `📋 ${label}`, pad + '─'.repeat(visible), ''];
  }
  return ['', pad + styleText(['bold', 'underline'], `📋 ${label}`), ''];
}

/** Real portable archived trash glyph: VS16-selected, 3 UTF-16 units but one terminal cell. */
const PORTABLE_TRASH = '🗑\u{FE0E}';
// Layout math counts UTF-16 units, so the archived slot renders a one-code-unit
// NUL placeholder during layout; renderBoard swaps in PORTABLE_TRASH after
// joining, so the glyph never skews column widths or the NUL reaches stdout.
const PORTABLE_COMPLETED_TOKEN = '\u0000';

const PORTABLE_STATUS_ICONS: Record<string, string> = {
  backlog: '○',
  'in-progress': '▶',
  done: '✓',
  completed: PORTABLE_COMPLETED_TOKEN,
  blocked: '×',
  paused: '■',
};

const NERD_STATUS_ICONS: Record<string, string> = {
  backlog: '\u{F10C}',
  'in-progress': '\u{F04B}',
  done: '\u{F00C}',
  completed: '\u{F1F8}',
  blocked: '\u{F05E}',
  paused: '\u{F04D}',
};

/** Plan glyphs read as a fill progression: `—` nothing, `◐` being written, `●` written. */
const PORTABLE_PLAN_ICONS: Record<string, string> = {
  planned: '●',
  planning: '◐',
};

const NERD_PLAN_ICONS: Record<string, string> = {
  planned: '\u{F111}',
  planning: '\u{F042}',
};

function statusIcons(nerdFont: boolean): Record<string, string> {
  return { ...(nerdFont ? NERD_STATUS_ICONS : PORTABLE_STATUS_ICONS), unknown: nerdFont ? '\u{F059}' : '?' };
}

function planIcons(nerdFont: boolean): Record<string, string> {
  return nerdFont ? NERD_PLAN_ICONS : PORTABLE_PLAN_ICONS;
}

const STATUS_LEGEND_LABELS: Record<string, string> = {
  backlog: 'backlog',
  'in-progress': 'in-progress',
  done: 'done',
  completed: 'archived',
  blocked: 'blocked',
  paused: 'paused',
  unknown: 'unknown',
};

const STATUS_LEGEND_ORDER = ['backlog', 'in-progress', 'done', 'completed', 'blocked', 'paused', 'unknown'];

/** Plan states with a glyph, in legend order; `none` has no glyph — it renders `—` like every other absent cell. */
const PLAN_LEGEND_ORDER = ['planned', 'planning'] as const;

/** One compact legend for the statuses and plan states actually rendered, word-wrapped at the board width. */
function statusLegend(changes: MirrorChange[], icons: Record<string, string>, planGlyphs: Record<string, string> | undefined, width: number): string[] {
  const statuses = new Set<string>(changes.map((change) => (icons[change.status] === undefined ? 'unknown' : change.status)));
  const entries = STATUS_LEGEND_ORDER.filter((status) => statuses.has(status))
    .map((status) => `${icons[status]} ${STATUS_LEGEND_LABELS[status]}`);
  if (planGlyphs) {
    // A satisfied change renders `—` in the plan column, so its plan state names no rendered symbol.
    const rendered = new Set(changes.filter((change) => !isSatisfied(change.status)).map((change) => change.planState));
    for (const state of PLAN_LEGEND_ORDER) {
      if (rendered.has(state)) entries.push(`${planGlyphs[state]} ${state}`);
    }
  }
  const joined = entries.join('  ');
  if (joined.length <= width) return [joined];
  const lines: string[] = [];
  let current = '';
  for (const entry of entries) {
    if (current && current.length + 2 + entry.length > width) {
      lines.push(current);
      current = entry;
    } else {
      current = current ? `${current}  ${entry}` : entry;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** `done/total` when both counts exist and the adapter saw a task plan; `—` when missing or unavailable; `0/0` for a known-empty plan. */
function formatTasks(source: MirrorSourceChange | undefined): string {
  if (source === undefined || source.hasTaskPlan === false) return '—';
  if (source.taskCount === undefined || source.tasksDone === undefined) return '—';
  return `${source.tasksDone}/${source.taskCount}`;
}

/**
 * The change's task-plan state: a glyph when colored output renders one and the
 * state names one, the word under `--plain`. A satisfied row's plan is moot,
 * and both no-plan and unknown read `—` — only `--json` spells `none`.
 */
function formatPlan(change: MirrorChange, glyphs: Record<string, string> | undefined): string {
  if (isSatisfied(change.status)) return '—';
  if (change.planState !== 'planned' && change.planState !== 'planning') return '—';
  return glyphs?.[change.planState] ?? change.planState;
}

function buildChangeSections(board: MirrorBoard): BoardSection[] {
  const sections: BoardSection[] = board.sprints.map((sprint) => ({
    title: sprintTitle(sprint),
    changes: sprint.changes,
    finished: isFinished(sprint),
  }));
  if (board.ungrouped.length > 0) {
    sections.push({ title: 'Ungrouped', changes: board.ungrouped, finished: false });
  }
  return sections;
}

/**
 * `<title> · <status> · <slug>`, plus the remaining Flow Estimate when the sprint is priced
 * (`+?` flags pending unpriced changes) and `N mis` when the sprint's own `requires` are
 * unresolved — the same signal the change rows carry, at sprint scope.
 */
function sprintTitle(sprint: MirrorSprint): string {
  let title = `${sprint.title} · ${sprint.status} · ${sprint.slug}`;
  if (sprint.flowTotal !== undefined) {
    const unpriced = (sprint.unpricedPending ?? 0) > 0 ? '+?' : '';
    title += ` · ${formatHours(sprint.flowTotal)}${unpriced}h`;
  }
  if (sprint.missing.length > 0) title += ` · ${sprint.missing.length} mis`;
  return title;
}

/** Total rendered width of a table built from `widths`: columns plus the two-space separators between them. */
function tableWidth(widths: number[]): number {
  return widths.reduce((sum, w) => sum + w, 0) + 2 * Math.max(0, widths.length - 1);
}

/**
 * Wraps `table` in a panel with `title` embedded in the top rail. Every line
 * is padded to `width` before `styleRows` runs, so strikethrough/dim spans
 * the full row instead of stopping where ANSI-inflated `.length` would
 * otherwise defeat `renderPanel`'s own padding. A `finished` section renders
 * fully dim with no bold/underline title — the muted state for a closed
 * sprint shown only via `--closed`. `title` is truncated here, matching
 * `renderPanel`'s own truncation exactly, so the bold/dim `replace` below
 * still finds it — `renderPanel` truncating internally on a mismatched
 * string would leave the title unstyled.
 */
function renderPanelSection(
  title: string,
  table: string,
  width: number,
  plain: boolean,
  finished: boolean,
  styleRows?: (lines: string[]) => string[],
): string {
  const shownTitle = truncate(title, Math.max(0, width - 2));
  // Pad on the unstyled line: styling happens after, so padRight measures raw length and the right rail stays aligned.
  const padded = table.split('\n').map((line) => padRight(line, width));
  const body = plain
    ? padded
    : finished
      ? padded.map((line) => styleText('dim', line))
      : (styleRows?.(padded) ?? padded);
  const panel = renderPanel(shownTitle, body, { width });
  if (plain) return panel;
  const lines = panel.split('\n');
  lines[0] = lines[0]!.replace(shownTitle, () => styleText(finished ? 'dim' : 'bold', shownTitle));
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

function changeRow(change: MirrorChange, priced: boolean, source: MirrorSourceChange | undefined, icons: Record<string, string> | undefined, planGlyphs: Record<string, string> | undefined): string[] {
  const status = icons
    ? icons[change.status] ?? icons.unknown ?? '?'
    : deliveryStatusLabel(change.status);
  const row = [
    change.id,
    change.slug,
    status,
    formatTasks(source),
    formatPlan(change, planGlyphs),
  ];
  if (priced) {
    const estimate = change.flowEstimate === undefined ? '?' : formatHours(change.flowEstimate);
    const mark = change.rung === 'planned' ? '†' : change.rung === 'observed' ? '*' : '';
    row.push(`${estimate}${mark}`);
  }
  row.push(formatSignals(change));
  return row;
}

/** Decimal hours with trailing zeros trimmed: 0.5 → `0.5`, 2 → `2`. */
function formatHours(hours: number): string {
  return String(Math.round(hours * 100) / 100);
}

/**
 * Collapse the board's per-fact warnings into the rows the human board prints,
 * one row per repair. Grouping is keyed per code: `orphan-epic` and
 * `no-task-plan` by reason (a `missing` epic and an `archived` one never merge
 * — different repairs), `dangling-dep`/`out-of-order-dep` by the dependent
 * change, and `closable-sprint`/`dep-cycle`/`ungroomed-change` by
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
    case 'no-task-plan':
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
    case 'stale-profile': {
      const pairs = members.map((m) => {
        const details = m.details ?? {};
        return `${details.flow}/${details.tier} (${details.direction} ×${details.bias})`;
      });
      return [code, `Profiles drifted from recorded runs: ${pairs.join(', ')} — re-groom the tier judgment or reseed.`];
    }
    case 'no-task-plan':
      return first.reason === 'empty'
        ? [code, `Changes ${quoteSlugs(changes)} have a tasks.md with no task items.`]
        : [code, `Changes ${quoteSlugs(changes)} have no tasks.md.`];
    case 'ungroomed-change':
      return [code, `Active changes ${quoteSlugs(changes)} have no epic artifacts.`];
    default:
      return [code, members.map((member) => member.message).join(' ')];
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
