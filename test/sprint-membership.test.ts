import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ArtifactEngine } from '../src/artifacts/engine.js';
import { initWorkspace } from '../src/workspace/init.js';
import { makeTempProject } from './helpers.js';

function expectCollision(promise: Promise<unknown>, change: string, owner: string): Promise<void> {
  return expect(promise).rejects.toMatchObject({
    code: 'VALIDATION_FAILED',
    message: expect.stringContaining(change),
    details: expect.objectContaining({
      change,
      owner: expect.objectContaining({
        slug: owner,
      }),
    }),
  });
}

describe('sprint-plan change membership', () => {
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

  it('rejects create when another non-closed sprint owns the change', async () => {
    await engine.create({
      type: 'sprint-plan',
      title: 'Sprint A',
      body: 'A',
      meta: { changes: ['add-auth'], status: 'active' },
    });

    await expectCollision(
      engine.create({
        type: 'sprint-plan',
        title: 'Sprint B',
        body: 'B',
        meta: { changes: ['add-auth'], status: 'planned' },
      }),
      'add-auth',
      'sprint-a',
    );
  });

  it('rejects create when one change overlaps among several', async () => {
    await engine.create({
      type: 'sprint-plan',
      title: 'Sprint A',
      body: 'A',
      meta: { changes: ['add-auth', 'add-users'], status: 'active' },
    });

    await expectCollision(
      engine.create({
        type: 'sprint-plan',
        title: 'Sprint B',
        body: 'B',
        meta: { changes: ['add-search', 'add-users'], status: 'planned' },
      }),
      'add-users',
      'sprint-a',
    );
  });

  it('checks update-appended changes against other sprint plans', async () => {
    const sprintA = await engine.create({
      type: 'sprint-plan',
      title: 'Sprint A',
      body: 'A',
      meta: { changes: ['add-auth'], status: 'active' },
    });

    await engine.update(sprintA.frontmatter.id, {
      meta: { changes: ['add-auth', 'add-sessions'], status: 'active' },
    });

    await expectCollision(
      engine.create({
        type: 'sprint-plan',
        title: 'Sprint B',
        body: 'B',
        meta: { changes: ['add-sessions'], status: 'planned' },
      }),
      'add-sessions',
      'sprint-a',
    );
  });

  it('allows updating a sprint after dropping the collision', async () => {
    await engine.create({
      type: 'sprint-plan',
      title: 'Sprint A',
      body: 'A',
      meta: { changes: ['add-auth'], status: 'active' },
    });
    const sprintB = await engine.create({
      type: 'sprint-plan',
      title: 'Sprint B',
      body: 'B',
      meta: { changes: ['add-billing'], status: 'planned' },
    });

    await expectCollision(
      engine.update(sprintB.frontmatter.id, {
        meta: { changes: ['add-auth'], status: 'planned' },
      }),
      'add-auth',
      'sprint-a',
    );

    const updated = await engine.update(sprintB.frontmatter.id, {
      meta: { changes: ['add-billing', 'add-search'], status: 'planned' },
    });
    expect(updated.frontmatter.meta).toMatchObject({
      changes: ['add-billing', 'add-search'],
    });
  });

  it('does not let closed sprints block new sprint plans', async () => {
    await engine.create({
      type: 'sprint-plan',
      title: 'Sprint A',
      body: 'A',
      meta: { changes: ['add-auth'], status: 'closed' },
    });

    const sprintB = await engine.create({
      type: 'sprint-plan',
      title: 'Sprint B',
      body: 'B',
      meta: { changes: ['add-auth'], status: 'active' },
    });
    expect(sprintB.frontmatter.meta).toMatchObject({ changes: ['add-auth'] });
  });

  it('does not block self-updates', async () => {
    const sprintA = await engine.create({
      type: 'sprint-plan',
      title: 'Sprint A',
      body: 'A',
      meta: { changes: ['x'], status: 'active' },
    });

    const updated = await engine.update(sprintA.frontmatter.id, {
      meta: { changes: ['x', 'y'], status: 'active' },
    });
    expect(updated.frontmatter.meta).toMatchObject({ changes: ['x', 'y'] });
  });

  it('rejects update when another sprint owns an appended change', async () => {
    const sprintA = await engine.create({
      type: 'sprint-plan',
      title: 'Sprint A',
      body: 'A',
      meta: { changes: ['x'], status: 'active' },
    });
    await engine.create({
      type: 'sprint-plan',
      title: 'Sprint B',
      body: 'B',
      meta: { changes: ['y'], status: 'planned' },
    });

    await expectCollision(
      engine.update(sprintA.frontmatter.id, {
        meta: { changes: ['x', 'y'], status: 'active' },
      }),
      'y',
      'sprint-b',
    );
  });

  it('skips non-sprint-plan artifacts', async () => {
    await engine.create({
      type: 'sprint-plan',
      title: 'Sprint A',
      body: 'A',
      meta: { changes: ['add-auth'], status: 'active' },
    });

    const epic = await engine.create({
      type: 'epic',
      title: 'Add Auth',
      body: 'x',
      meta: { deps: ['add-auth'] },
    });
    expect(epic.frontmatter.type).toBe('epic');
  });

  it('skips sprint-plan artifacts without changes', async () => {
    await engine.create({
      type: 'sprint-plan',
      title: 'Sprint A',
      body: 'A',
      meta: { status: 'active' },
    });

    const sprintB = await engine.create({
      type: 'sprint-plan',
      title: 'Sprint B',
      body: 'B',
      meta: { status: 'planned' },
    });
    expect(sprintB.frontmatter.meta).toMatchObject({ status: 'planned' });
  });

  it('treats missing status as non-closed', async () => {
    await engine.create({
      type: 'sprint-plan',
      title: 'Sprint A',
      body: 'A',
      meta: { changes: ['add-auth'] },
    });

    await expectCollision(
      engine.create({
        type: 'sprint-plan',
        title: 'Sprint B',
        body: 'B',
        meta: { changes: ['add-auth'], status: 'planned' },
      }),
      'add-auth',
      'sprint-a',
    );
  });
});
