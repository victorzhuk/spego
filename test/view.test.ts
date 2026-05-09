import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { ArtifactEngine } from '../src/artifacts/engine.js';
import { initWorkspace } from '../src/workspace/init.js';
import { viewArtifacts } from '../src/export/view.js';
import { makeTempProject } from './helpers.js';

describe('view / export', () => {
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

  it('renders a markdown bundle grouped by type', async () => {
    await engine.create({ type: 'prd', title: 'PRD One', body: 'prd body' });
    await engine.create({ type: 'api', title: 'Auth API', body: 'api body' });

    const view = await viewArtifacts(engine);
    expect(view.markdown.format).toBe('markdown');
    expect(view.markdown.count).toBe(2);
    // Sections are ordered alphabetically by type
    expect(view.markdown.content.indexOf('# api')).toBeLessThan(
      view.markdown.content.indexOf('# prd'),
    );
    expect(view.markdown.content).toContain('## Auth API');
    expect(view.markdown.content).toContain('## PRD One');
    expect(view.markdown.content).toContain('api body');
    expect(view.markdown.content).toContain('prd body');
  });

  it('filters by type for JSON export', async () => {
    await engine.create({ type: 'prd', title: 'PRD', body: 'p' });
    await engine.create({ type: 'api', title: 'API One', body: 'a' });
    await engine.create({ type: 'api', title: 'API Two', body: 'b' });

    const view = await viewArtifacts(engine, { type: 'api' });
    expect(view.json.count).toBe(2);
    expect(view.json.artifacts.every((a) => a.type === 'api')).toBe(true);
    const titles = view.json.artifacts.map((a) => a.title).sort();
    expect(titles).toEqual(['API One', 'API Two']);
  });

  it('returns a specific revision and identifies the latest', async () => {
    const created = await engine.create({ type: 'prd', title: 'P', body: 'v1' });
    await engine.update(created.frontmatter.id, { body: 'v2' });
    await engine.update(created.frontmatter.id, { body: 'v3' });

    const view = await viewArtifacts(engine, { id: created.frontmatter.id, revision: 2 });
    expect(view.json.count).toBe(1);
    const a = view.json.artifacts[0]!;
    expect(a.revision).toBe(2);
    expect(a.latestRevision).toBe(3);
    expect(a.body.trim()).toBe('v2');
  });

  it('omits soft-deleted by default but can include them', async () => {
    const a = await engine.create({ type: 'risk', title: 'R1', body: '' });
    await engine.create({ type: 'risk', title: 'R2', body: '' });
    await engine.softDelete(a.frontmatter.id);

    const visible = await viewArtifacts(engine, { type: 'risk' });
    expect(visible.json.artifacts.map((x) => x.title)).toEqual(['R2']);

    const all = await viewArtifacts(engine, { type: 'risk', includeDeleted: true });
    const titles = all.json.artifacts.map((x) => x.title).sort();
    expect(titles).toEqual(['R1', 'R2']);
    const deleted = all.json.artifacts.find((x) => x.title === 'R1');
    expect(deleted?.deletedAt).toBeTruthy();
  });

  it('returns a friendly empty bundle when nothing matches', async () => {
    const view = await viewArtifacts(engine, { type: 'prd' });
    expect(view.json.count).toBe(0);
    expect(view.markdown.content).toContain('No artifacts found');
  });
});
