import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { ArtifactEngine } from '../src/artifacts/engine.js';
import { initWorkspace } from '../src/workspace/init.js';
import { readArtifactFile, renderArtifactFile } from '../src/artifacts/storage.js';
import type { ArtifactFrontmatter } from '../src/artifacts/types.js';
import { makeTempProject } from './helpers.js';
import { expectCliFailure, spawnCli } from './_cli-helpers.js';
import type { MirrorBoard } from '../src/delivery/mirror.js';

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const fn of cleanups.splice(0)) await fn();
});

async function setupWorkspace(): Promise<string> {
  const { root, cleanup } = await makeTempProject();
  cleanups.push(cleanup);
  await initWorkspace({ projectRoot: root, agents: ['claude'] });
  await fs.mkdir(path.join(root, 'openspec'), { recursive: true });
  await fs.writeFile(path.join(root, 'openspec', 'config.yaml'), '', 'utf8');
  return root;
}

async function writeOpenSpecChange(root: string, name: string, tasks: string): Promise<void> {
  const dir = path.join(root, 'openspec', 'changes', name);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, '.openspec.yaml'), 'schema: spec-driven\n', 'utf8');
  await fs.writeFile(path.join(dir, 'proposal.md'), `# ${name}\n`, 'utf8');
  await fs.writeFile(path.join(dir, 'tasks.md'), tasks, 'utf8');
}

async function withEngine<T>(root: string, fn: (engine: ArtifactEngine) => Promise<T>): Promise<T> {
  const engine = await ArtifactEngine.open({ projectRoot: root });
  try {
    return await fn(engine);
  } finally {
    engine.close();
  }
}

/** A nonempty indexed board: two changes scheduled into one sprint. */
async function setupIndexedFixture(): Promise<string> {
  const root = await setupWorkspace();
  await writeOpenSpecChange(root, 'add-api', '- [ ] todo\n');
  await writeOpenSpecChange(root, 'add-ui', '- [ ] todo\n');
  await withEngine(root, async (engine) => {
    await engine.create({ type: 'epic', title: 'add-api', slug: 'add-api', body: '', meta: {} });
    await engine.create({ type: 'epic', title: 'add-ui', slug: 'add-ui', body: '', meta: {} });
    await engine.create({
      type: 'sprint-plan',
      title: 'Sprint 1',
      body: '',
      meta: {
        status: 'active',
        startDate: '2026-01-01',
        endDate: '2026-01-14',
        changes: ['add-api', 'add-ui'],
      },
    });
  });
  return root;
}

/** Write a canonical artifact file outside the engine, so the index never sees it. */
async function writeUnindexedArtifact(
  root: string,
  type: string,
  title: string,
  slug: string,
  meta: Record<string, unknown> = {},
): Promise<string> {
  const now = new Date().toISOString();
  const fm: ArtifactFrontmatter = {
    id: randomUUID(),
    type,
    title,
    slug,
    revision: 1,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    meta,
  };
  const filePath = path.join(root, '.spego', 'artifacts', type, `${slug}.md`);
  await fs.writeFile(filePath, renderArtifactFile(fm, ''), 'utf8');
  return filePath;
}

/** Rewrite a canonical artifact's frontmatter on disk without touching the index. */
async function editArtifactMeta(root: string, type: string, slug: string, meta: Record<string, unknown>): Promise<void> {
  const filePath = path.join(root, '.spego', 'artifacts', type, `${slug}.md`);
  const { frontmatter, body } = await readArtifactFile(filePath);
  const fm: ArtifactFrontmatter = {
    ...frontmatter,
    meta,
    revision: frontmatter.revision + 1,
    updatedAt: new Date().toISOString(),
  };
  await fs.writeFile(filePath, renderArtifactFile(fm, body), 'utf8');
}

async function boardJson(root: string, extra: string[] = []): Promise<MirrorBoard> {
  const res = await spawnCli(['--json', 'board', ...extra, '--cwd', root], root);
  return JSON.parse(res.stdout) as MirrorBoard;
}

function sprintSlugs(board: MirrorBoard): string[] {
  return board.sprints.flatMap((sprint) => sprint.changes.map((change) => change.slug));
}

function ungroupedSlugs(board: MirrorBoard): string[] {
  return board.ungrouped.map((change) => change.slug);
}

describe('CLI board --fresh', () => {
  it('follows canonical sprint membership edited after indexing', async () => {
    const root = await setupIndexedFixture();
    await editArtifactMeta(root, 'sprint-plan', 'sprint-1', {
      status: 'active',
      startDate: '2026-01-01',
      endDate: '2026-01-14',
      changes: ['add-ui'],
    });

    const indexed = await boardJson(root);
    const fresh = await boardJson(root, ['--fresh']);

    expect(sprintSlugs(indexed)).toEqual(['add-api', 'add-ui']);
    expect(sprintSlugs(fresh)).toEqual(['add-ui']);
    expect(ungroupedSlugs(fresh)).toContain('add-api');
    expect(ungroupedSlugs(indexed)).not.toContain('add-api');
  });

  it('resolves a linked artifact that exists only on disk', async () => {
    const root = await setupWorkspace();
    await writeOpenSpecChange(root, 'add-api', '- [ ] todo\n');
    const design = await writeUnindexedArtifact(root, 'design', 'API Design', 'api-design');
    const designId = (await readArtifactFile(design)).frontmatter.id;
    await withEngine(root, async (engine) => {
      await engine.create({ type: 'epic', title: 'add-api', slug: 'add-api', body: '', meta: {} });
      await engine.create({
        type: 'sprint-plan',
        title: 'Sprint 1',
        body: '',
        meta: {
          status: 'active',
          startDate: '2026-01-01',
          endDate: '2026-01-14',
          changes: ['add-api'],
          requires: ['design'],
          links: [designId],
        },
      });
    });

    const indexed = await boardJson(root);
    const fresh = await boardJson(root, ['--fresh']);

    expect(indexed.sprints[0]!.missing).toEqual(['design']);
    expect(fresh.sprints[0]!.missing).toEqual([]);
  });

  it('discovers canonical additions and removals without reindexing', async () => {
    const root = await setupWorkspace();
    await writeOpenSpecChange(root, 'add-ui', '- [ ] todo\n');
    await writeOpenSpecChange(root, 'add-new', '- [ ] todo\n');
    await withEngine(root, async (engine) => {
      await engine.create({ type: 'epic', title: 'add-ui', slug: 'add-ui', body: '', meta: { requires: ['design'] } });
    });
    await writeUnindexedArtifact(root, 'epic', 'add-new', 'add-new', { requires: ['design'] });
    await fs.rm(path.join(root, '.spego', 'artifacts', 'epic', 'add-ui.md'));

    const indexed = await boardJson(root);
    const fresh = await boardJson(root, ['--fresh']);

    const indexedUi = indexed.ungrouped.find((change) => change.slug === 'add-ui');
    const freshUi = fresh.ungrouped.find((change) => change.slug === 'add-ui');
    expect(indexedUi?.missing).toEqual(['design']);
    expect(freshUi?.missing).toEqual([]);

    const indexedNew = indexed.ungrouped.find((change) => change.slug === 'add-new');
    const freshNew = fresh.ungrouped.find((change) => change.slug === 'add-new');
    expect(indexedNew?.missing).toEqual([]);
    expect(freshNew?.missing).toEqual(['design']);
  });

  it('renders the canonical board with the index directory absent', async () => {
    const root = await setupIndexedFixture();
    await fs.rm(path.join(root, '.spego', 'index'), { recursive: true, force: true });

    const fresh = await boardJson(root, ['--fresh']);
    expect(sprintSlugs(fresh)).toEqual(['add-api', 'add-ui']);
  });

  it('rejects --fresh --sync before opening the engine', async () => {
    const root = await setupIndexedFixture();
    await fs.rm(path.join(root, '.spego', 'index'), { recursive: true, force: true });

    const err = await expectCliFailure(['--json', 'board', '--fresh', '--sync', '--cwd', root], root);
    const text = `${err.stdout}${err.stderr}`;
    expect(text).toContain('--fresh cannot be combined with --sync');
    expect(text).toContain('VALIDATION_FAILED');
    await expect(fs.stat(path.join(root, '.spego', 'index'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rejects duplicate canonical artifact ids', async () => {
    const root = await setupIndexedFixture();
    const original = path.join(root, '.spego', 'artifacts', 'epic', 'add-api.md');
    const text = await fs.readFile(original, 'utf8');
    await fs.writeFile(path.join(root, '.spego', 'artifacts', 'epic', 'add-api-copy.md'), text, 'utf8');

    const err = await expectCliFailure(['--json', 'board', '--fresh', '--cwd', root], root);
    expect(`${err.stdout}${err.stderr}`).toContain('Duplicate artifact id');
  });

  it('propagates malformed canonical frontmatter', async () => {
    const root = await setupIndexedFixture();
    await fs.writeFile(path.join(root, '.spego', 'artifacts', 'epic', 'broken.md'), 'not frontmatter\n', 'utf8');

    const err = await expectCliFailure(['--json', 'board', '--fresh', '--cwd', root], root);
    expect(`${err.stdout}${err.stderr}`).toContain('VALIDATION_FAILED');
  });

  it('rejects a symlinked canonical file', async () => {
    const root = await setupIndexedFixture();
    await fs.symlink(
      path.join(root, '.spego', 'artifacts', 'epic', 'add-api.md'),
      path.join(root, '.spego', 'artifacts', 'epic', 'alias.md'),
    );

    const err = await expectCliFailure(['--json', 'board', '--fresh', '--cwd', root], root);
    expect(`${err.stdout}${err.stderr}`).toContain('WORKSPACE_CONTAINMENT');
  });
});
