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

async function setupOpenSpecWorkspace(): Promise<string> {
  const { root, cleanup } = await makeTempProject();
  cleanups.push(cleanup);
  await initWorkspace({ projectRoot: root, agents: ['claude'] });
  await fs.mkdir(path.join(root, 'openspec'), { recursive: true });
  await fs.writeFile(path.join(root, 'openspec', 'config.yaml'), '', 'utf8');
  return root;
}

async function writeOpenSpecChange(root: string, changeName: string): Promise<void> {
  const changeDir = path.join(root, 'openspec', 'changes', changeName);
  await fs.mkdir(changeDir, { recursive: true });
  await fs.writeFile(path.join(changeDir, '.openspec.yaml'), 'schema: spec-driven\n', 'utf8');
  await fs.writeFile(path.join(changeDir, 'proposal.md'), `# ${changeName}\n`, 'utf8');
  await fs.writeFile(path.join(changeDir, 'tasks.md'), '- [ ] todo\n', 'utf8');
}

async function withEngine<T>(root: string, fn: (engine: ArtifactEngine) => Promise<T>): Promise<T> {
  const engine = await ArtifactEngine.open({ projectRoot: root });
  try {
    return await fn(engine);
  } finally {
    engine.close();
  }
}

async function createChangeEpic(
  root: string,
  changeName: string,
  meta: Record<string, unknown> = {},
): Promise<ArtifactRecord> {
  await writeOpenSpecChange(root, changeName);
  return withEngine(root, (engine) =>
    engine.create({ type: 'epic', title: changeName, slug: changeName, body: '', meta }),
  );
}

async function epicMeta(root: string, changeName: string): Promise<Record<string, unknown>> {
  return withEngine(root, async (engine) => {
    const epic = engine.list({ type: 'epic' }).find((item) => item.slug === changeName);
    if (!epic) throw new Error(`no epic for ${changeName}`);
    const record = await engine.readById(epic.id);
    return record.frontmatter.meta;
  });
}

async function snapshotTree(root: string, rel: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const base = path.join(root, rel);
  let entries;
  try {
    entries = await fs.readdir(base, { recursive: true, withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.isFile()) {
      const full = path.join(entry.parentPath, entry.name);
      out.set(path.relative(root, full), await fs.readFile(full, 'utf8'));
    }
  }
  return out;
}

describe('CLI record command', () => {
  it('appends a recorded run to the change epic', async () => {
    const root = await setupOpenSpecWorkspace();
    await createChangeEpic(root, 'add-auth', { deps: ['core/change-a'], tier: 'm', track: 'api-contract' });
    const { stdout } = await spawnCli(
      ['--json', 'record', 'add-auth', '--flow', 'zapply', '--hours', '1.75', '--cwd', root],
      root,
    );
    const payload = JSON.parse(stdout);
    expect(payload.change).toBe('add-auth');
    expect(payload.flow).toBe('zapply');
    expect(payload.hours).toBe(1.75);
    expect(payload.actuals).toEqual([{ flow: 'zapply', hours: 1.75 }]);

    const meta = await epicMeta(root, 'add-auth');
    expect(meta.actuals).toEqual([{ flow: 'zapply', hours: 1.75 }]);
    // the sole-writer carve-out: judged fields keep their values
    expect(meta.deps).toEqual(['core/change-a']);
    expect(meta.tier).toBe('m');
    expect(meta.track).toBe('api-contract');
  }, 30_000);

  it('accumulates a second run rather than replacing the first', async () => {
    const root = await setupOpenSpecWorkspace();
    await createChangeEpic(root, 'add-auth');
    await spawnCli(['record', 'add-auth', '--flow', 'zapply', '--hours', '1.75', '--cwd', root], root);
    const { stdout } = await spawnCli(
      ['--json', 'record', 'add-auth', '--flow', 'zapply', '--hours', '0.5', '--cwd', root],
      root,
    );
    const payload = JSON.parse(stdout);
    expect(payload.actuals).toEqual([
      { flow: 'zapply', hours: 1.75 },
      { flow: 'zapply', hours: 0.5 },
    ]);
    expect(payload.revision).toBe(3);
  }, 30_000);

  it('fails with a named error for an unknown change', async () => {
    const root = await setupOpenSpecWorkspace();
    const err = await expectCliFailure(
      ['--json', 'record', 'ghost-change', '--flow', 'zapply', '--hours', '1', '--cwd', root],
      root,
    );
    const envelope = JSON.parse(err.stderr);
    expect(envelope.error.code).toBe('CHANGE_NOT_FOUND');
    expect(envelope.error.message).toContain('ghost-change');
  }, 30_000);

  it('fails with a named error when the change has no epic', async () => {
    const root = await setupOpenSpecWorkspace();
    await writeOpenSpecChange(root, 'add-auth');
    const err = await expectCliFailure(
      ['--json', 'record', 'add-auth', '--flow', 'zapply', '--hours', '1', '--cwd', root],
      root,
    );
    const envelope = JSON.parse(err.stderr);
    expect(envelope.error.code).toBe('CHANGE_NOT_FOUND');
    expect(envelope.error.message).toContain('add-auth');
  }, 30_000);

  it('fails on a stale --expected-revision without writing', async () => {
    const root = await setupOpenSpecWorkspace();
    await createChangeEpic(root, 'add-auth');
    const err = await expectCliFailure(
      ['--json', 'record', 'add-auth', '--flow', 'zapply', '--hours', '1', '--expected-revision', '99', '--cwd', root],
      root,
    );
    const envelope = JSON.parse(err.stderr);
    expect(envelope.error.code).toBe('REVISION_CONFLICT');

    const meta = await epicMeta(root, 'add-auth');
    expect(meta.actuals).toBeUndefined();
  }, 30_000);

  it('fails on negative or non-finite hours naming the value', async () => {
    const root = await setupOpenSpecWorkspace();
    await createChangeEpic(root, 'add-auth');
    for (const hours of ['-1', 'NaN', 'Infinity']) {
      const err = await expectCliFailure(
        ['--json', 'record', 'add-auth', '--flow', 'zapply', '--hours', hours, '--cwd', root],
        root,
      );
      const envelope = JSON.parse(err.stderr);
      expect(envelope.error.code).toBe('VALIDATION_FAILED');
      expect(envelope.error.message).toContain(hours);
    }
    const meta = await epicMeta(root, 'add-auth');
    expect(meta.actuals).toBeUndefined();
  }, 30_000);

  it('fails on an empty flow name', async () => {
    const root = await setupOpenSpecWorkspace();
    await createChangeEpic(root, 'add-auth');
    const err = await expectCliFailure(
      ['--json', 'record', 'add-auth', '--flow', '', '--hours', '1', '--cwd', root],
      root,
    );
    const envelope = JSON.parse(err.stderr);
    expect(envelope.error.code).toBe('VALIDATION_FAILED');
  }, 30_000);

  it('writes nothing under openspec/ and mutates no other artifact', async () => {
    const root = await setupOpenSpecWorkspace();
    await createChangeEpic(root, 'add-auth');
    await createChangeEpic(root, 'add-ui');
    await withEngine(root, (engine) =>
      engine.create({ type: 'sprint-plan', title: 'Sprint 1', body: '', meta: { changes: ['add-auth', 'add-ui'] } }),
    );

    const artifactsBefore = await snapshotTree(root, '.spego/artifacts');
    const openspecBefore = await snapshotTree(root, 'openspec');

    await spawnCli(['record', 'add-auth', '--flow', 'zapply', '--hours', '2', '--cwd', root], root);

    const artifactsAfter = await snapshotTree(root, '.spego/artifacts');
    const openspecAfter = await snapshotTree(root, 'openspec');

    expect(openspecAfter).toEqual(openspecBefore);
    const changed = [...artifactsAfter.keys()].filter(
      (key) => artifactsBefore.get(key) !== artifactsAfter.get(key),
    );
    expect(changed.length).toBe(1);
    expect(changed[0]).toMatch(/epic[/\\]add-auth/);
  }, 30_000);
});
