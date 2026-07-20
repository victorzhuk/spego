import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ArtifactEngine } from '../src/artifacts/engine.js';
import { ARTIFACT_META_SCHEMAS, validateMetaForType } from '../src/artifacts/schemas.js';
import { initWorkspace } from '../src/workspace/init.js';
import { makeTempProject } from './helpers.js';

describe('artifact metadata schemas', () => {
  const cases = [
    {
      type: 'epic',
      name: 'accepts empty meta',
      meta: {},
      valid: true,
    },
    {
      type: 'epic',
      name: 'accepts full meta',
      meta: {
        deps: ['core/change-a'],
        links: ['https://example.com/spec'],
        requires: ['infra/change-b', 'docs/change-c'],
        gaps: [{ flag: 'auth', note: 'OAuth unavailable in staging' }],
        tags: ['mirror', 'delivery'],
      },
      valid: true,
    },
    {
      type: 'epic',
      name: 'accepts gap with flag only',
      meta: {
        gaps: [{ flag: 'api' }],
      },
      valid: true,
    },
    {
      type: 'epic',
      name: 'rejects non-array deps',
      meta: {
        deps: 'core/change-a',
      },
      valid: false,
    },
    {
      type: 'epic',
      name: 'rejects non-string deps entries',
      meta: {
        deps: ['ok', 1],
      },
      valid: false,
    },
    {
      type: 'epic',
      name: 'rejects non-string links entries',
      meta: {
        links: [123],
      },
      valid: false,
    },
    {
      type: 'epic',
      name: 'rejects empty-string requires entry',
      meta: {
        requires: ['valid', ''],
      },
      valid: false,
    },
    {
      type: 'epic',
      name: 'rejects non-array requires',
      meta: {
        requires: 'core/change-a',
      },
      valid: false,
    },
    {
      type: 'epic',
      name: 'rejects gaps without flag',
      meta: {
        gaps: [{ note: 'missing flag' }],
      },
      valid: false,
    },
    {
      type: 'epic',
      name: 'rejects empty gap flag',
      meta: {
        gaps: [{ flag: '' }],
      },
      valid: false,
    },
    {
      type: 'epic',
      name: 'rejects non-array gaps',
      meta: {
        gaps: { flag: 'api' },
      },
      valid: false,
    },
    {
      type: 'epic',
      name: 'accepts dangling deps',
      meta: {
        deps: ['missing-change'],
      },
      valid: true,
    },
    {
      type: 'epic',
      name: 'accepts requires custom types',
      meta: {
        requires: ['custom:upstream', 'feature:billing'],
      },
      valid: true,
    },
    {
      type: 'sprint-plan',
      name: 'accepts ordered changes',
      meta: {
        changes: ['add-auth', 'add-sessions'],
        sprint: 's1',
      },
      valid: true,
    },
    {
      type: 'sprint-plan',
      name: 'accepts duplicate-free existing fields',
      meta: {
        sprint: 'sprint-1',
        startDate: '2026-01-01',
        endDate: '2026-01-14',
        status: 'active',
        tags: ['p1'],
      },
      valid: true,
    },
    {
      type: 'sprint-plan',
      name: 'accepts empty changes',
      meta: {
        changes: [],
      },
      valid: true,
    },
    {
      type: 'sprint-plan',
      name: 'accepts changes missing entirely',
      meta: {
        tags: ['planning'],
      },
      valid: true,
    },
    {
      type: 'sprint-plan',
      name: 'rejects non-array changes',
      meta: {
        changes: 'add-auth',
      },
      valid: false,
    },
    {
      type: 'sprint-plan',
      name: 'rejects non-string changes entries',
      meta: {
        changes: ['add-auth', 42],
      },
      valid: false,
    },
    {
      type: 'sprint-plan',
      name: 'rejects duplicate changes',
      meta: {
        changes: ['a', 'a', 'b'],
      },
      valid: false,
    },
  ];

  describe('schemas', () => {
    it.each(cases)('$name for $type', ({ type, meta, valid }) => {
      if (!valid) {
        expect(() => validateMetaForType(type, meta)).toThrow();
        return;
      }
      const parsed = validateMetaForType(type, meta);
      expect(parsed).toEqual(meta);
    });
  });

  it('keeps ordered sprint-plan changes as provided', () => {
    const meta = validateMetaForType('sprint-plan', {
      changes: ['add-auth', 'add-sessions', 'close-draft'],
    }) as { changes: string[] };
    expect(meta.changes).toEqual(['add-auth', 'add-sessions', 'close-draft']);
  });

  it('registers built-in schemas for known artifact types', () => {
    expect(ARTIFACT_META_SCHEMAS).toMatchObject({
      prd: expect.anything(),
      epic: expect.anything(),
      'sprint-plan': expect.anything(),
    });
  });
});

describe('artifact schema registration via engine', () => {
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

  it('creates an epic artifact', async () => {
    const record = await engine.create({
      type: 'epic',
      title: 'Auth Epic',
      body: 'mirror state',
    });

    expect(record.frontmatter.type).toBe('epic');
    expect(record.frontmatter.slug).toBe('auth-epic');
    expect(record.frontmatter.meta).toMatchObject({});
  });

  it('rejects invalid epic metadata in engine create', async () => {
    await expect(
      engine.create({
        type: 'epic',
        title: 'Invalid Epic',
        body: 'x',
        meta: { gaps: [{ note: 'missing flag' }] },
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });
});
