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

describe('CLI board command', () => {
  it('returns deterministic JSON board shape with warnings envelope', async () => {
    const root = await setupBoardFixture();
    const { stdout } = await spawnCli(['--json', 'board', '--cwd', root], root);
    const result = JSON.parse(stdout) as MirrorBoard;

    expect(Object.keys(result)).toEqual(['sprints', 'ungrouped', 'warnings', 'next']);
    expect(result.sprints.map((sprint) => sprint.slug)).toEqual(['sprint-1']);
    expect(result.sprints[0]!.changes.map((change) => change.slug)).toEqual(['add-api', 'add-ui']);
    expect(result.sprints[0]!.changes[1]).toMatchObject({
      slug: 'add-ui',
      blockers: [],
      missing: ['api'],
      gaps: [{ flag: 'api-contract', note: 'API artifact missing' }],
    });
    expect(Array.isArray(result.warnings)).toBe(true);
    expect(result.next).toMatchObject({ change: 'add-ui', sprint: 'sprint-1' });
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
