/**
 * Pretty-rendering primitives for the spego CLI human output mode.
 *
 * All functions are pure: string in, string out. They MUST NOT read
 * `process.env`, MUST NOT detect TTY, and MUST NOT emit ANSI color codes.
 * Output is plain text plus a small fixed set of Unicode box-drawing and
 * arrow characters so it stays scannable, copy-pasteable, and stable across
 * terminals.
 */

const DEFAULT_TABLE_MAX_WIDTH = 60;

/** Truncate `value` to fit within `width` characters, appending `…` when cut. */
export function truncate(value: string, width: number): string {
  if (width <= 0) return '';
  if (value.length <= width) return value;
  if (width === 1) return '…';
  return value.slice(0, width - 1) + '…';
}

/** Right-pad `value` with spaces to `width` characters. Strings longer than `width` are returned unchanged. */
export function padRight(value: string, width: number): string {
  if (value.length >= width) return value;
  return value + ' '.repeat(width - value.length);
}

/**
 * Render a bordered key/value summary box using rounded box-drawing characters.
 *
 * ```
 * ╭─ Workspace ─────────────────────────╮
 * │ root    /tmp/proj                   │
 * │ agents  claude                      │
 * ╰─────────────────────────────────────╯
 * ```
 */
export function renderBox(title: string, rows: Array<[string, string]>): string {
  const keyWidth = rows.reduce((m, [k]) => Math.max(m, k.length), 0);
  const valueWidth = rows.reduce((m, [, v]) => Math.max(m, v.length), 0);
  // Inner content width: key + 2 spaces + value
  const contentWidth = Math.max(keyWidth + 2 + valueWidth, title.length + 4);
  const innerWidth = contentWidth + 2; // 1 space padding on each side

  // Title row: `╭─ <title> <N×─>╮`. Body row width is `contentWidth + 4`
  // (`│ ` + content + ` │`); title row width is `5 + title.length + N`,
  // so N = contentWidth - title.length - 1 to keep both rows equal.
  const titleLine = `╭─ ${title} ${'─'.repeat(Math.max(0, contentWidth - title.length - 1))}╮`;
  const bottom = `╰${'─'.repeat(innerWidth)}╯`;

  const body = rows
    .map(([k, v]) => {
      const line = `${padRight(k, keyWidth)}  ${v}`;
      return `│ ${padRight(line, contentWidth)} │`;
    })
    .join('\n');

  return rows.length === 0 ? `${titleLine}\n${bottom}` : `${titleLine}\n${body}\n${bottom}`;
}

const DEFAULT_TABLE_MIN_WIDTH = 6;

/**
 * Compute one width per column: the natural size (header vs. longest cell,
 * default 60), clamped by `opts.maxWidth`.
 *
 * When `opts.totalWidth` is given and the natural widths don't fit within it
 * (accounting for the two-space separator between columns), the currently
 * widest column is shrunk by 1 repeatedly until it fits or every column has
 * hit `opts.minWidth` (default 6). Deterministic and index-stable: ties for
 * "widest" always shrink the lowest index first.
 */
export function columnWidths(
  columns: string[],
  rows: string[][],
  opts: { maxWidth?: number; totalWidth?: number; minWidth?: number } = {},
): number[] {
  const maxWidth = opts.maxWidth ?? DEFAULT_TABLE_MAX_WIDTH;
  const minWidth = opts.minWidth ?? DEFAULT_TABLE_MIN_WIDTH;
  const widths = columns.map((col, i) => {
    const dataMax = rows.reduce((m, r) => Math.max(m, (r[i] ?? '').length), 0);
    const target = Math.max(col.length, dataMax);
    return Math.min(target, maxWidth);
  });

  if (opts.totalWidth === undefined) return widths;

  const separatorWidth = 2 * Math.max(0, columns.length - 1);
  while (widths.reduce((sum, w) => sum + w, 0) + separatorWidth > opts.totalWidth) {
    let widestIndex = -1;
    for (let i = 0; i < widths.length; i++) {
      if (widths[i]! > minWidth && (widestIndex === -1 || widths[i]! > widths[widestIndex]!)) {
        widestIndex = i;
      }
    }
    if (widestIndex === -1) break;
    widths[widestIndex]!--;
  }
  return widths;
}

/**
 * Render an aligned table with a header row separated from data rows by `─`.
 *
 * ```
 * type/slug      rev  title
 * ─────────────  ───  ──────────────
 * prd/test-prd   1    Test PRD
 * ```
 *
 * `opts.maxWidth` caps each column width and truncates longer cells with `…`
 * (default 60). Pass `opts.widths` to reuse widths computed elsewhere (e.g.
 * shared across several tables via `columnWidths`) instead of deriving them
 * from `rows`. An empty `rows` array still renders the header and divider so
 * callers can prepend a "no rows" hint above if they choose.
 */
export function renderTable(
  columns: string[],
  rows: string[][],
  opts: { maxWidth?: number; widths?: number[] } = {},
): string {
  const widths = opts.widths ?? columnWidths(columns, rows, { maxWidth: opts.maxWidth });

  const formatRow = (cells: string[]): string =>
    widths.map((w, i) => padRight(truncate(cells[i] ?? '', w), w)).join('  ').trimEnd();

  const header = formatRow(columns);
  const divider = widths.map((w) => '─'.repeat(w)).join('  ').trimEnd();
  const body = rows.map(formatRow).join('\n');

  return rows.length === 0 ? `${header}\n${divider}` : `${header}\n${divider}\n${body}`;
}

/**
 * Wrap `bodyLines` in a left rail so a group of related lines (e.g. a
 * sprint's title and its change table) reads as one bounded section.
 *
 * ```
 * ╭─ Sprint sprint-1 — Sprint 1 (active) ─────
 * │ id     change   status
 * │ ─────  ───────  ───────────
 * │ c4f2a  add-api  done
 * ╰────────────────────────────────────────────
 * ```
 *
 * `opts.width` is the content width in visible characters; pass it
 * explicitly when `bodyLines` already carry ANSI styling, since `.length` on
 * a styled line counts escape bytes. Defaults to the longest line in
 * `bodyLines`, widened if needed to fit `title`. Blank lines render as a
 * bare `│` with no trailing space; every other line is padded to the
 * content width. No right border: callers may pass already-trimmed table
 * rows of varying length.
 */
export function renderPanel(
  title: string,
  bodyLines: string[],
  opts: { width?: number } = {},
): string {
  const bodyMax = bodyLines.reduce((m, line) => Math.max(m, line.length), 0);
  const width = Math.max(opts.width ?? bodyMax, title.length + 3);
  const total = width + 2;

  const top = `╭─ ${title} ${'─'.repeat(Math.max(1, total - title.length - 4))}`;
  const bottom = `╰${'─'.repeat(Math.max(1, total - 1))}`;
  if (bodyLines.length === 0) return `${top}\n${bottom}`;

  const body = bodyLines
    .map((line) => (line === '' ? '│' : `│ ${padRight(line, width)}`))
    .join('\n');
  return `${top}\n${body}\n${bottom}`;
}

/** Render a single-line section header prefixed by an emoji. */
export function renderHeader(emoji: string, label: string): string {
  return `${emoji} ${label}`;
}

/**
 * Render a section: emoji header, one blank line, then content blocks
 * separated by blank lines. Every command's human output goes through this
 * so spacing stays uniform across the surface.
 */
export function renderSection(emoji: string, label: string, ...blocks: string[]): string {
  const content = blocks.filter((block) => block.length > 0).join('\n\n');
  return `${renderHeader(emoji, label)}\n\n${content}`;
}

/** Render a `─` divider of the given width (default 60). */
export function renderDivider(width: number = 60): string {
  return '─'.repeat(Math.max(1, width));
}

/**
 * Insert `─` dividers between consecutive artifact sections in a markdown
 * bundle. A section boundary is any line that starts with `## `; the first
 * such line is left untouched, every subsequent boundary is preceded by
 * `\n<divider>\n\n`.
 */
export function intersperseBundleDividers(markdown: string): string {
  const lines = markdown.split('\n');
  const out: string[] = [];
  let seenFirstSection = false;
  const divider = renderDivider();
  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (seenFirstSection) {
        out.push('', divider, '');
      }
      seenFirstSection = true;
    }
    out.push(line);
  }
  return out.join('\n');
}
