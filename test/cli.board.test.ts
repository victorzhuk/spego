import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { ArtifactEngine } from '../src/artifacts/engine.js';
import { initWorkspace } from '../src/workspace/init.js';
import { makeTempProject } from './helpers.js';
import { spawnCli } from './_cli-helpers.js';
import type { ArtifactRecord } from '../src/artifacts/types.js';
import type { CommandMeta } from '../src/command-meta/registry.js';
import type { MirrorBoard } from '../src/delivery/mirror.js';

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
  await createChangeEpic(root, 'wave-a', { tasks: '- [ ] todo\n' });
  await createChangeEpic(root, 'wave-b', { tasks: '- [ ] todo\n' });
  await createChangeEpic(root, 'wave-c', {
    tasks: '- [ ] todo\n',
    meta: { deps: ['wave-a'] },
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
async function setupStyledPanelFixture(): Promise<string> {
  const root = await setupOpenSpecWorkspace();
  await createChangeEpic(root, 'ship-api', {
    tasks: '- [x] design\n',
    meta: { deps: ['ghost'] },
  });
  await createChangeEpic(root, 'ship-ui', {
    tasks: '- [ ] build\n',
    meta: { deps: ['ghost'] },
  });
  await createArtifact(root, 'sprint-plan', 'Sprint 1', {
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

  it('computes parallel-wave groups: independent changes share a group, blocked changes get a later one', async () => {
    const root = await setupWaveFixture();
    const { stdout } = await spawnCli(['--json', 'board', '--cwd', root], root);
    const result = JSON.parse(stdout) as MirrorBoard;
    const bySlug = new Map(result.ungrouped.map((change) => [change.slug, change]));

    expect(bySlug.get('wave-a')?.group).toBe('g001');
    expect(bySlug.get('wave-b')?.group).toBe('g001');
    expect(bySlug.get('wave-c')?.group).toBe('g002');
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
    const { stdout } = await spawnCli(['board', '--cwd', root], root);
    expect(stdout).toContain('╭─ Sprint 1 · active · sprint-1');
    expect(stdout).toContain('╭─ Warnings');

    const lines = stdout.split('\n');
    const panelStarts = lines.reduce<number[]>((acc, line, index) => {
      if (line.startsWith('╭─')) acc.push(index);
      return acc;
    }, []);
    expect(panelStarts.length).toBe(2);

    for (const start of panelStarts) {
      const end = lines.findIndex((line, index) => index > start && /^╰─+╯$/.test(line));
      expect(end).toBeGreaterThan(start);
      const panelLines = lines.slice(start, end + 1);
      // Top closes on the right with ╮, bottom with ╯, every body line with │.
      expect(panelLines[0]).toMatch(/╮$/);
      expect(panelLines.at(-1)).toMatch(/^╰─+╯$/);
      for (const body of panelLines.slice(1, -1)) {
        expect(body).toMatch(/│$/);
      }
      const widths = new Set(panelLines.map((line) => line.length));
      expect(widths.size).toBe(1);
    }
  }, 30_000);

  it('does not warn when archived changes sit in a live sprint', async () => {
    const root = await setupArchivedInSprintFixture();
    const { stdout: jsonOut } = await spawnCli(['--json', 'board', '--cwd', root], root);
    const jsonBoard = JSON.parse(jsonOut) as MirrorBoard;
    expect(jsonBoard.warnings).toEqual([]);

    const { stdout } = await spawnCli(['board', '--cwd', root], root, { env: { COLUMNS: '160' } });
    expect(stdout).not.toContain('includes archived changes');
  }, 30_000);

  it('renders the group as a letter in human output while --json keeps the gNNN code', async () => {
    const root = await setupWaveFixture();
    const { stdout: jsonOut } = await spawnCli(['--json', 'board', '--cwd', root], root);
    const jsonBoard = JSON.parse(jsonOut) as MirrorBoard;
    expect(new Set(jsonBoard.ungrouped.map((change) => change.group))).toEqual(new Set(['g001', 'g002']));

    const { stdout } = await spawnCli(['board', '--cwd', root], root);
    expect(stdout).not.toContain('g001');
    expect(stdout).not.toContain('g002');
    const waveCLine = stdout.split('\n').find((line) => line.includes('wave-c'))!;
    expect(waveCLine).toContain('B');
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

  it("grows the narrower table's last column to close the gap instead of leaving dead space", async () => {
    const root = await setupOpenSpecWorkspace();
    await createChangeEpic(root, 'x', { tasks: '- [ ] todo\n' });
    await createArtifact(root, 'sprint-plan', 'Sprint 1', { status: 'active', changes: ['x'] });
    const longDep = 'a-genuinely-long-and-descriptive-missing-dependency-name-for-testing';
    await createChangeEpic(root, 'has-dangling', { tasks: '- [ ] todo\n', meta: { deps: [longDep] } });

    const { stdout } = await spawnCli(['board', '--cwd', root], root, { env: { COLUMNS: '200' } });
    const lines = stdout.split('\n');
    const dividerContentLength = (line: string): number => line.replace(/^│ /, '').trimEnd().length;
    const sprintDivider = lines[lines.findIndex((line) => line.startsWith('╭─') && line.includes('sprint-1')) + 2]!;
    const warningsDivider = lines[lines.findIndex((line) => line.startsWith('╭─ Warnings')) + 2]!;
    expect(dividerContentLength(sprintDivider)).toBe(dividerContentLength(warningsDivider));
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
});
