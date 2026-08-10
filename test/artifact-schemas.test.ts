import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ArtifactEngine } from '../src/artifacts/engine.js';
import { ARTIFACT_META_DOCS, ARTIFACT_META_SCHEMAS, validateMetaForType } from '../src/artifacts/schemas.js';
import { BUILTIN_ARTIFACT_TYPES } from '../src/artifacts/types.js';
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
      type: 'epic',
      name: 'accepts track string',
      meta: { track: 'storage' },
      valid: true,
    },
    {
      type: 'epic',
      name: 'rejects empty-string track',
      meta: { track: '' },
      valid: false,
    },
    {
      type: 'epic',
      name: 'accepts track omitted',
      meta: { deps: ['core/change-a'] },
      valid: true,
    },
    {
      type: 'epic',
      name: 'accepts track composing with existing fields',
      meta: {
        track: 'storage',
        deps: ['core/change-a'],
        requires: ['docs/change-b'],
      },
      valid: true,
    },
    {
      type: 'epic',
      name: 'accepts tier from the size scale',
      meta: { tier: 'm' },
      valid: true,
    },
    {
      type: 'epic',
      name: 'rejects tier outside the size scale',
      meta: { tier: 'xxl' },
      valid: false,
    },
    {
      type: 'epic',
      name: 'rejects non-string tier',
      meta: { tier: 3 },
      valid: false,
    },
    {
      type: 'epic',
      name: 'accepts flow string',
      meta: { flow: 'opsx-apply' },
      valid: true,
    },
    {
      type: 'epic',
      name: 'rejects empty-string flow',
      meta: { flow: '' },
      valid: false,
    },
    {
      type: 'epic',
      name: 'accepts tier and flow omitted',
      meta: { deps: ['core/change-a'] },
      valid: true,
    },
    {
      type: 'epic',
      name: 'accepts actuals entry list',
      meta: { actuals: [{ flow: 'zapply', hours: 1.75 }, { flow: 'zapply', hours: 0.5 }] },
      valid: true,
    },
    {
      type: 'epic',
      name: 'rejects actuals entry missing flow',
      meta: { actuals: [{ hours: 1.75 }] },
      valid: false,
    },
    {
      type: 'epic',
      name: 'rejects actuals entry with empty-string flow',
      meta: { actuals: [{ flow: '', hours: 1.75 }] },
      valid: false,
    },
    {
      type: 'epic',
      name: 'rejects actuals entry with negative hours',
      meta: { actuals: [{ flow: 'zapply', hours: -1 }] },
      valid: false,
    },
    {
      type: 'epic',
      name: 'rejects actuals entry with non-finite hours',
      meta: { actuals: [{ flow: 'zapply', hours: Number.POSITIVE_INFINITY }] },
      valid: false,
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

describe('ARTIFACT_META_DOCS stays in sync with the real schemas', () => {
  it('documents every built-in type and no others', () => {
    expect(Object.keys(ARTIFACT_META_DOCS).sort()).toEqual([...BUILTIN_ARTIFACT_TYPES].sort());
    expect(Object.keys(ARTIFACT_META_DOCS).sort()).toEqual(Object.keys(ARTIFACT_META_SCHEMAS).sort());
  });

  it('mentions every field name declared in each type\'s zod schema', () => {
    for (const type of BUILTIN_ARTIFACT_TYPES) {
      let schema = ARTIFACT_META_SCHEMAS[type] as { shape?: Record<string, unknown>; innerType?: () => { shape: Record<string, unknown> } };
      if (!schema.shape && schema.innerType) schema = schema.innerType();
      for (const field of Object.keys(schema.shape ?? {})) {
        expect(ARTIFACT_META_DOCS[type], `${type}.${field}`).toContain(field);
      }
    }
  });
});
