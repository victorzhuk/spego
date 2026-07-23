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

  it('renders blockers as short ids in the human board table', async () => {
    const root = await setupWaveFixture();
    const { stdout: jsonOut } = await spawnCli(['--json', 'board', '--cwd', root], root);
    const jsonBoard = JSON.parse(jsonOut) as MirrorBoard;
    const waveAId = jsonBoard.ungrouped.find((change) => change.slug === 'wave-a')?.id;
    expect(waveAId).toMatch(/^c[0-9a-f]{4,}$/);

    const { stdout } = await spawnCli(['board', '--cwd', root], root);
    const waveCLine = stdout.split('\n').find((line) => line.includes('wave-c'));

    expect(waveCLine).toContain(waveAId);
    expect(waveCLine).not.toContain('wave-a');
  }, 30_000);

  it('honors --plain to suppress ANSI color even when color is forced on', async () => {
    const root = await setupWaveFixture();
    const withColor = await spawnCli(['board', '--cwd', root], root, { env: { FORCE_COLOR: '1' } });
    expect(withColor.stdout).toContain('\x1b[');

    const plain = await spawnCli(['board', '--plain', '--cwd', root], root, { env: { FORCE_COLOR: '1' } });
    expect(plain.stdout).not.toContain('\x1b[');
  }, 30_000);

  it('renders human board, dependency graph, and gaps report', async () => {
    const root = await setupBoardFixture();
    const board = await spawnCli(['board', '--cwd', root], root);
    expect(board.stdout).toContain('Delivery board');
    expect(board.stdout).toContain('Sprint sprint-1');
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
    await writeOpenSpecChange(root, 'archived-in-sprint', { tasks: '- [x] done\n', archived: true });
    await withEngine(root, (engine) =>
      engine.create({ type: 'epic', title: 'archived-in-sprint', slug: 'archived-in-sprint', body: '', meta: {} }),
    );
    await createArtifact(root, 'sprint-plan', 'Sprint 1', {
      status: 'active',
      startDate: '2026-01-01',
      changes: ['archived-in-sprint'],
    });

    const { stdout: defaultOut } = await spawnCli(['--json', 'board', '--cwd', root], root);
    const defaultResult = JSON.parse(defaultOut) as MirrorBoard;
    expect(defaultResult.sprints[0]!.changes.map((change) => change.slug)).toEqual(['archived-in-sprint']);

    const { stdout: archivedOut } = await spawnCli(['--json', 'board', '--archived', '--cwd', root], root);
    const archivedResult = JSON.parse(archivedOut) as MirrorBoard;
    expect(archivedResult.sprints[0]!.changes.map((change) => change.slug)).toEqual(['archived-in-sprint']);

    const human = await spawnCli(['board', '--cwd', root], root);
    expect(human.stdout).toContain('archived-in-sprint');
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
});
