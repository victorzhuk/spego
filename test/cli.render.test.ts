import { describe, it, expect } from 'vitest';
import {
  renderBox,
  renderTable,
  renderHeader,
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
});

describe('renderHeader', () => {
  it('joins emoji and label with a single space', () => {
    expect(renderHeader('📦', 'Artifacts')).toBe('📦 Artifacts');
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
