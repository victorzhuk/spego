import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { ArtifactEngine } from '../src/artifacts/engine.js';
import { initWorkspace } from '../src/workspace/init.js';
import { storeRunsPath } from '../src/workspace/paths.js';
import { makeTempProject } from './helpers.js';
import { spawnCli } from './_cli-helpers.js';
import type { ArtifactRecord } from '../src/artifacts/types.js';
import type { CommandMeta } from '../src/command-meta/registry.js';
import type { MirrorBoard } from '../src/delivery/mirror.js';

const ESC = String.fromCharCode(27);
const ANSI_PATTERN = new RegExp(`${ESC}\\[[0-9;]*m`, 'g');

/** Strip ANSI escape codes so `.length` reflects visible width, not escape bytes. */
function stripAnsi(value: string): string {
  return value.replace(ANSI_PATTERN, '');
}

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const fn of cleanups.splice(0)) await fn();
});

async function setupProject(): Promise<string> {
  const { root, cleanup } = await makeTempProject();
  cleanups.push(cleanup);
  await initWorkspace({ projectRoot: root, agents: ['claude'] });
  return root;
}

async function setupOpenSpecWorkspace(): Promise<string> {
  const root = await setupProject();
  await fs.mkdir(path.join(root, 'openspec'), { recursive: true });
  await fs.writeFile(path.join(root, 'openspec', 'config.yaml'), '', 'utf8');
  return root;
}

async function writeOpenSpecChange(
  root: string,
  changeName: string,
  opts: { tasks?: string; archived?: boolean } = {},
): Promise<void> {
  const changeDir = path.join(root, 'openspec', 'changes', changeName);
  await fs.mkdir(changeDir, { recursive: true });
  const archived = opts.archived ? 'archived: true\n' : '';
  await fs.writeFile(path.join(changeDir, '.openspec.yaml'), `schema: spec-driven\n${archived}`, 'utf8');
  await fs.writeFile(path.join(changeDir, 'proposal.md'), `# ${changeName}\n`, 'utf8');
  if (opts.tasks !== undefined) await fs.writeFile(path.join(changeDir, 'tasks.md'), opts.tasks, 'utf8');
}

async function withEngine<T>(root: string, fn: (engine: ArtifactEngine) => Promise<T>): Promise<T> {
  const engine = await ArtifactEngine.open({ projectRoot: root });
  try {
    return await fn(engine);
  } finally {
    engine.close();
  }
}

async function createArtifact(
  root: string,
  type: string,
  title: string,
  meta: Record<string, unknown> = {},
): Promise<ArtifactRecord> {
  return withEngine(root, (engine) => engine.create({ type, title, body: '', meta }));
}

async function createChangeEpic(
  root: string,
  changeName: string,
  opts: { tasks?: string; meta?: Record<string, unknown> } = {},
): Promise<ArtifactRecord> {
  await writeOpenSpecChange(root, changeName, { tasks: opts.tasks });
  return withEngine(root, (engine) =>
    engine.create({
      type: 'epic',
      title: changeName,
      slug: changeName,
      body: '',
      meta: opts.meta ?? {},
    }),
  );
}

async function setupBoardFixture(): Promise<string> {
  const root = await setupOpenSpecWorkspace();
  const prd = await createArtifact(root, 'prd', 'Auth PRD');
  await createChangeEpic(root, 'add-api', {
    tasks: '- [x] design\n- [x] build\n',
    meta: { requires: ['prd'], links: [prd.frontmatter.id] },
  });
  await createChangeEpic(root, 'add-ui', {
    tasks: '- [ ] build UI\n',
    meta: {
      deps: ['add-api'],
      requires: ['api'],
      gaps: [{ flag: 'api-contract', note: 'API artifact missing' }],
    },
  });
  await createArtifact(root, 'sprint-plan', 'Sprint 1', {
    status: 'active',
    startDate: '2026-01-01',
    endDate: '2026-01-14',
    changes: ['add-api', 'add-ui'],
  });
  return root;
}

async function setupWaveFixture(): Promise<string> {
  const root = await setupOpenSpecWorkspace();
  await createChangeEpic(root, 'wave-a', { tasks: '- [ ] todo\n', meta: { track: 'storage' } });
  await createChangeEpic(root, 'wave-b', { tasks: '- [ ] todo\n', meta: { track: 'storage' } });
  await createChangeEpic(root, 'wave-c', {
    tasks: '- [ ] todo\n',
    meta: { deps: ['wave-a'], track: 'ui' },
  });
  return root;
}

/**
 * `add-api`/`add-ui` are both scheduled into the same sprint, so an
 * intra-sprint dep never dims a row (`blockersFor` skips a dep scheduled at
 * or before the subject). Depending on a dangling `ghost` change instead
 * gives every row a real blocker regardless of scheduling, so this fixture
 * exercises strikethrough (satisfied) and dim (blocked-only) side by side.
 */
async function setupStyledPanelFixture(sprintTitle = 'Sprint 1'): Promise<string> {
  const root = await setupOpenSpecWorkspace();
  await createChangeEpic(root, 'ship-api', {
    tasks: '- [x] design\n',
    meta: { deps: ['ghost'] },
  });
  await createChangeEpic(root, 'ship-ui', {
    tasks: '- [ ] build\n',
    meta: { deps: ['ghost'] },
  });
  await createArtifact(root, 'sprint-plan', sprintTitle, {
    status: 'active',
    changes: ['ship-api', 'ship-ui'],
  });
  return root;
}

/** Every change satisfied, so the sprint is `complete` and hidden by default — visible, fully dim, only via `--closed`. */
async function setupFinishedPanelFixture(sprintTitle: string): Promise<string> {
  const root = await setupOpenSpecWorkspace();
  await createChangeEpic(root, 'ship-api', { tasks: '- [x] design\n' });
  await createChangeEpic(root, 'ship-ui', { tasks: '- [x] build\n' });
  await createArtifact(root, 'sprint-plan', sprintTitle, {
    status: 'active',
    changes: ['ship-api', 'ship-ui'],
  });
  return root;
}

/**
 * Two archived changes sit alongside a pending one in an active sprint. Archived
 * changes in a live sprint are satisfied history, not drift, so neither fires a
 * warning; the sprint stays visible because pending-c is still open.
 */
async function setupArchivedInSprintFixture(): Promise<string> {
  const root = await setupOpenSpecWorkspace();
  await writeOpenSpecChange(root, 'archived-a', { tasks: '- [x] done\n', archived: true });
  await writeOpenSpecChange(root, 'archived-b', { tasks: '- [x] done\n', archived: true });
  await createChangeEpic(root, 'pending-c', { tasks: '- [ ] todo\n' });
  await createArtifact(root, 'sprint-plan', 'Sprint 1', {
    status: 'active',
    startDate: '2026-01-01',
    changes: ['archived-a', 'archived-b', 'pending-c'],
  });
  return root;
}

async function artifactSnapshot(root: string): Promise<Record<string, number>> {
  const dir = path.join(root, '.spego', 'artifacts');
  const out: Record<string, number> = {};
  try {
    const entries = await fs.readdir(dir, { recursive: true, withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile()) {
        const full = path.join(entry.parentPath, entry.name);
        out[path.relative(root, full)] = (await fs.stat(full)).mtimeMs;
      }
    }
  } catch {
    // no artifacts dir yet
  }
  return out;
}

/**
 * Priced workspace: `flows` block in the config, two tiered changes (one with a
 * flow override), one untiered change, one satisfied change. Hand-computed
 * expectations: priced-a m → 2/16, priced-b s via opsx-apply → 2/6, sprint
 * total 4 over pending priced work with 1 pending unpriced.
 */
async function setupPricedBoardFixture(): Promise<string> {
  const root = await setupOpenSpecWorkspace();
  await fs.appendFile(
    path.join(root, '.spego', 'config.yaml'),
    [
      '',
      'flows:',
      '  default: zapply',
      '  profiles:',
      '    zapply:',
      '      xs: 0.5',
      '      s: 1',
      '      m: 2',
      '      l: 4',
      '      xl: 8',
      '    opsx-apply:',
      '      xs: 1',
      '      s: 2',
      '      m: 4',
      '      l: 8',
      '      xl: 16',
      '  human:',
      '    xs: 2',
      '    s: 6',
      '    m: 16',
      '    l: 40',
      '    xl: 80',
      '',
    ].join('\n'),
    'utf8',
  );
  await createChangeEpic(root, 'priced-a', { tasks: '- [ ] todo\n', meta: { tier: 'm' } });
  await createChangeEpic(root, 'priced-b', { tasks: '- [ ] todo\n', meta: { tier: 's', flow: 'opsx-apply' } });
  await createChangeEpic(root, 'untiered-c', { tasks: '- [ ] todo\n' });
  await createChangeEpic(root, 'done-d', { tasks: '- [x] done\n', meta: { tier: 'l' } });
  await createArtifact(root, 'sprint-plan', 'Sprint 1', {
    status: 'active',
    startDate: '2026-01-01',
    changes: ['priced-a', 'priced-b', 'untiered-c', 'done-d'],
  });
  return root;
}


/**
 * Ladder fixture: priced workspace plus three history changes with recorded
 * zapply runs at tier m ([2, 4, 6] → median 4, threshold met), so priced-a
 * resolves observed and priced-b (opsx-apply, no runs) stays on the seed.
 */
async function setupLadderBoardFixture(): Promise<string> {
  const root = await setupPricedBoardFixture();
  for (const [name, hours] of [['hist-1', 2], ['hist-2', 4], ['hist-3', 6]] as Array<[string, number]>) {
    await createChangeEpic(root, name, {
      tasks: '- [x] done\n',
      meta: { tier: 'm', actuals: [{ flow: 'zapply', hours }] },
    });
  }
  return root;
}


/**
 * Bias fixture: priced workspace plus two history changes — h1 tier m with one
 * zapply run of 5 (seed 2 → bias 2.5, over) and h2 tier l with one zapply run
 * of 1 (seed 4 → bias 0.25, under) — so priced-a's seeded 2 corrects to 4
 * (clamped from 5) and two stale-profile pairs warn.
 */
async function setupBiasBoardFixture(): Promise<string> {
  const root = await setupPricedBoardFixture();
  await createChangeEpic(root, 'hist-m', {
    tasks: '- [x] done\n',
    meta: { tier: 'm', actuals: [{ flow: 'zapply', hours: 5 }] },
  });
  await createChangeEpic(root, 'hist-l', {
    tasks: '- [x] done\n',
    meta: { tier: 'l', actuals: [{ flow: 'zapply', hours: 1 }] },
  });
  return root;
}

/** Write a seeded cross-project store under `root/store`, returning its path. */
async function seedStore(root: string, runs: Array<{ flow: string; tier: string; hours: number }>): Promise<string> {
  const storeRoot = path.join(root, 'store');
  await fs.mkdir(storeRoot, { recursive: true });
  await fs.writeFile(storeRunsPath(storeRoot), runs.map((run) => JSON.stringify(run)).join('\n') + '\n', 'utf8');
  return storeRoot;
}

/**
 * Cross-project fixture: the ladder fixture (priced-a observed at 4 from repo
 * runs) plus the opt-in flag and a seeded store of opsx-apply/s runs
 * ([6, 8, 10] → median 8), so one board shows all three rungs — priced-b
 * cross-project, done-d still on the seed.
 */
async function setupCrossProjectBoardFixture(): Promise<{ root: string; storeRoot: string }> {
  const root = await setupLadderBoardFixture();
  await fs.appendFile(path.join(root, '.spego', 'config.yaml'), '  crossProject: true\n', 'utf8');
  const storeRoot = await seedStore(root, [
    { flow: 'opsx-apply', tier: 's', hours: 6 },
    { flow: 'opsx-apply', tier: 's', hours: 8 },
    { flow: 'opsx-apply', tier: 's', hours: 10 },
  ]);
  return { root, storeRoot };
}

describe('CLI board command', () => {
  it('returns deterministic JSON board shape with warnings envelope', async () => {
    const root = await setupBoardFixture();
    const { stdout } = await spawnCli(['--json', 'board', '--cwd', root], root);
    const result = JSON.parse(stdout) as MirrorBoard;

    expect(Object.keys(result)).toEqual(['sprints', 'ungrouped', 'warnings', 'next']);
    expect(result.sprints.map((sprint) => sprint.slug)).toEqual(['sprint-1']);
    expect(result.sprints[0]!.changes.map((change) => change.slug)).toEqual(['add-api', 'add-ui']);
    expect(result.sprints[0]!.changes[0]).toMatchObject({ slug: 'add-api' });
    expect(result.sprints[0]!.changes[1]).toMatchObject({
      slug: 'add-ui',
      blockers: [],
      missing: ['api'],
      gaps: [{ flag: 'api-contract', note: 'API artifact missing' }],
    });
    expect(result.sprints[0]!.changes[0]!.id).toMatch(/^c[0-9a-f]{4,}$/);
    expect(result.sprints[0]!.changes[1]!.id).toMatch(/^c[0-9a-f]{4,}$/);
    expect(result.sprints[0]!.changes[0]!.id).not.toBe(result.sprints[0]!.changes[1]!.id);
    expect(Array.isArray(result.warnings)).toBe(true);
    expect(result.next).toMatchObject({ change: 'add-ui', sprint: 'sprint-1' });
  }, 30_000);

  it('flags a sprint-plan whose own required artifacts are unlinked', async () => {
    const root = await setupOpenSpecWorkspace();
    await createChangeEpic(root, 'sprint-scoped', { tasks: '- [ ] build\n' });
    const design = await createArtifact(root, 'design', 'Sprint 9 design', { category: 'system' });
    await createArtifact(root, 'sprint-plan', 'Sprint 9', {
      status: 'active',
      changes: ['sprint-scoped'],
      requires: ['design', 'qa'],
      links: [design.frontmatter.id],
    });

    const { stdout } = await spawnCli(['--json', 'board', '--cwd', root], root);
    const result = JSON.parse(stdout) as MirrorBoard;
    expect(result.sprints[0]!.missing).toEqual(['qa']);

    const { stdout: human } = await spawnCli(['board', '--cwd', root], root, {
      env: { COLUMNS: '160' },
    });
    expect(stripAnsi(human)).toContain('1 mis');
  }, 30_000);

  it('groups changes by conflict track: same track shared, distinct tracks separate', async () => {
    const root = await setupWaveFixture();
    const { stdout } = await spawnCli(['--json', 'board', '--cwd', root], root);
    const result = JSON.parse(stdout) as MirrorBoard;
    const bySlug = new Map(result.ungrouped.map((change) => [change.slug, change]));

    expect(bySlug.get('wave-a')?.group).toBe('storage');
    expect(bySlug.get('wave-b')?.group).toBe('storage');
    expect(bySlug.get('wave-c')?.group).toBe('ui');
    expect(bySlug.get('wave-c')?.blockers).toEqual(['wave-a']);
  }, 30_000);

  it('renders the new id/change/status/group/signals columns and drops the old blocker/gaps/missing/title columns', async () => {
    const root = await setupWaveFixture();
    const { stdout: jsonOut } = await spawnCli(['--json', 'board', '--cwd', root], root);
    const jsonBoard = JSON.parse(jsonOut) as MirrorBoard;
    const waveAId = jsonBoard.ungrouped.find((change) => change.slug === 'wave-a')?.id;
    expect(waveAId).toMatch(/^c[0-9a-f]{4,}$/);

    const { stdout } = await spawnCli(['board', '--cwd', root], root);
    const header = stdout.split('\n').find((line) => line.includes('signals'))!;
    expect(header).toContain('change');
    expect(header).toContain('group');
    expect(header).not.toContain('blockers');
    expect(header).not.toContain('title');

    const waveCLine = stdout.split('\n').find((line) => line.includes('wave-c'))!;
    expect(waveCLine).toContain('1 blk');
    expect(waveCLine).not.toContain(waveAId);
  }, 30_000);

  it('honors --plain to suppress ANSI color even when color is forced on', async () => {
    const root = await setupWaveFixture();
    const withColor = await spawnCli(['board', '--cwd', root], root, { env: { FORCE_COLOR: '1' } });
    expect(withColor.stdout).toContain('\x1b[');

    const plain = await spawnCli(['board', '--plain', '--cwd', root], root, { env: { FORCE_COLOR: '1' } });
    expect(plain.stdout).not.toContain('\x1b[');
  }, 30_000);

  it('bolds the sprint title, strikes satisfied rows, and dims blocked-only rows', async () => {
    const root = await setupStyledPanelFixture();
    const { stdout } = await spawnCli(['board', '--cwd', root], root, { env: { FORCE_COLOR: '1' } });
    const lines = stdout.split('\n');
    const titleLine = lines.find((line) => line.startsWith('╭─') && line.includes('sprint-1'))!;
    const apiLine = lines.find((line) => line.includes('ship-api'))!;
    const uiLine = lines.find((line) => line.includes('ship-ui'))!;

    expect(titleLine).toContain('\x1b[1m');
    expect(titleLine).not.toContain('\x1b[4m');

    // ship-api: all tasks checked (done) -> satisfied, struck through even though it also has a blocker.
    expect(apiLine).toContain('\x1b[9m');
    // ship-ui: pending and only blocked -> dimmed, not struck through.
    expect(uiLine).not.toContain('\x1b[9m');
    expect(uiLine).toContain('\x1b[2m');
  }, 30_000);

  it('renders the sprint and Warnings sections as bordered panels with aligned rules', async () => {
    const root = await setupStyledPanelFixture();
    // FORCE_COLOR exercises the ANSI-styled strikethrough/dim rows: their raw .length
    // includes escape bytes, so geometry must be checked on stripped lines.
    const { stdout } = await spawnCli(['board', '--cwd', root], root, { env: { FORCE_COLOR: '1' } });
    expect(stripAnsi(stdout)).toContain('╭─ Sprint 1 · active · sprint-1');
    expect(stripAnsi(stdout)).toContain('╭─ Warnings');

    const lines = stdout.split('\n');
    const panelStarts = lines.reduce<number[]>((acc, line, index) => {
      if (stripAnsi(line).startsWith('╭─')) acc.push(index);
      return acc;
    }, []);
    expect(panelStarts.length).toBe(2);

    for (const start of panelStarts) {
      const end = lines.findIndex((line, index) => index > start && /^╰─+╯$/.test(stripAnsi(line)));
      expect(end).toBeGreaterThan(start);
      const panelLines = lines.slice(start, end + 1);
      // Top closes on the right with ╮, bottom with ╯, every body line with │.
      expect(stripAnsi(panelLines[0]!)).toMatch(/╮$/);
      expect(stripAnsi(panelLines.at(-1)!)).toMatch(/^╰─+╯$/);
      for (const body of panelLines.slice(1, -1)) {
        expect(stripAnsi(body)).toMatch(/│$/);
      }
      const widths = new Set(panelLines.map((line) => stripAnsi(line).length));
      expect(widths.size).toBe(1);
    }
  }, 30_000);

  it('keeps every panel line at one stripped width when a sprint title is longer than its table', async () => {
    const longTitle = 'Sprint 1: A deliberately long sprint title that outruns the table grid';
    const root = await setupStyledPanelFixture(longTitle);
    const { stdout } = await spawnCli(['board', '--cwd', root], root, { env: { FORCE_COLOR: '1' } });
    expect(stdout).toContain('\x1b[9m'); // ship-api is satisfied -> struck through, the case that broke the rail

    const lines = stdout.split('\n');
    const panelStarts = lines.reduce<number[]>((acc, line, index) => {
      if (stripAnsi(line).startsWith('╭─')) acc.push(index);
      return acc;
    }, []);
    expect(panelStarts.length).toBe(2);
    for (const start of panelStarts) {
      const end = lines.findIndex((line, index) => index > start && /^╰─+╯$/.test(stripAnsi(line)));
      const panelLines = lines.slice(start, end + 1);
      const widths = new Set(panelLines.map((line) => stripAnsi(line).length));
      expect(widths.size).toBe(1);
    }
  }, 30_000);

  it('renders every panel at the same width, regardless of how much longer one sprint title is than another', async () => {
    const root = await setupOpenSpecWorkspace();
    await createChangeEpic(root, 'x', { tasks: '- [ ] todo\n' });
    await createChangeEpic(root, 'y', { tasks: '- [ ] todo\n' });
    await createArtifact(root, 'sprint-plan', 'Sprint 1: A deliberately long sprint title that outruns the table grid', {
      status: 'active',
      startDate: '2026-01-01',
      changes: ['x'],
    });
    await createArtifact(root, 'sprint-plan', 'Sprint 2', {
      status: 'active',
      startDate: '2026-02-01',
      changes: ['y'],
    });

    const { stdout } = await spawnCli(['board', '--cwd', root], root);
    const lines = stdout.split('\n');
    const panelStarts = lines.reduce<number[]>((acc, line, index) => {
      if (line.startsWith('╭─')) acc.push(index);
      return acc;
    }, []);
    expect(panelStarts.length).toBe(2);
    const panelWidths = panelStarts.map((start) => lines[start]!.length);
    expect(new Set(panelWidths).size).toBe(1);
  }, 30_000);

  it('truncates a title too long for the terminal instead of widening the panel past it', async () => {
    const longTitle = 'Sprint 1: A deliberately long sprint title that outruns the table grid';
    const root = await setupStyledPanelFixture(longTitle);
    const { stdout } = await spawnCli(['board', '--cwd', root], root, { env: { COLUMNS: '60' } });
    const lines = stdout.split('\n');
    const start = lines.findIndex((line) => line.startsWith('╭─'));
    expect(start).toBeGreaterThanOrEqual(0);
    expect(lines[start]).toContain('…');
    expect(lines[start]).not.toContain(longTitle);
    expect(lines[start]).toMatch(/╮$/);
    const end = lines.findIndex((line, index) => index > start && /^╰─+╯$/.test(line));
    const panelLines = lines.slice(start, end + 1);
    const widths = new Set(panelLines.map((line) => line.length));
    expect(widths.size).toBe(1);
  }, 30_000);

  it('dims the whole panel including header and divider under --closed without breaking the rail', async () => {
    const longTitle = 'Sprint 1: A deliberately long finished sprint title that outruns the table grid';
    const root = await setupFinishedPanelFixture(longTitle);
    const { stdout } = await spawnCli(['board', '--closed', '--cwd', root], root, { env: { FORCE_COLOR: '1' } });
    expect(stdout).toContain('\x1b[2m');

    const lines = stdout.split('\n');
    const start = lines.findIndex((line) => stripAnsi(line).startsWith('╭─'));
    expect(start).toBeGreaterThanOrEqual(0);
    const end = lines.findIndex((line, index) => index > start && /^╰─+╯$/.test(stripAnsi(line)));
    const panelLines = lines.slice(start, end + 1);
    const widths = new Set(panelLines.map((line) => stripAnsi(line).length));
    expect(widths.size).toBe(1);
  }, 30_000);

  it('does not warn when archived changes sit in a live sprint', async () => {
    const root = await setupArchivedInSprintFixture();
    const { stdout: jsonOut } = await spawnCli(['--json', 'board', '--cwd', root], root);
    const jsonBoard = JSON.parse(jsonOut) as MirrorBoard;
    expect(jsonBoard.warnings).toEqual([]);

    const { stdout } = await spawnCli(['board', '--cwd', root], root, { env: { COLUMNS: '160' } });
    expect(stdout).not.toContain('includes archived changes');
  }, 30_000);

  it('renders the raw track value in human output identical to --json', async () => {
    const root = await setupWaveFixture();
    const { stdout: jsonOut } = await spawnCli(['--json', 'board', '--cwd', root], root);
    const jsonBoard = JSON.parse(jsonOut) as MirrorBoard;
    expect(new Set(jsonBoard.ungrouped.map((change) => change.group))).toEqual(new Set(['storage', 'ui']));

    const { stdout } = await spawnCli(['board', '--cwd', root], root);
    expect(stdout).not.toContain('g001');
    expect(stdout).not.toContain('g002');
    const waveCLine = stdout.split('\n').find((line) => line.includes('wave-c'))!;
    expect(waveCLine).toContain('ui');
  }, 30_000);

  it('aligns the signals column at the same offset across sprint panels with differently sized cells', async () => {
    const root = await setupOpenSpecWorkspace();
    await createChangeEpic(root, 'wide-gap-change', {
      tasks: '- [ ] todo\n',
      meta: { gaps: [{ flag: 'needs-design-review', note: 'blocked on design sign-off from the platform team' }] },
    });
    await createChangeEpic(root, 'short-change', { tasks: '- [ ] todo\n' });
    await createArtifact(root, 'sprint-plan', 'Sprint A', {
      status: 'active',
      startDate: '2026-01-01',
      changes: ['wide-gap-change'],
    });
    await createArtifact(root, 'sprint-plan', 'Sprint B', {
      status: 'active',
      startDate: '2026-02-01',
      changes: ['short-change'],
    });

    const { stdout } = await spawnCli(['board', '--cwd', root], root);
    const headerLines = stdout.split('\n').filter((line) => line.includes('signals'));
    expect(headerLines.length).toBe(2);
    const signalOffsets = new Set(headerLines.map((line) => line.indexOf('signals')));
    expect(signalOffsets.size).toBe(1);
  }, 30_000);

  it('does not truncate a warning message that fits the shared panel width', async () => {
    const root = await setupOpenSpecWorkspace();
    const longDep = 'a-genuinely-long-and-descriptive-missing-dependency-name';
    await createChangeEpic(root, 'has-dangling', {
      tasks: '- [ ] todo\n',
      meta: { deps: [longDep] },
    });

    const { stdout } = await spawnCli(['board', '--cwd', root], root, { env: { COLUMNS: '160' } });
    const warningLine = stdout.split('\n').find((line) => line.includes('dangling-dep'))!;
    expect(warningLine).toContain(longDep);
    expect(warningLine).not.toContain('…');
  }, 30_000);

  it('pads a narrower table with blank space instead of stretching its last column into a long divider', async () => {
    const root = await setupOpenSpecWorkspace();
    await createChangeEpic(root, 'x', { tasks: '- [ ] todo\n' });
    await createArtifact(root, 'sprint-plan', 'Sprint 1', { status: 'active', changes: ['x'] });
    const longDep = 'a-genuinely-long-and-descriptive-missing-dependency-name-for-testing';
    await createChangeEpic(root, 'has-dangling', { tasks: '- [ ] todo\n', meta: { deps: [longDep] } });

    const { stdout } = await spawnCli(['board', '--cwd', root], root, { env: { COLUMNS: '200' } });
    const lines = stdout.split('\n');
    // Strip the panel's own border (leading "│ " / trailing " │") first, then trim the blank
    // padding renderPanelSection adds past the table's natural width — what's left is the
    // table's own content, unpadded, so a stretched last column would show up as extra dashes here.
    const tableContent = (line: string): string => line.replace(/^│ /, '').replace(/ │$/, '').replace(/\s+$/, '');
    const sprintLine = lines[lines.findIndex((line) => line.startsWith('╭─') && line.includes('sprint-1')) + 2]!;
    const warningsLine = lines[lines.findIndex((line) => line.startsWith('╭─ Warnings')) + 2]!;

    // The panel border itself still lines up across both panels...
    expect(sprintLine.length).toBe(warningsLine.length);
    // ...but the change table's own `signals` divider stays at its natural width (matching its
    // header) instead of stretching out to match the Warnings table's much longer message column.
    expect(tableContent(sprintLine)).toMatch(/─{7}$/);
    expect(tableContent(sprintLine).length).toBeLessThan(tableContent(warningsLine).length - 20);
  }, 30_000);

  it('renders human board, dependency graph, and gaps report', async () => {
    const root = await setupBoardFixture();
    const board = await spawnCli(['board', '--cwd', root], root);
    expect(board.stdout).toContain('Delivery board');
    expect(board.stdout).toContain('Sprint 1 · active · sprint-1');
    expect(board.stdout).toContain('Suggestion: add-ui in sprint-1');

    const graph = await spawnCli(['board', '--graph', '--cwd', root], root);
    expect(graph.stdout).toContain('Dependency graph');
    expect(graph.stdout).toContain('add-ui');
    expect(graph.stdout).toContain('add-api');

    const gaps = await spawnCli(['board', '--gaps', '--cwd', root], root);
    expect(gaps.stdout).toContain('Delivery gaps');
    expect(gaps.stdout).toContain('add-ui');
    expect(gaps.stdout).toContain('api-contract');
  }, 30_000);

  it('excludes archived changes from ungrouped by default, --archived restores them', async () => {
    const root = await setupOpenSpecWorkspace();
    await writeOpenSpecChange(root, 'active-one', { tasks: '- [ ] todo\n' });
    await writeOpenSpecChange(root, 'archived-one', { tasks: '- [x] done\n', archived: true });

    const { stdout: defaultOut } = await spawnCli(['--json', 'board', '--cwd', root], root);
    const defaultResult = JSON.parse(defaultOut) as MirrorBoard;
    expect(defaultResult.ungrouped.map((change) => change.slug)).toEqual(['active-one']);

    const { stdout: archivedOut } = await spawnCli(['--json', 'board', '--archived', '--cwd', root], root);
    const archivedResult = JSON.parse(archivedOut) as MirrorBoard;
    expect(archivedResult.ungrouped.map((change) => change.slug)).toEqual(['active-one', 'archived-one']);

    const human = await spawnCli(['board', '--cwd', root], root);
    expect(human.stdout).not.toContain('archived-one');

    const humanArchived = await spawnCli(['board', '--archived', '--cwd', root], root);
    expect(humanArchived.stdout).toContain('archived-one');
  }, 30_000);

  it('keeps an archived change inside a sprint list regardless of --archived', async () => {
    const root = await setupOpenSpecWorkspace();
    await writeOpenSpecChange(root, 'archived-scheduled', { tasks: '- [x] done\n', archived: true });
    await withEngine(root, (engine) =>
      engine.create({ type: 'epic', title: 'archived-scheduled', slug: 'archived-scheduled', body: '', meta: {} }),
    );
    await createArtifact(root, 'sprint-plan', 'Sprint 1', {
      status: 'active',
      startDate: '2026-01-01',
      changes: ['archived-scheduled'],
    });

    const { stdout: defaultOut } = await spawnCli(['--json', 'board', '--cwd', root], root);
    const defaultResult = JSON.parse(defaultOut) as MirrorBoard;
    expect(defaultResult.sprints[0]!.changes.map((change) => change.slug)).toEqual(['archived-scheduled']);

    const { stdout: archivedOut } = await spawnCli(['--json', 'board', '--archived', '--cwd', root], root);
    const archivedResult = JSON.parse(archivedOut) as MirrorBoard;
    expect(archivedResult.sprints[0]!.changes.map((change) => change.slug)).toEqual(['archived-scheduled']);

    // JSON keeps `completed` for agents; human output shows `archived` instead.
    expect(defaultResult.sprints[0]!.changes[0]!.status).toBe('completed');

    // A sprint whose only change is archived is fully satisfied -> hidden by default.
    const human = await spawnCli(['board', '--cwd', root], root);
    expect(human.stdout).not.toContain('Sprint 1 · active · sprint-1');
    expect(human.stdout).toContain('1 closed sprint hidden (--closed to show).');

    const humanClosed = await spawnCli(['board', '--closed', '--cwd', root], root);
    expect(humanClosed.stdout).toContain('Sprint 1 · active · sprint-1');
    const changeLine = humanClosed.stdout.split('\n').find((line) => line.includes('archived-scheduled'))!;
    expect(changeLine).toContain('archived');
    expect(changeLine).not.toContain('completed');
  }, 30_000);

  it('keeps adapter-only output for active changes without artifacts', async () => {
    const root = await setupOpenSpecWorkspace();
    await writeOpenSpecChange(root, 'ungroomed-one', { tasks: '- [ ] todo\n' });
    await writeOpenSpecChange(root, 'ungroomed-two', { tasks: '- [ ] todo\n' });

    const { stdout } = await spawnCli(['--json', 'board', '--cwd', root], root);
    const result = JSON.parse(stdout) as MirrorBoard;

    expect(result.sprints).toEqual([]);
    expect(result.ungrouped.map((change) => change.slug)).toEqual(['ungroomed-one', 'ungroomed-two']);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'ungroomed-change', details: { change: 'ungroomed-one' } }),
        expect.objectContaining({ code: 'ungroomed-change', details: { change: 'ungroomed-two' } }),
      ]),
    );
  }, 30_000);

  it('reports no-task-plan per reason and keeps an unstarted change in backlog', async () => {
    const root = await setupOpenSpecWorkspace();
    await createChangeEpic(root, 'unplanned');
    await createChangeEpic(root, 'empty-plan', { tasks: '## 1. Setup\n' });
    await createChangeEpic(root, 'planned', { tasks: '- [ ] 1.1 todo\n' });

    const { stdout } = await spawnCli(['--json', 'board', '--cwd', root], root);
    const result = JSON.parse(stdout) as MirrorBoard;

    expect(result.warnings.filter((warning) => warning.code === 'no-task-plan')).toEqual([
      expect.objectContaining({ details: { change: 'empty-plan', reason: 'empty' } }),
      expect.objectContaining({ details: { change: 'unplanned', reason: 'missing' } }),
    ]);
    expect(result.ungrouped.find((change) => change.slug === 'planned')?.status).toBe('backlog');
  }, 30_000);

  it('degrades to an empty board when OpenSpec workspace is absent', async () => {
    const root = await setupProject();

    const { stdout } = await spawnCli(['--json', 'board', '--cwd', root], root);
    const result = JSON.parse(stdout) as MirrorBoard;

    expect(result.sprints).toEqual([]);
    expect(result.ungrouped).toEqual([]);
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'adapter-unavailable' })]),
    );
    expect(result.next).toBeNull();
  }, 30_000);

  it('status reports delivery drift for ungroomed changes', async () => {
    const root = await setupOpenSpecWorkspace();
    await writeOpenSpecChange(root, 'ungroomed-one', { tasks: '- [ ] todo\n' });

    const { stdout } = await spawnCli(['--json', 'status', '--cwd', root], root);
    const status = JSON.parse(stdout);
    expect(status.drift.warnings).toBeGreaterThanOrEqual(1);
    expect(status.drift.codes['ungroomed-change']).toBe(1);

    const human = await spawnCli(['status', '--cwd', root], root);
    expect(human.stdout).toContain('Delivery drift: ungroomed-change');
    expect(human.stdout).toContain('spego-groom');
  }, 30_000);

  it('status omits drift when no OpenSpec workspace exists', async () => {
    const root = await setupProject();
    const { stdout } = await spawnCli(['--json', 'status', '--cwd', root], root);
    const status = JSON.parse(stdout);
    expect(status.drift).toBeUndefined();
  }, 30_000);

  it('lists board in commands JSON metadata', async () => {
    const { stdout } = await spawnCli(['--json', 'commands']);
    const commands = JSON.parse(stdout) as CommandMeta[];
    expect(commands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'board', category: 'planning', slashName: '/spego:board' }),
      ]),
    );
  });

  it('renders the signals column as nonzero counts joined by middle dots, or an em dash when all zero', async () => {
    const root = await setupOpenSpecWorkspace();
    await createChangeEpic(root, 'plain-change', { tasks: '- [ ] todo\n' });
    await createChangeEpic(root, 'signal-change', {
      tasks: '- [ ] todo\n',
      meta: { deps: ['plain-change'], gaps: [{ flag: 'g1', note: 'one' }, { flag: 'g2', note: 'two' }] },
    });

    const { stdout } = await spawnCli(['board', '--cwd', root], root, { env: { COLUMNS: '160' } });
    const signalLine = stdout.split('\n').find((line) => line.includes('signal-change'))!;
    expect(signalLine).toContain('1 blk · 2 gap');
    expect(signalLine).not.toContain('mis');

    const plainLine = stdout.split('\n').find((line) => line.includes('plain-change'))!;
    expect(plainLine).toContain('—');
  }, 30_000);

  it('keeps the change slug untruncated when the terminal is too narrow for every column', async () => {
    const root = await setupOpenSpecWorkspace();
    const longSlug = 'a-very-long-and-descriptive-change-slug';
    await createChangeEpic(root, longSlug, { tasks: '- [ ] todo\n' });
    await createArtifact(root, 'sprint-plan', 'Sprint 1', { status: 'active', changes: [longSlug] });

    const { stdout } = await spawnCli(['board', '--cwd', root], root, { env: { COLUMNS: '60' } });
    expect(stdout).toContain(longSlug);
  }, 30_000);

  it('renders footer hints for signals detail and pending mechanical fixes when conditions hold', async () => {
    const root = await setupOpenSpecWorkspace();
    await createChangeEpic(root, 'has-gap', {
      tasks: '- [ ] todo\n',
      meta: { gaps: [{ flag: 'needs-review', note: 'awaiting sign-off' }] },
    });
    await writeOpenSpecChange(root, 'ungroomed-one', { tasks: '- [ ] todo\n' });

    const { stdout } = await spawnCli(['board', '--cwd', root], root);
    expect(stdout).toContain('spego board --gaps');
    expect(stdout).toContain('1 mechanical fix — run spego sync');
  }, 30_000);

  it('omits footer hints when no rendered change has signals and the mechanical plan is empty', async () => {
    const root = await setupOpenSpecWorkspace();
    await createChangeEpic(root, 'plain-change', { tasks: '- [ ] todo\n' });

    const { stdout } = await spawnCli(['board', '--cwd', root], root);
    expect(stdout).not.toContain('spego board --gaps');
    expect(stdout).not.toContain('mechanical fix');
  }, 30_000);

  it('keeps the --json payload as full signal arrays with no signals counter string', async () => {
    const root = await setupBoardFixture();
    const { stdout } = await spawnCli(['--json', 'board', '--cwd', root], root);
    const result = JSON.parse(stdout) as MirrorBoard;
    const addUi = result.sprints[0]!.changes.find((change) => change.slug === 'add-ui')!;
    expect(addUi.blockers).toEqual([]);
    expect(addUi.gaps).toEqual([{ flag: 'api-contract', note: 'API artifact missing' }]);
    expect(addUi.missing).toEqual(['api']);
    expect(stdout).not.toContain('"signals"');
    expect(result.warnings.some((warning) => /includes archived change/.test(warning.message))).toBe(false);
  }, 30_000);

  it('board --sync applies the mechanical plan before rendering, grooming an ungroomed change', async () => {
    const root = await setupOpenSpecWorkspace();
    await writeOpenSpecChange(root, 'ungroomed-one', { tasks: '- [ ] todo\n' });

    const { stdout: beforeOut } = await spawnCli(['--json', 'board', '--cwd', root], root);
    const beforeBoard = JSON.parse(beforeOut);
    expect(beforeBoard.warnings.some((w) => w.code === 'ungroomed-change')).toBe(true);

    await spawnCli(['board', '--sync', '--cwd', root], root);

    await withEngine(root, async (engine) => {
      const epic = await engine.readByTypeSlug('epic', 'ungroomed-one');
      expect(epic.frontmatter.slug).toBe('ungroomed-one');
    });

    const { stdout: afterOut } = await spawnCli(['--json', 'board', '--cwd', root], root);
    const afterBoard = JSON.parse(afterOut);
    expect(afterBoard.warnings.some((w) => w.code === 'ungroomed-change')).toBe(false);
  }, 30_000);

  it('plain board writes nothing to the .spego artifacts', async () => {
    const root = await setupBoardFixture();
    const before = await artifactSnapshot(root);
    await spawnCli(['board', '--cwd', root], root);
    expect(await artifactSnapshot(root)).toEqual(before);
  }, 30_000);

  it('--json carries both estimates, the rung, and the sprint total in a priced workspace', async () => {
    const root = await setupPricedBoardFixture();
    const { stdout } = await spawnCli(['--json', 'board', '--cwd', root], root);
    expect(ANSI_PATTERN.test(stdout)).toBe(false);
    const result = JSON.parse(stdout) as MirrorBoard;

    const sprint = result.sprints[0]!;
    const bySlug = new Map(sprint.changes.map((change) => [change.slug, change]));
    expect(bySlug.get('priced-a')).toMatchObject({ flowEstimate: 2, humanEstimate: 16, rung: 'config-seed' });
    expect(bySlug.get('priced-b')).toMatchObject({ flowEstimate: 2, humanEstimate: 6, rung: 'config-seed' });
    expect(bySlug.get('untiered-c') && 'flowEstimate' in bySlug.get('untiered-c')!).toBe(false);
    expect(bySlug.get('done-d')).toMatchObject({ flowEstimate: 4, humanEstimate: 40, rung: 'config-seed' });
    expect(sprint.flowTotal).toBe(4);
    expect(sprint.unpricedPending).toBe(1);
  }, 30_000);

  it('renders the hours column and the sprint total in a priced workspace', async () => {
    const root = await setupPricedBoardFixture();
    const { stdout } = await spawnCli(['board', '--cwd', root], root, { env: { COLUMNS: '160' } });
    const plain = stripAnsi(stdout);

    expect(plain).toMatch(/id\s+change\s+status\s+group\s+hours\s+signals/);
    expect(plain).toContain('4+?h');
    const untieredRow = plain.split('\n').find((line) => line.includes('untiered-c'))!;
    expect(untieredRow).toContain('?');
    const pricedRow = plain.split('\n').find((line) => line.includes('priced-a'))!;
    expect(pricedRow).toContain('2');
  }, 30_000);

  it('omits the hours column and totals when the workspace declares no flows block', async () => {
    const root = await setupBoardFixture();
    const { stdout } = await spawnCli(['board', '--cwd', root], root, { env: { COLUMNS: '160' } });
    const plain = stripAnsi(stdout);

    expect(plain).not.toContain('hours');
    expect(plain).not.toMatch(/\dh\b/);

    const { stdout: jsonOut } = await spawnCli(['--json', 'board', '--cwd', root], root);
    const result = JSON.parse(jsonOut) as MirrorBoard;
    expect('flowTotal' in result.sprints[0]!).toBe(false);
    for (const sprint of result.sprints) {
      for (const change of sprint.changes) {
        expect('flowEstimate' in change).toBe(false);
        expect('humanEstimate' in change).toBe(false);
        expect('rung' in change).toBe(false);
      }
    }
  }, 30_000);

  it('--plain output is ANSI-free in a priced workspace', async () => {
    const root = await setupPricedBoardFixture();
    const { stdout } = await spawnCli(['board', '--plain', '--cwd', root], root);
    expect(ANSI_PATTERN.test(stdout)).toBe(false);
    expect(stdout).toContain('4+?h');
  }, 30_000);

  it('--json reports the rung per priced change', async () => {
    const root = await setupLadderBoardFixture();
    const { stdout } = await spawnCli(['--json', 'board', '--cwd', root], root);
    const result = JSON.parse(stdout) as MirrorBoard;
    const bySlug = new Map(result.sprints[0]!.changes.map((change) => [change.slug, change]));
    expect(bySlug.get('priced-a')).toMatchObject({ flowEstimate: 4, rung: 'observed' });
    expect(bySlug.get('priced-b')).toMatchObject({ flowEstimate: 2, rung: 'config-seed' });
  }, 30_000);

  it('--json reports all three rungs against a seeded cross-project store', async () => {
    const { root, storeRoot } = await setupCrossProjectBoardFixture();
    const { stdout } = await spawnCli(['--json', 'board', '--cwd', root], root, {
      env: { SPEGO_STORE_ROOT: storeRoot },
    });
    const result = JSON.parse(stdout) as MirrorBoard;
    const bySlug = new Map(result.sprints[0]!.changes.map((change) => [change.slug, change]));
    expect(bySlug.get('priced-a')).toMatchObject({ flowEstimate: 4, rung: 'observed' });
    expect(bySlug.get('priced-b')).toMatchObject({ flowEstimate: 8, rung: 'cross-project' });
    expect(bySlug.get('done-d')).toMatchObject({ flowEstimate: 4, rung: 'config-seed' });
  }, 30_000);

  it('ignores the store when the workspace does not opt in', async () => {
    const root = await setupPricedBoardFixture();
    const storeRoot = await seedStore(root, [
      { flow: 'opsx-apply', tier: 's', hours: 6 },
      { flow: 'opsx-apply', tier: 's', hours: 8 },
      { flow: 'opsx-apply', tier: 's', hours: 10 },
    ]);
    const { stdout } = await spawnCli(['--json', 'board', '--cwd', root], root, {
      env: { SPEGO_STORE_ROOT: storeRoot },
    });
    const result = JSON.parse(stdout) as MirrorBoard;
    const bySlug = new Map(result.sprints[0]!.changes.map((change) => [change.slug, change]));
    expect(bySlug.get('priced-b')).toMatchObject({ flowEstimate: 2, rung: 'config-seed' });
  }, 30_000);

  it('marks observed hours with a star and a legend in human output', async () => {
    const root = await setupLadderBoardFixture();
    const { stdout } = await spawnCli(['board', '--cwd', root], root, { env: { COLUMNS: '160' } });
    const plain = stripAnsi(stdout);

    const observedRow = plain.split('\n').find((line) => line.includes('priced-a'))!;
    expect(observedRow).toContain('4*');
    const seedRow = plain.split('\n').find((line) => line.includes('priced-b'))!;
    expect(seedRow).toContain('2');
    expect(seedRow).not.toContain('2*');
    expect(plain).toContain('* observed — median of recorded runs');
  }, 30_000);

  it('--json carries bias per priced change and one warning entry per drifted pair', async () => {
    const root = await setupBiasBoardFixture();
    const { stdout } = await spawnCli(['--json', 'board', '--cwd', root], root);
    const result = JSON.parse(stdout) as MirrorBoard;
    const bySlug = new Map(result.sprints[0]!.changes.map((change) => [change.slug, change]));

    expect(bySlug.get('priced-a')).toMatchObject({ bias: 2.5, flowEstimate: 4, rung: 'config-seed' });
    expect(bySlug.get('priced-b') && 'bias' in bySlug.get('priced-b')!).toBe(false);
    expect(bySlug.get('priced-b')?.flowEstimate).toBe(2);

    const stale = result.warnings.filter((warning) => warning.code === 'stale-profile');
    expect(stale.length).toBe(2);
    const byTier = new Map(stale.map((warning) => [warning.details?.tier, warning]));
    expect(byTier.get('m')?.details).toMatchObject({ flow: 'zapply', direction: 'over', bias: 2.5 });
    expect(byTier.get('l')?.details).toMatchObject({ flow: 'zapply', direction: 'under', bias: 0.25 });
  }, 30_000);

  it('aggregates drifted pairs into one stale-profile row in human output', async () => {
    const root = await setupBiasBoardFixture();
    const { stdout } = await spawnCli(['board', '--cwd', root], root, { env: { COLUMNS: '160' } });
    const plain = stripAnsi(stdout);
    const rows = plain.split('\n').filter((line) => line.includes('stale-profile'));
    expect(rows.length).toBe(1);
    expect(rows[0]).toContain('zapply/m');
    expect(rows[0]).toContain('zapply/l');
  }, 30_000);

  it('shows every change slug in full on a narrow terminal in a priced workspace', async () => {
    const root = await setupPricedBoardFixture();
    const { stdout } = await spawnCli(['board', '--cwd', root], root, { env: { COLUMNS: '60' } });
    const plain = stripAnsi(stdout);
    for (const slug of ['priced-a', 'priced-b', 'untiered-c', 'done-d']) {
      expect(plain).toContain(slug);
    }
  }, 30_000);
});
