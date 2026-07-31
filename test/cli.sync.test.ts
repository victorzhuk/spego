import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { ArtifactEngine } from '../src/artifacts/engine.js';
import { initWorkspace } from '../src/workspace/init.js';
import { makeTempProject } from './helpers.js';
import { spawnCli, expectCliFailure } from './_cli-helpers.js';
import type { ArtifactRecord } from '../src/artifacts/types.js';

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
  opts: { tasks?: string } = {},
): Promise<void> {
  const changeDir = path.join(root, 'openspec', 'changes', changeName);
  await fs.mkdir(changeDir, { recursive: true });
  await fs.writeFile(path.join(changeDir, '.openspec.yaml'), 'schema: spec-driven\n', 'utf8');
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
    engine.create({ type: 'epic', title: changeName, slug: changeName, body: '', meta: opts.meta ?? {} }),
  );
}

async function listArtifactFiles(root: string): Promise<string[]> {
  const dir = path.join(root, '.spego', 'artifacts');
  try {
    const entries = await fs.readdir(dir, { recursive: true, withFileTypes: true });
    return entries.filter((e) => e.isFile()).map((e) => path.join(e.parentPath, e.name)).sort();
  } catch {
    return [];
  }
}

// One ungroomed (epic-less) change that is already done, scheduled alone in an active
// sprint: the mirror reports both closable-sprint and ungroomed-change.
async function setupReconcilable(): Promise<string> {
  const root = await setupOpenSpecWorkspace();
  await writeOpenSpecChange(root, 'add-foo', { tasks: '- [x] done\n' });
  await createArtifact(root, 'sprint-plan', 'Release', { status: 'active', changes: ['add-foo'] });
  return root;
}

describe('CLI sync command', () => {
  it('--dry-run derives the plan and writes nothing', async () => {
    const root = await setupReconcilable();
    const before = await listArtifactFiles(root);

    const { stdout } = await spawnCli(['--json', 'sync', '--dry-run', '--cwd', root], root);
    const payload = JSON.parse(stdout);
    expect(payload.dryRun).toBe(true);
    expect(payload.applied).toEqual([]);
    expect(payload.actions.length).toBe(2);

    expect(await listArtifactFiles(root)).toEqual(before);
    await withEngine(root, async (engine) => {
      expect(engine.list({ type: 'epic' })).toHaveLength(0);
      const sprint = await engine.readByTypeSlug('sprint-plan', 'release');
      expect(sprint.frontmatter.meta.status).toBe('active');
      expect(sprint.frontmatter.revision).toBe(1);
    });
  }, 30_000);

  it('applies the plan: creates the epic with the change slug and closes the sprint', async () => {
    const root = await setupReconcilable();

    await spawnCli(['sync', '--cwd', root], root);

    await withEngine(root, async (engine) => {
      const epic = await engine.readByTypeSlug('epic', 'add-foo');
      expect(epic.frontmatter.slug).toBe('add-foo');
      expect(epic.frontmatter.meta).toEqual({});
      const sprint = await engine.readByTypeSlug('sprint-plan', 'release');
      expect(sprint.frontmatter.meta.status).toBe('closed');
      expect(sprint.frontmatter.revision).toBe(2);
    });
  }, 30_000);

  it('is idempotent: a second run is a no-op', async () => {
    const root = await setupReconcilable();
    await spawnCli(['sync', '--cwd', root], root);

    const { stdout } = await spawnCli(['--json', 'sync', '--cwd', root], root);
    const payload = JSON.parse(stdout);
    expect(payload.actions).toEqual([]);
    expect(payload.applied).toEqual([]);
  }, 30_000);

  it('emits the { actions, applied, remaining } json shape', async () => {
    const root = await setupReconcilable();
    const { stdout } = await spawnCli(['--json', 'sync', '--cwd', root], root);
    const payload = JSON.parse(stdout);
    expect(Object.keys(payload).sort()).toEqual(['actions', 'applied', 'dryRun', 'remaining']);
    expect(Array.isArray(payload.actions)).toBe(true);
    expect(Array.isArray(payload.applied)).toBe(true);
    expect(Array.isArray(payload.remaining)).toBe(true);
    expect(payload.dryRun).toBe(false);
  }, 30_000);

  it('rejects a stale-revision conflict during close-sprint instead of skipping it', async () => {
    const root = await setupOpenSpecWorkspace();
    await createChangeEpic(root, 'done-thing', { tasks: '- [x] done\n' });
    await createArtifact(root, 'sprint-plan', 'Release', { status: 'active', changes: ['done-thing'] });

    // Bump the sprint-plan file revision out of band; the index still holds rev 1,
    // so sync's captured expectedRevision goes stale -> REVISION_CONFLICT, not a skip.
    await withEngine(root, async (engine) => {
      const record = await engine.readByTypeSlug('sprint-plan', 'release');
      const bumped = (await fs.readFile(record.path, 'utf8')).replace('revision: 1', 'revision: 2');
      await fs.writeFile(record.path, bumped, 'utf8');
    });

    const err = await expectCliFailure(['--json', 'sync', '--cwd', root], root);
    expect(err.code).toBe(2);
    const parsed = JSON.parse(err.stderr);
    expect(parsed.error.code).toBe('REVISION_CONFLICT');
    expect(parsed.error.details).toBeTruthy();
  }, 30_000);
});
