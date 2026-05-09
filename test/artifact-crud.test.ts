import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import fs from 'node:fs/promises';
import { ArtifactEngine } from '../src/artifacts/engine.js';
import { initWorkspace } from '../src/workspace/init.js';
import { SpegoError } from '../src/errors.js';
import { makeTempProject } from './helpers.js';

describe('artifact CRUD', () => {
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

  it('creates a PRD with frontmatter and rendered markdown', async () => {
    const created = await engine.create({
      type: 'prd',
      title: 'Pricing Page Redesign',
      body: '## Goals\n- Lift conversion.\n',
    });

    expect(created.frontmatter.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(created.frontmatter.type).toBe('prd');
    expect(created.frontmatter.slug).toBe('pricing-page-redesign');
    expect(created.frontmatter.revision).toBe(1);
    expect(created.path).toMatch(/\.spego\/artifacts\/prd\/pricing-page-redesign\.md$/);

    const onDisk = await fs.readFile(created.path, 'utf8');
    expect(onDisk).toMatch(/^---\n/);
    expect(onDisk).toMatch(/title: ["']?Pricing Page Redesign["']?/);
    expect(onDisk).toContain('## Goals');
  });

  it('rejects unsupported artifact types', async () => {
    await expect(
      engine.create({ type: 'roadmap', title: 'X', body: '' }),
    ).rejects.toMatchObject({ code: 'INVALID_ARTIFACT_TYPE' });
  });

  it('rejects missing title', async () => {
    await expect(
      engine.create({ type: 'prd', body: 'no title' } as unknown),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('reads by id and by type+slug', async () => {
    const created = await engine.create({ type: 'api', title: 'Auth API', body: 'spec' });

    const byId = await engine.readById(created.frontmatter.id);
    expect(byId.frontmatter.title).toBe('Auth API');
    expect(byId.body.trim()).toBe('spec');

    const byPair = await engine.readByTypeSlug('api', 'auth-api');
    expect(byPair.frontmatter.id).toBe(created.frontmatter.id);
  });

  it('rejects artifact types with path separators', async () => {
    await expect(
      engine.create({ type: '../etc', title: 'Evil', body: '' }),
    ).rejects.toMatchObject({ code: 'INVALID_ARTIFACT_TYPE' });
  });

  it('returns ARTIFACT_NOT_FOUND for unknown id', async () => {
    await expect(engine.readById('00000000-0000-0000-0000-000000000000')).rejects.toBeInstanceOf(
      SpegoError,
    );
  });

  it('updates and bumps the revision; preserves history', async () => {
    const created = await engine.create({
      type: 'prd',
      title: 'P1',
      body: 'first',
    });
    const v2 = await engine.update(created.frontmatter.id, { body: 'second' });
    expect(v2.frontmatter.revision).toBe(2);
    expect(v2.body.trim()).toBe('second');

    const rev1 = await engine.readRevision(created.frontmatter.id, 1);
    expect(rev1.body.trim()).toBe('first');
    expect(rev1.frontmatter.revision).toBe(1);
  });

  it('rejects stale revision update', async () => {
    const created = await engine.create({ type: 'prd', title: 'P', body: 'x' });
    await engine.update(created.frontmatter.id, { body: 'y' }); // → rev 2

    await expect(
      engine.update(created.frontmatter.id, { body: 'z', expectedRevision: 1 }),
    ).rejects.toMatchObject({ code: 'REVISION_CONFLICT' });
  });

  it('soft-deletes and excludes from default listing', async () => {
    const a = await engine.create({ type: 'risk', title: 'Risk A', body: '' });
    const b = await engine.create({ type: 'risk', title: 'Risk B', body: '' });
    await engine.softDelete(a.frontmatter.id);

    const visible = engine.list({ type: 'risk' });
    expect(visible.map((r) => r.id)).toEqual([b.frontmatter.id]);

    const all = engine.list({ type: 'risk', includeDeleted: true });
    expect(all.map((r) => r.id).sort()).toEqual(
      [a.frontmatter.id, b.frontmatter.id].sort(),
    );

    // History remains accessible
    const rev1 = await engine.readRevision(a.frontmatter.id, 1);
    expect(rev1.frontmatter.deletedAt ?? null).toBe(null);
  });

  it('disambiguates duplicate slugs', async () => {
    const a = await engine.create({ type: 'design', title: 'Onboarding Flow', body: '' });
    const b = await engine.create({ type: 'design', title: 'Onboarding Flow', body: '' });
    expect(a.frontmatter.slug).toBe('onboarding-flow');
    expect(b.frontmatter.slug).toBe('onboarding-flow-2');
  });

  it('reads artifact by file path', async () => {
    const created = await engine.create({ type: 'api', title: 'REST API', body: 'openapi spec' });

    const byPath = await engine.readByPath(created.path);
    expect(byPath.frontmatter.id).toBe(created.frontmatter.id);
    expect(byPath.body.trim()).toBe('openapi spec');
  });

  it('validates meta against per-type schema on create', async () => {
    const created = await engine.create({
      type: 'risk',
      title: 'Data Loss',
      body: 'risk body',
      meta: { severity: 'high', likelihood: 'medium', status: 'open' },
    });
    expect(created.frontmatter.meta).toMatchObject({ severity: 'high' });

    await expect(
      engine.create({
        type: 'risk',
        title: 'Bad Risk',
        body: '',
        meta: { severity: 'impossible' as unknown as string },
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });
});
