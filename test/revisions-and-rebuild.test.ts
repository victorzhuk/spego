import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { ArtifactEngine } from '../src/artifacts/engine.js';
import { initWorkspace } from '../src/workspace/init.js';
import { makeTempProject } from './helpers.js';

describe('revisions and index rebuild', () => {
  let root: string;
  let cleanup: () => Promise<void>;
  let engine: ArtifactEngine;

  beforeEach(async () => {
    ({ root, cleanup } = await makeTempProject());
    await initWorkspace({ projectRoot: root, agents: ['claude'] });
    engine = await ArtifactEngine.open({ projectRoot: root });
  });

  afterEach(async () => {
    engine.close();
    await cleanup();
  });

  it('lists every saved revision in order', async () => {
    const created = await engine.create({ type: 'prd', title: 'PRD', body: 'v1' });
    await engine.update(created.frontmatter.id, { body: 'v2' });
    await engine.update(created.frontmatter.id, { body: 'v3' });

    const revisions = engine.listRevisions(created.frontmatter.id);
    expect(revisions.map((r) => r.revision)).toEqual([1, 2, 3]);
    for (const rev of revisions) {
      const file = await fs.readFile(rev.path, 'utf8');
      expect(file).toMatch(/^---/);
    }
  });

  it('reads any revision, not just the latest', async () => {
    const created = await engine.create({ type: 'prd', title: 'PRD', body: 'v1' });
    await engine.update(created.frontmatter.id, { body: 'v2' });
    await engine.update(created.frontmatter.id, { body: 'v3' });

    const rev2 = await engine.readRevision(created.frontmatter.id, 2);
    expect(rev2.body.trim()).toBe('v2');
    expect(rev2.frontmatter.revision).toBe(2);
  });

  it('rebuilds the index from markdown files only', async () => {
    const a = await engine.create({ type: 'okr', title: 'Q1 OKR', body: 'Focus' });
    await engine.update(a.frontmatter.id, { body: 'Focus v2' });
    await engine.create({ type: 'risk', title: 'Latency Risk', body: 'mitigate' });

    // Wipe the SQLite index to simulate drift.
    engine.close();
    const indexDb = path.join(root, '.spego', 'index', 'spego.db');
    await fs.rm(indexDb, { force: true });
    // Also remove WAL/SHM if present
    await fs.rm(`${indexDb}-wal`, { force: true });
    await fs.rm(`${indexDb}-shm`, { force: true });

    const fresh = await ArtifactEngine.open({ projectRoot: root });
    try {
      // Empty index → list returns nothing
      expect(fresh.list()).toEqual([]);

      const report = await fresh.rebuildIndex();
      expect(report.scannedFiles).toBe(2);
      expect(report.indexedArtifacts).toBe(2);
      expect(report.invalidFiles).toEqual([]);

      const rebuilt = fresh.list();
      const titles = rebuilt.map((r) => r.title).sort();
      expect(titles).toEqual(['Latency Risk', 'Q1 OKR']);

      // Revisions are reattached
      const okr = rebuilt.find((r) => r.title === 'Q1 OKR')!;
      expect(fresh.listRevisions(okr.id).map((r) => r.revision)).toEqual([1, 2]);
    } finally {
      fresh.close();
    }
  });

  it('reports invalid artifact files but keeps indexing', async () => {
    await engine.create({ type: 'prd', title: 'Good', body: 'ok' });

    // Drop a malformed markdown into the prd dir.
    const badPath = path.join(root, '.spego', 'artifacts', 'prd', 'broken.md');
    await fs.writeFile(badPath, '---\nnot: enough\n---\nbody\n');

    const report = await engine.rebuildIndex();
    expect(report.scannedFiles).toBe(2);
    expect(report.indexedArtifacts).toBe(1);
    expect(report.invalidFiles).toHaveLength(1);
    expect(report.invalidFiles[0]?.path).toBe(badPath);
  });

  it('stores snapshot path in revision rows, not canonical path', async () => {
    const created = await engine.create({ type: 'prd', title: 'PRD', body: 'v1' });
    await engine.update(created.frontmatter.id, { body: 'v2' });

    const revisions = engine.listRevisions(created.frontmatter.id);
    const rev1 = revisions.find((r) => r.revision === 1)!;
    const rev2 = revisions.find((r) => r.revision === 2)!;

    expect(rev1.path).toMatch(/\.spego\/revisions\/prd\/.*\.r1\.md$/);
    expect(rev2.path).toMatch(/\.spego\/revisions\/prd\/.*\.r2\.md$/);

    await expect(fs.stat(rev1.path)).resolves.toBeTruthy();
    await expect(fs.stat(rev2.path)).resolves.toBeTruthy();
  });

  it('rejects unsupported types during index rebuild', async () => {
    await engine.create({ type: 'prd', title: 'Valid', body: 'ok' });

    const rogueDir = path.join(root, '.spego', 'artifacts', 'roadmap');
    await fs.mkdir(rogueDir, { recursive: true });
    await fs.writeFile(
      path.join(rogueDir, 'bad.md'),
      '---\nid: "abc"\ntype: "roadmap"\ntitle: "R"\nslug: "r"\nrevision: 1\ncreatedAt: "2026-01-01T00:00:00Z"\nupdatedAt: "2026-01-01T00:00:00Z"\nmeta: {}\n---\n\nbody\n',
    );

    const report = await engine.rebuildIndex();
    expect(report.invalidFiles.some((f) => f.error.includes('INVALID_ARTIFACT_TYPE'))).toBe(true);
    expect(report.indexedArtifacts).toBe(1);
  });
});
