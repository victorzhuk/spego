import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { ArtifactEngine } from '../src/artifacts/engine.js';
import { initWorkspace } from '../src/workspace/init.js';
import { atomicWriteFile } from '../src/artifacts/storage.js';
import { SpegoError } from '../src/errors.js';
import { makeTempProject } from './helpers.js';

const WS_DIR = '.spego';

describe('workspace symlink containment', () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    for (const fn of cleanups.splice(0)) await fn();
  });

  // Tasks 4.1–4.2 require source WORKSPACE_CONTAINMENT checks and are
  // intentionally RED until the source shard lands.

  describe('4.1 — directory symlink rejection', () => {
    it('init rejects when .spego is a symlink', async () => {
      const { root, cleanup } = await makeTempProject();
      cleanups.push(cleanup);
      const target = path.join(root, 'outside');
      await fs.mkdir(target, { recursive: true });
      await fs.symlink(target, path.join(root, WS_DIR));

      const err = await initWorkspace({ projectRoot: root }).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(SpegoError);
      expect((err as SpegoError).code).toBe('WORKSPACE_CONTAINMENT');
    });

    it('open rejects when artifacts dir is a symlink', async () => {
      const { root, cleanup } = await makeTempProject();
      cleanups.push(cleanup);
      await initWorkspace({ projectRoot: root, agents: ['claude'] });
      const outside = path.join(root, 'outside-artifacts');
      await fs.mkdir(outside, { recursive: true });
      const artifactsDir = path.join(root, WS_DIR, 'artifacts');
      await fs.rm(artifactsDir, { recursive: true, force: true });
      await fs.symlink(outside, artifactsDir);

      const err = await ArtifactEngine.open({ projectRoot: root }).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(SpegoError);
      expect((err as SpegoError).code).toBe('WORKSPACE_CONTAINMENT');
    });

    it('open rejects when revisions dir is a symlink', async () => {
      const { root, cleanup } = await makeTempProject();
      cleanups.push(cleanup);
      await initWorkspace({ projectRoot: root, agents: ['claude'] });
      const outside = path.join(root, 'outside-revisions');
      await fs.mkdir(outside, { recursive: true });
      const revDir = path.join(root, WS_DIR, 'revisions');
      await fs.rm(revDir, { recursive: true, force: true });
      await fs.symlink(outside, revDir);

      const err = await ArtifactEngine.open({ projectRoot: root }).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(SpegoError);
      expect((err as SpegoError).code).toBe('WORKSPACE_CONTAINMENT');
    });

    it('create rejects when artifact type dir is a symlink', async () => {
      const { root, cleanup } = await makeTempProject();
      cleanups.push(cleanup);
      await initWorkspace({ projectRoot: root, agents: ['claude'] });
      const engine = await ArtifactEngine.open({ projectRoot: root });
      const outside = path.join(root, 'outside-prd');
      await fs.mkdir(outside, { recursive: true });
      const prdDir = path.join(root, WS_DIR, 'artifacts', 'prd');
      await fs.rm(prdDir, { recursive: true, force: true });
      await fs.symlink(outside, prdDir);

      const err = await engine.create({ type: 'prd', title: 'X', body: 'x' }).catch((e: unknown) => e);
      engine.close();
      expect(err).toBeInstanceOf(SpegoError);
      expect((err as SpegoError).code).toBe('WORKSPACE_CONTAINMENT');
    });

    it('init rejects dangling .spego symlink', async () => {
      const { root, cleanup } = await makeTempProject();
      cleanups.push(cleanup);
      const target = path.join(root, 'nonexistent');
      await fs.symlink(target, path.join(root, WS_DIR));

      const err = await initWorkspace({ projectRoot: root }).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(SpegoError);
      expect((err as SpegoError).code).toBe('WORKSPACE_CONTAINMENT');
    });

    it('init rejects .spego symlink to outside created before init', async () => {
      const { root, cleanup } = await makeTempProject();
      cleanups.push(cleanup);
      // Create .spego dir and replace it with symlink the way a user would.
      const outside = path.join(root, 'outside-spego');
      await fs.mkdir(outside, { recursive: true });
      // Create a config.yaml that looks init'ed so we test the open path too.
      await fs.symlink(outside, path.join(root, WS_DIR));

      const err = await initWorkspace({ projectRoot: root }).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(SpegoError);
      expect((err as SpegoError).code).toBe('WORKSPACE_CONTAINMENT');
    });

    it('open rejects dangling artifacts type directory symlink', async () => {
      const { root, cleanup } = await makeTempProject();
      cleanups.push(cleanup);
      await initWorkspace({ projectRoot: root, agents: ['claude'] });
      const prdDir = path.join(root, WS_DIR, 'artifacts', 'prd');
      await fs.rm(prdDir, { recursive: true, force: true });
      await fs.symlink(path.join(root, 'nowhere'), prdDir);

      const err = await ArtifactEngine.open({ projectRoot: root }).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(SpegoError);
      expect((err as SpegoError).code).toBe('WORKSPACE_CONTAINMENT');
    });

    it('create rejects pre-existing dangling symlink for type directory', async () => {
      const { root, cleanup } = await makeTempProject();
      cleanups.push(cleanup);
      await initWorkspace({ projectRoot: root, agents: ['claude'] });
      const okrDir = path.join(root, WS_DIR, 'artifacts', 'okr');
      await fs.rm(okrDir, { recursive: true, force: true });
      await fs.symlink(path.join(root, 'missing-okr'), okrDir);

      const err = await ArtifactEngine.open({ projectRoot: root }).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(SpegoError);
      expect((err as SpegoError).code).toBe('WORKSPACE_CONTAINMENT');
    });

    it('open rejects when .spego replaced with symlink to outside dir', async () => {
      const { root, cleanup } = await makeTempProject();
      cleanups.push(cleanup);
      await initWorkspace({ projectRoot: root, agents: ['claude'] });
      const outside = path.join(root, 'outside-spego');
      await fs.mkdir(outside, { recursive: true });
      await fs.rm(path.join(root, WS_DIR), { recursive: true, force: true });
      await fs.symlink(outside, path.join(root, WS_DIR));

      const err = await ArtifactEngine.open({ projectRoot: root }).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(SpegoError);
      expect((err as SpegoError).code).toBe('WORKSPACE_CONTAINMENT');
    });

    it('open rejects when artifacts type dir is symlink to outside', async () => {
      const { root, cleanup } = await makeTempProject();
      cleanups.push(cleanup);
      await initWorkspace({ projectRoot: root, agents: ['claude'] });
      const outside = path.join(root, 'outside-prd');
      await fs.mkdir(outside, { recursive: true });
      const prdDir = path.join(root, WS_DIR, 'artifacts', 'prd');
      await fs.rm(prdDir, { recursive: true, force: true });
      await fs.symlink(outside, prdDir);

      const err = await ArtifactEngine.open({ projectRoot: root }).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(SpegoError);
      expect((err as SpegoError).code).toBe('WORKSPACE_CONTAINMENT');
    });

    it('open rejects dangling revisions type dir symlink', async () => {
      const { root, cleanup } = await makeTempProject();
      cleanups.push(cleanup);
      await initWorkspace({ projectRoot: root, agents: ['claude'] });
      const prdRevisions = path.join(root, WS_DIR, 'revisions', 'prd');
      await fs.rm(prdRevisions, { recursive: true, force: true });
      await fs.symlink(path.join(root, 'missing-prd-revisions'), prdRevisions);

      const err = await ArtifactEngine.open({ projectRoot: root }).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(SpegoError);
      expect((err as SpegoError).code).toBe('WORKSPACE_CONTAINMENT');
    });

    it('init rejects when index dir is a symlink to outside', async () => {
      const { root, cleanup } = await makeTempProject();
      cleanups.push(cleanup);
      const outside = path.join(root, 'outside-index');
      await fs.mkdir(outside, { recursive: true });
      await fs.mkdir(path.join(root, WS_DIR), { recursive: true });
      await fs.symlink(outside, path.join(root, WS_DIR, 'index'));

      const err = await initWorkspace({ projectRoot: root }).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(SpegoError);
      expect((err as SpegoError).code).toBe('WORKSPACE_CONTAINMENT');

      // No spego.db created outside the workspace.
      await expect(fs.stat(path.join(outside, 'spego.db'))).rejects.toThrow('ENOENT');
    });

    it('open rejects when index dir is a symlink to outside', async () => {
      const { root, cleanup } = await makeTempProject();
      cleanups.push(cleanup);
      await initWorkspace({ projectRoot: root, agents: ['claude'] });
      const outside = path.join(root, 'outside-index');
      await fs.mkdir(outside, { recursive: true });
      const indexDir = path.join(root, WS_DIR, 'index');
      await fs.rm(indexDir, { recursive: true, force: true });
      await fs.symlink(outside, indexDir);

      const err = await ArtifactEngine.open({ projectRoot: root }).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(SpegoError);
      expect((err as SpegoError).code).toBe('WORKSPACE_CONTAINMENT');

      // No spego.db created outside the workspace.
      await expect(fs.stat(path.join(outside, 'spego.db'))).rejects.toThrow('ENOENT');
    });
  });

  describe('4.2 — symlinked leaf file rejection', () => {
    async function validFrontmatter(
      id: string, slug: string, title: string,
    ): Promise<string> {
      return [
        '---',
        `id: "${id}"`,
        `type: "prd"`,
        `title: "${title}"`,
        `slug: "${slug}"`,
        'revision: 1',
        'createdAt: "2026-01-01T00:00:00Z"',
        'updatedAt: "2026-01-01T00:00:00Z"',
        'meta: {}',
        '---',
        '',
        'body',
      ].join('\n');
    }

    it('read rejects symlinked artifact file', async () => {
      const { root, cleanup } = await makeTempProject();
      cleanups.push(cleanup);
      await initWorkspace({ projectRoot: root, agents: ['claude'] });
      const engine = await ArtifactEngine.open({ projectRoot: root });
      const a = await engine.create({ type: 'prd', title: 'Alpha', body: 'orig' });
      engine.close();

      // Replace the artifact file with a symlink to an outside file sharing
      // the same id/slug so only the symlink check would flag it.
      const outside = path.join(root, 'outside-artifact.md');
      await fs.writeFile(outside, await validFrontmatter(a.frontmatter.id, a.frontmatter.slug, 'Alpha'));
      await fs.rm(a.path);
      await fs.symlink(outside, a.path);

      const engine2 = await ArtifactEngine.open({ projectRoot: root });
      const err = await engine2.readByTypeSlug('prd', a.frontmatter.slug).catch((e: unknown) => e);
      engine2.close();
      expect(err).toBeInstanceOf(SpegoError);
      expect((err as SpegoError).code).toBe('WORKSPACE_CONTAINMENT');
    });

    it('rebuild reports symlinked artifact in invalidFiles', async () => {
      const { root, cleanup } = await makeTempProject();
      cleanups.push(cleanup);
      await initWorkspace({ projectRoot: root, agents: ['claude'] });
      const engine = await ArtifactEngine.open({ projectRoot: root });
      await engine.create({ type: 'prd', title: 'Real', body: 'ok' });
      engine.close();

      // Symlink an external valid .md that would otherwise index cleanly.
      const outside = path.join(root, 'outside-valid.md');
      await fs.writeFile(outside, await validFrontmatter('ext', 'external', 'External'));
      const linkedFile = path.join(root, WS_DIR, 'artifacts', 'prd', 'external.md');
      await fs.symlink(outside, linkedFile);

      const engine2 = await ArtifactEngine.open({ projectRoot: root });
      const report = await engine2.rebuildIndex();
      engine2.close();
      expect(report.invalidFiles.some((f) => f.path === linkedFile)).toBe(true);
    });

    it('rebuild reports symlinked revision in invalidFiles', async () => {
      const { root, cleanup } = await makeTempProject();
      cleanups.push(cleanup);
      await initWorkspace({ projectRoot: root, agents: ['claude'] });
      const engine = await ArtifactEngine.open({ projectRoot: root });
      const a = await engine.create({ type: 'prd', title: 'T', body: 'v1' });
      engine.close();

      // Symlink a revision file with a non-matching id; current code skips
      // silently, source shard should detect and report the symlink.
      const outside = path.join(root, 'outside-rev.md');
      await fs.writeFile(outside, await validFrontmatter('other', 'other', 'Other'));
      const revFile = path.join(root, WS_DIR, 'revisions', 'prd', `${a.frontmatter.slug}.r99.md`);
      await fs.symlink(outside, revFile);

      const engine2 = await ArtifactEngine.open({ projectRoot: root });
      const report = await engine2.rebuildIndex();
      engine2.close();
      expect(report.invalidFiles.some((f) => f.path === revFile)).toBe(true);
    });
  });

  describe('4.3 — malformed fence and YAML detection during rebuild', () => {
    async function initWithOneValid(root: string): Promise<void> {
      await initWorkspace({ projectRoot: root, agents: ['claude'] });
      const engine = await ArtifactEngine.open({ projectRoot: root });
      await engine.create({ type: 'prd', title: 'Good', body: 'ok' });
      engine.close();
    }

    async function rebuild(root: string) {
      const eng = await ArtifactEngine.open({ projectRoot: root });
      try {
        return await eng.rebuildIndex();
      } finally {
        eng.close();
      }
    }

    it('reports missing opening fence', async () => {
      const { root, cleanup } = await makeTempProject();
      cleanups.push(cleanup);
      await initWithOneValid(root);
      await fs.writeFile(
        path.join(root, WS_DIR, 'artifacts', 'prd', 'no-fence.md'),
        'body without any frontmatter fence\n',
      );

      const report = await rebuild(root);
      const entry = report.invalidFiles.find((f) => f.path.endsWith('no-fence.md'));
      expect(entry).toBeTruthy();
      expect(entry!.error).toMatch(/Missing frontmatter/i);
      expect(report.scannedFiles).toBeGreaterThan(0);
    });

    it('reports unterminated fence', async () => {
      const { root, cleanup } = await makeTempProject();
      cleanups.push(cleanup);
      await initWithOneValid(root);
      await fs.writeFile(
        path.join(root, WS_DIR, 'artifacts', 'prd', 'no-close.md'),
        '---\ntitle: "Unterminated"\n',
      );

      const report = await rebuild(root);
      const entry = report.invalidFiles.find((f) => f.path.endsWith('no-close.md'));
      expect(entry).toBeTruthy();
      expect(entry!.error).toMatch(/Unterminated frontmatter/i);
    });

    it('reports malformed YAML frontmatter', async () => {
      const { root, cleanup } = await makeTempProject();
      cleanups.push(cleanup);
      await initWithOneValid(root);
      await fs.writeFile(
        path.join(root, WS_DIR, 'artifacts', 'prd', 'bad-yaml.md'),
        '---\n: invalid yaml\n---\n\nbody\n',
      );

      const report = await rebuild(root);
      const entry = report.invalidFiles.find((f) => f.path.endsWith('bad-yaml.md'));
      expect(entry).toBeTruthy();
      expect(entry!.error).toMatch(/Invalid YAML|VALIDATION_FAILED/i);
    });
  });

  describe('4.4 — temp file cleanup on write failure', () => {
    it('removes temp file when rename fails', async () => {
      const { root, cleanup } = await makeTempProject();
      cleanups.push(cleanup);
      const dir = path.join(root, 'sub');
      await fs.mkdir(dir, { recursive: true });
      const target = path.join(dir, 'out.md');
      // Make target a directory so rename(2) fails with EISDIR.
      await fs.mkdir(target);

      const err = await atomicWriteFile(target, 'content').catch((e: unknown) => e);
      expect(err).toBeInstanceOf(SpegoError);
      expect((err as SpegoError).code).toBe('WRITE_FAILED');

      const entries = await fs.readdir(dir);
      expect(entries.filter((e) => e.endsWith('.tmp'))).toEqual([]);
    });
  });
});
