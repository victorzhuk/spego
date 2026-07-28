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

describe('view / overview', () => {
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

  it('groups rows by type, sorted alphabetically', async () => {
    await engine.create({ type: 'prd', title: 'PRD One', body: 'line one\nline two' });
    await engine.create({ type: 'api', title: 'Auth API', body: 'a' });

    const view = await viewArtifacts(engine);
    expect(view.overview.format).toBe('overview');
    expect(view.overview.count).toBe(2);
    expect(view.overview.groups.map((g) => g.type)).toEqual(['api', 'prd']);
    const prdRow = view.overview.groups.find((g) => g.type === 'prd')!.rows[0]!;
    expect(prdRow.title).toBe('PRD One');
    expect(prdRow.lines).toBe(2);
  });

  it('reports 0 lines for an empty body', async () => {
    await engine.create({ type: 'prd', title: 'Empty', body: '' });
    const view = await viewArtifacts(engine);
    expect(view.overview.groups[0]!.rows[0]!.lines).toBe(0);
  });

  it('takes status verbatim from meta.status, and — when unset', async () => {
    await engine.create({ type: 'risk', title: 'Has status', body: '', meta: { status: 'mitigated' } });
    await engine.create({ type: 'risk', title: 'No status', body: '' });

    const view = await viewArtifacts(engine, { type: 'risk' });
    const rows = view.overview.groups[0]!.rows;
    expect(rows.find((r) => r.title === 'Has status')!.status).toBe('mitigated');
    expect(rows.find((r) => r.title === 'No status')!.status).toBe('—');
  });

  it('resolves epic status from statusBySlug, falling back to meta.status when the slug is absent', async () => {
    const withDelivery = await engine.create({ type: 'epic', title: 'Known', body: '' });
    await engine.create({ type: 'epic', title: 'Orphan', body: '', meta: { status: 'paused' } });

    const view = await viewArtifacts(
      engine,
      { type: 'epic' },
      { statusBySlug: new Map([[withDelivery.frontmatter.slug, 'in-progress']]) },
    );
    const rows = view.overview.groups[0]!.rows;
    expect(rows.find((r) => r.title === 'Known')!.status).toBe('in-progress');
    expect(rows.find((r) => r.title === 'Orphan')!.status).toBe('paused');
  });

  it('surfaces latestUpdated and the deleted flag under includeDeleted', async () => {
    const a = await engine.create({ type: 'risk', title: 'R1', body: '' });
    await engine.create({ type: 'risk', title: 'R2', body: '' });
    await engine.softDelete(a.frontmatter.id);

    const withoutDeleted = await viewArtifacts(engine, { type: 'risk' });
    expect(withoutDeleted.overview.count).toBe(1);
    expect(withoutDeleted.overview.latestUpdated).not.toBeNull();

    const withDeleted = await viewArtifacts(engine, { type: 'risk', includeDeleted: true });
    const r1 = withDeleted.overview.groups[0]!.rows.find((r) => r.title === 'R1')!;
    expect(r1.deleted).toBe(true);
    const r2 = withDeleted.overview.groups[0]!.rows.find((r) => r.title === 'R2')!;
    expect(r2.deleted).toBe(false);
  });

  it('returns an empty overview when nothing matches', async () => {
    const view = await viewArtifacts(engine, { type: 'prd' });
    expect(view.overview.count).toBe(0);
    expect(view.overview.groups).toEqual([]);
    expect(view.overview.latestUpdated).toBeNull();
  });
});
