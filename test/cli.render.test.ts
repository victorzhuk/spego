import { describe, it, expect } from 'vitest';
import {
  columnWidths,
  renderBox,
  renderPanel,
  renderTable,
  renderHeader,
  renderSection,
  renderDivider,
  truncate,
  padRight,
  intersperseBundleDividers,
} from '../src/cli/render.js';

describe('truncate', () => {
  it('returns short values unchanged', () => {
    expect(truncate('abc', 10)).toBe('abc');
  });

  it('truncates with an ellipsis', () => {
    expect(truncate('abcdef', 4)).toBe('abc…');
  });

  it('returns just an ellipsis when width is 1', () => {
    expect(truncate('abcdef', 1)).toBe('…');
  });

  it('returns empty string for non-positive width', () => {
    expect(truncate('abcdef', 0)).toBe('');
    expect(truncate('abcdef', -1)).toBe('');
  });
});

describe('padRight', () => {
  it('pads with spaces to the target width', () => {
    expect(padRight('abc', 6)).toBe('abc   ');
  });

  it('returns longer strings unchanged', () => {
    expect(padRight('abcdef', 3)).toBe('abcdef');
  });
});

describe('renderBox', () => {
  it('renders rounded borders with title', () => {
    const out = renderBox('Workspace', [
      ['root', '/tmp/proj'],
      ['agents', 'claude'],
    ]);
    const lines = out.split('\n');
    expect(lines[0]).toMatch(/^╭─ Workspace /);
    expect(lines[0]).toMatch(/╮$/);
    expect(lines.at(-1)).toMatch(/^╰─+╯$/);
  });

  it('aligns title, body, and bottom to the same width', () => {
    const out = renderBox('T', [
      ['k1', 'short'],
      ['key-long', 'a-very-long-value'],
    ]);
    const lines = out.split('\n');
    const widths = new Set(lines.map((l) => l.length));
    expect(widths.size).toBe(1);
  });

  it('renders an empty box (title + bottom only) when no rows are given', () => {
    const out = renderBox('Empty', []);
    const lines = out.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/^╭─ Empty /);
    expect(lines[1]).toMatch(/^╰─+╯$/);
  });
});

describe('renderPanel', () => {
  it('embeds the title in the top rule and closes both rails on the right', () => {
    const out = renderPanel('Sprint 1', ['id  status', 'c1  done']);
    const lines = out.split('\n');
    expect(lines[0]).toMatch(/^╭─ Sprint 1 .+╮$/);
    expect(lines.at(-1)).toMatch(/^╰─+╯$/);
  });

  it('closes every body line with a right rail, blank rows included', () => {
    const out = renderPanel('T', ['row-a', '', 'row-b']);
    const lines = out.split('\n');
    expect(lines[1]).toMatch(/^│ row-a\s+│$/);
    expect(lines[2]).toMatch(/^│\s+│$/);
    expect(lines[3]).toMatch(/^│ row-b\s+│$/);
  });

  it('aligns the top rule, bottom rule, header, short rows, and blank rows to one width', () => {
    const out = renderPanel('Sprint 1', ['short', 'a much longer row of content', '']);
    const lines = out.split('\n');
    const widths = new Set(lines.map((line) => line.length));
    expect(widths.size).toBe(1);
  });

  it('honors an explicit width wider than the content and still closes on the right', () => {
    const out = renderPanel('T', ['x'], { width: 20 });
    const lines = out.split('\n');
    const widths = new Set(lines.map((line) => line.length));
    expect(widths.size).toBe(1);
    expect(lines[1]).toMatch(/^│ x\s+│$/);
  });

  it('truncates the title instead of growing the panel when width is narrower than the title', () => {
    const out = renderPanel('A very long sprint title', ['x'], { width: 10 });
    const lines = out.split('\n');
    const widths = new Set(lines.map((line) => line.length));
    expect(widths.size).toBe(1);
    expect(lines[0]!.length).toBe(14); // width + 4
    expect(lines[0]).toContain('…');
    expect(lines[0]).not.toContain('A very long sprint title');
  });

  it('keeps box geometry consistent even at widths too narrow for any title text', () => {
    for (const width of [1, 2, 3]) {
      const out = renderPanel('A very long sprint title', ['x'], { width });
      const lines = out.split('\n');
      const widths = new Set(lines.map((line) => line.length));
      expect(widths.size).toBe(1);
      expect([...widths][0]).toBe(width + 4);
    }
  });

  it('renders only the top and bottom rule for an empty body', () => {
    const out = renderPanel('Empty', []);
    const lines = out.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/^╭─ Empty .+╮$/);
    expect(lines[1]).toMatch(/^╰─+╯$/);
  });
});

describe('renderTable', () => {
  it('renders header, divider, and rows aligned', () => {
    const out = renderTable(
      ['type/slug', 'rev', 'title'],
      [
        ['prd/test', '1', 'Test PRD'],
        ['api/auth', '2', 'Auth API'],
      ],
    );
    const lines = out.split('\n');
    expect(lines).toHaveLength(4);
    expect(lines[0]).toContain('type/slug');
    expect(lines[1]).toMatch(/^─+\s+─+\s+─+$/);
  });

  it('truncates long cells with an ellipsis', () => {
    const long = 'x'.repeat(80);
    const out = renderTable(['title'], [[long]], { maxWidth: 10 });
    const lines = out.split('\n');
    expect(lines[2]).toContain('…');
    expect(lines[2]!.length).toBeLessThanOrEqual(10);
  });

  it('renders only header and divider for an empty body', () => {
    const out = renderTable(['col'], []);
    const lines = out.split('\n');
    expect(lines).toHaveLength(2);
  });

  it('uses explicit widths instead of deriving them from rows', () => {
    const out = renderTable(['id', 'title'], [['c1', 'Short']], { widths: [10, 20] });
    const lines = out.split('\n');
    expect(lines[1]).toBe('─'.repeat(10) + '  ' + '─'.repeat(20));
  });

  it('wraps a long last-column cell onto continuation rows that blank the leading columns', () => {
    const out = renderTable(
      ['id', 'note'],
      [['c1', 'alpha beta gamma delta epsilon']],
      { widths: [4, 10], wrapLastColumn: true },
    );
    const lines = out.split('\n');
    // header + divider + the wrapped data rows (no truncation, no ellipsis).
    expect(lines).toHaveLength(6);
    expect(lines.some((line) => line.includes('…'))).toBe(false);
    const dataLines = lines.slice(2);
    // First continuation carries the id; every later line blanks it but keeps the column offset.
    expect(dataLines[0]!.slice(0, 4)).toBe('c1  ');
    for (const cont of dataLines.slice(1)) {
      expect(cont.slice(0, 4)).toBe('    ');
    }
    // Each wrapped chunk stays within the 10-char last column.
    for (const line of dataLines) {
      expect(line.trimEnd().length).toBeLessThanOrEqual(4 + 2 + 10);
    }
    expect(dataLines.join(' ')).toContain('epsilon');
  });

  it('leaves a short last-column cell on one row under wrapLastColumn', () => {
    const out = renderTable(['id', 'note'], [['c1', 'fits']], { widths: [4, 10], wrapLastColumn: true });
    const lines = out.split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[2]).toContain('fits');
  });
});

describe('columnWidths', () => {
  it('sizes each column to the header vs. longest cell', () => {
    expect(columnWidths(['id', 'title'], [['c1', 'Short'], ['c22', 'A longer title']])).toEqual([3, 14]);
  });

  it('clamps to maxWidth', () => {
    expect(columnWidths(['title'], [['x'.repeat(80)]], { maxWidth: 10 })).toEqual([10]);
  });

  it('returns natural widths unchanged when they already fit totalWidth', () => {
    expect(columnWidths(['id', 'title'], [['c1', 'Short']], { totalWidth: 60 })).toEqual([2, 5]);
  });

  it('shrinks the widest column first, repeatedly, to fit totalWidth', () => {
    // natural: id=2, wide=30, other=30 -> sum 62 + 4 separators = 66; budget 40.
    const widths = columnWidths(
      ['id', 'wide', 'other'],
      [['c1', 'x'.repeat(30), 'y'.repeat(30)]],
      { totalWidth: 40 },
    );
    const sum = widths.reduce((s, w) => s + w, 0) + 2 * (widths.length - 1);
    expect(sum).toBeLessThanOrEqual(40);
    // 'wide' and 'other' tie at 30; lowest index shrinks first, so 'wide' ends narrower or equal.
    expect(widths[1]!).toBeLessThanOrEqual(widths[2]!);
    expect(widths[0]!).toBe(2); // 'id' never grows past its natural width
  });

  it('stops shrinking at minWidth even if totalWidth is not met', () => {
    const widths = columnWidths(['a', 'b'], [['x'.repeat(20), 'y'.repeat(20)]], { totalWidth: 5, minWidth: 6 });
    expect(widths).toEqual([6, 6]);
  });

  it('keeps a protected column at its natural width even when totalWidth is too small', () => {
    const widths = columnWidths(['id', 'change', 'status'], [['c1', 'x'.repeat(30), 'x']], {
      totalWidth: 20,
      protect: [1],
    });
    expect(widths[1]).toBe(30);
    const sum = widths.reduce((s, w) => s + w, 0) + 2 * (widths.length - 1);
    expect(sum).toBeGreaterThan(20);
  });

  it('lets the table exceed totalWidth when a protected column cannot shrink', () => {
    const widths = columnWidths(['id', 'change', 'status'], [['c1', 'x'.repeat(40), 'x']], {
      totalWidth: 24,
      minWidth: 6,
      protect: [1],
    });
    const sum = widths.reduce((s, w) => s + w, 0) + 2 * (widths.length - 1);
    expect(sum).toBeGreaterThan(24);
    expect(widths[1]).toBe(40);
  });

  it('still caps non-protected columns at maxWidth while a protected column keeps its natural width', () => {
    const widths = columnWidths(['id', 'change'], [['c1', 'x'.repeat(80)]], { maxWidth: 10, protect: [1] });
    expect(widths).toEqual([2, 80]);
  });
});

describe('renderHeader', () => {
  it('joins emoji and label with a single space', () => {
    expect(renderHeader('📦', 'Artifacts')).toBe('📦 Artifacts');
  });
});

describe('renderSection', () => {
  it('separates the header from content with one blank line', () => {
    expect(renderSection('📦', 'Artifacts', 'body')).toBe('📦 Artifacts\n\nbody');
  });

  it('separates multiple blocks with blank lines and drops empty blocks', () => {
    expect(renderSection('📦', 'S', 'a', '', 'b')).toBe('📦 S\n\na\n\nb');
  });
});

describe('renderDivider', () => {
  it('renders a default 60-char divider', () => {
    expect(renderDivider()).toHaveLength(60);
    expect(renderDivider()).toMatch(/^─+$/);
  });

  it('honors a custom width', () => {
    expect(renderDivider(10)).toBe('──────────');
  });

  it('clamps non-positive width to 1', () => {
    expect(renderDivider(0)).toBe('─');
    expect(renderDivider(-5)).toBe('─');
  });
});

describe('intersperseBundleDividers', () => {
  it('returns single-section markdown unchanged', () => {
    const md = '# Type\n\n## Title\n\nbody\n';
    expect(intersperseBundleDividers(md)).toBe(md);
  });

  it('inserts a divider between consecutive `## ` sections', () => {
    const md = '# Type\n\n## A\n\nbody-a\n\n## B\n\nbody-b\n';
    const out = intersperseBundleDividers(md);
    const dividerLines = out.split('\n').filter((line) => /^─+$/.test(line));
    expect(dividerLines.length).toBeGreaterThanOrEqual(1);
    expect(out).toContain('## A');
    expect(out).toContain('## B');
  });
});
