import { describe, expect, it } from 'vitest';
import {
  deriveMirror,
  filterMirrorArchived,
  filterMirrorGaps,
  type MirrorArtifact,
  type MirrorBoard,
  type MirrorInput,
  type MirrorWarning,
} from '../src/delivery/mirror.js';
import type { DeliveryStatus } from '../src/delivery/types.js';

function change(slug: string, status: DeliveryStatus = 'in-progress', archived = false) {
  return { slug, title: title(slug), status, archived };
}

function epic(slug: string, meta: Record<string, unknown> = {}, status?: DeliveryStatus): MirrorArtifact {
  return {
    id: `epic-${slug}`,
    type: 'epic',
    slug,
    title: title(slug),
    meta: status ? { ...meta, status } : meta,
  };
}

function sprint(
  slug: string,
  changes: string[],
  meta: Record<string, unknown> = {},
): MirrorArtifact {
  return {
    id: `sprint-${slug}`,
    type: 'sprint-plan',
    slug,
    title: title(slug),
    meta: { changes, status: 'planned', ...meta },
  };
}


function board(input: Partial<MirrorInput>) {
  return deriveMirror({
    changes: [],
    epics: [],
    sprints: [],
    linkedArtifacts: [],
    warnings: [],
    ...input,
  });
}

function title(slug: string): string {
  return slug.split('-').map((part) => part[0]!.toUpperCase() + part.slice(1)).join(' ');
}

function findChange(result: MirrorBoard, slug: string) {
  for (const sprintRow of result.sprints) {
    const match = sprintRow.changes.find((item) => item.slug === slug);
    if (match) return match;
  }
  return result.ungrouped.find((item) => item.slug === slug);
}

function warningCodes(warnings: MirrorWarning[]): string[] {
  return warnings.map((warning) => warning.code).sort();
}

describe('deriveMirror', () => {
  it('keeps strict sprint date ordering and leaves sprint change order verbatim', () => {
    const result = board({
      changes: ['b', 'a', 'iso', 'date-only', 'blank', 'garbage', 'missing-date'].map((slug) => change(slug)),
      epics: ['b', 'a', 'iso', 'date-only', 'blank', 'garbage', 'missing-date'].map((slug) => epic(slug)),
      sprints: [
        sprint('garbage', ['garbage'], { startDate: 'not-a-date' }),
        sprint('date-only', ['b', 'a'], { startDate: '2026-01-01' }),
        sprint('blank', ['blank'], { startDate: '   ' }),
        sprint('iso', ['iso'], { startDate: '2026-01-01T10:30:00Z' }),
        sprint('missing-date', ['missing-date'], {}),
      ],
    });

    expect(result.sprints.map((row) => row.slug)).toEqual([
      'date-only',
      'iso',
      'blank',
      'garbage',
      'missing-date',
    ]);
    expect(result.sprints[0]!.changes.map((item) => item.slug)).toEqual(['b', 'a']);
  });

  it('blocks only uncompleted dependencies scheduled later or unscheduled', () => {
    const deps = [
      change('earlier-pending'),
      change('earlier-done', 'completed'),
      change('same-pending'),
      change('same-done', 'completed'),
      change('later-pending'),
      change('later-done', 'completed'),
      change('unscheduled-pending'),
      change('unscheduled-done', 'completed'),
      change('target'),
    ];
    const result = board({
      changes: deps,
      epics: [
        epic('earlier-pending'),
        epic('earlier-done'),
        epic('same-pending'),
        epic('same-done'),
        epic('later-pending'),
        epic('later-done'),
        epic('unscheduled-pending'),
        epic('unscheduled-done'),
        epic('target', {
          deps: [
            'earlier-pending',
            'earlier-done',
            'same-pending',
            'same-done',
            'later-pending',
            'later-done',
            'unscheduled-pending',
            'unscheduled-done',
          ],
        }),
      ],
      sprints: [
        sprint('earlier', ['earlier-pending', 'earlier-done'], { startDate: '2026-01-01' }),
        sprint('current', ['same-pending', 'target', 'same-done'], { startDate: '2026-01-02' }),
        sprint('later', ['later-pending', 'later-done'], { startDate: '2026-01-03' }),
      ],
    });

    expect(findChange(result, 'target')?.blockers).toEqual([
      'later-pending',
      'unscheduled-pending',
    ]);
  });

  it('emits every mirror warning code with deterministic details', () => {
    const result = board({
      changes: [
        change('active-without-epic'),
        change('archived-change', 'completed', true),
        change('pending-in-active'),
        change('a'),
        change('b'),
        change('c'),
        change('done', 'completed'),
        change('has-dangling'),
      ],
      epics: [
        epic('a', { deps: ['b'] }),
        epic('b', { deps: ['c'] }),
        epic('c', { deps: ['a'] }),
        epic('done'),
        epic('has-dangling', { deps: ['missing-dep'] }),
        epic('missing-change'),
        epic('archived-change'),
        epic('pending-in-active'),
      ],
      sprints: [
        sprint('active', ['archived-change', 'pending-in-active'], { status: 'active', startDate: '2026-01-01' }),
        sprint('closable', ['done'], { status: 'active', startDate: '2026-01-02' }),
        sprint('closed-holding-archived', ['archived-change'], { status: 'closed', startDate: '2026-01-03' }),
      ],
    });

    expect(warningCodes(result.warnings)).toEqual([
      'closable-sprint',
      'dangling-dep',
      'dep-cycle',
      'dep-cycle',
      'dep-cycle',
      'orphan-epic',
      'orphan-epic',
      'ungroomed-change',
    ]);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'dangling-dep', details: { change: 'has-dangling', dep: 'missing-dep' } }),
        expect.objectContaining({ code: 'closable-sprint', details: { sprint: 'closable' } }),
        expect.objectContaining({ code: 'ungroomed-change', details: { change: 'active-without-epic' } }),
        expect.objectContaining({ code: 'orphan-epic', details: { change: 'archived-change', reason: 'archived' } }),
        expect.objectContaining({ code: 'orphan-epic', details: { change: 'missing-change', reason: 'missing' } }),
      ]),
    );

    // 'active' mixes a pending change with a satisfied one -> not complete; 'closable' is all-satisfied.
    expect(result.sprints.find((row) => row.slug === 'active')?.complete).toBe(false);
    expect(result.sprints.find((row) => row.slug === 'closable')?.complete).toBe(true);

    // An archived change in a live sprint is satisfied history, not drift.
    expect(result.warnings.some((w) => /includes archived change/.test(w.message))).toBe(false);
  });

  it('does not warn when an archived change sits in a live sprint', () => {
    const result = board({
      changes: [
        change('archived-planned', 'completed', true),
        change('archived-active', 'completed', true),
        change('archived-closed', 'completed', true),
      ],
      sprints: [
        sprint('planned-sprint', ['archived-planned'], { status: 'planned' }),
        sprint('active-sprint', ['archived-active'], { status: 'active' }),
        sprint('closed-sprint', ['archived-closed'], { status: 'closed' }),
      ],
    });
    expect(result.warnings.some((w) => /includes archived change/.test(w.message))).toBe(false);
  });

  it('marks an empty sprint as incomplete', () => {
    const result = board({
      sprints: [sprint('empty', [], { status: 'planned' })],
    });
    expect(result.sprints[0]!.complete).toBe(false);
  });

  it('marks only cycle members while dependents become blocked and long chains terminate', () => {
    const chain = Array.from({ length: 50 }, (_, i) => `chain-${i}`);
    const result = board({
      changes: [
        change('a'),
        change('b'),
        change('c'),
        change('self'),
        change('feeder'),
        ...chain.map((slug) => change(slug)),
      ],
      epics: [
        epic('a', { deps: ['b'] }),
        epic('b', { deps: ['c'] }),
        epic('c', { deps: ['a'] }),
        epic('self', { deps: ['self'] }),
        epic('feeder', { deps: ['a'] }),
        ...chain.map((slug, index) => epic(slug, index === 0 ? {} : { deps: [chain[index - 1]!] })),
      ],
      sprints: [sprint('active', ['a', 'b', 'c', 'self', 'feeder', ...chain], { status: 'active' })],
    });

    const cycleWarnings = result.warnings.filter((warning) => warning.code === 'dep-cycle');
    expect(cycleWarnings.map((warning) => warning.details?.change).sort()).toEqual([
      'a',
      'b',
      'c',
      'self',
    ]);
    expect(findChange(result, 'feeder')?.blockers).toEqual(['a']);
    expect(findChange(result, 'feeder')?.warnings).toEqual([]);
    expect(findChange(result, 'chain-49')?.blockers).toEqual([]);
  });

  it('derives missing artifact types from requires minus resolvable linked artifact ids', () => {
    const result = board({
      changes: [change('ok'), change('broken')],
      epics: [
        epic('ok', { requires: ['prd'], links: ['prd-id'] }),
        epic('broken', { requires: ['prd', 'api'], links: ['missing-id'] }),
      ],
      linkedArtifacts: [{ id: 'prd-id', type: 'prd', slug: 'prd-id', title: 'prd-id', meta: {} }],
    });

    expect(findChange(result, 'ok')?.missing).toEqual([]);
    expect(findChange(result, 'broken')?.missing).toEqual(['api', 'prd']);
  });

  it('chooses the first pending unblocked change from active sprint order', () => {
    const result = board({
      changes: [
        change('dep'),
        change('blocked'),
        change('done', 'completed'),
        change('next'),
        change('planned-next'),
      ],
      epics: [
        epic('dep'),
        epic('blocked', { deps: ['dep'] }),
        epic('done'),
        epic('next'),
        epic('planned-next'),
      ],
      sprints: [
        sprint('active', ['blocked', 'done', 'next'], { status: 'active', startDate: '2026-01-02' }),
        sprint('planned', ['planned-next'], { status: 'planned', startDate: '2026-01-01' }),
      ],
    });

    expect(result.next).toMatchObject({ change: 'next', sprint: 'active' });
  });

  it('falls back to planned sprints when no active sprint exists', () => {
    const result = board({
      changes: [change('late'), change('early')],
      epics: [epic('late'), epic('early')],
      sprints: [
        sprint('late-sprint', ['late'], { status: 'planned', startDate: '2026-02-01' }),
        sprint('early-sprint', ['early'], { status: 'planned', startDate: '2026-01-01' }),
      ],
    });

    expect(result.next).toMatchObject({ change: 'early', sprint: 'early-sprint' });
  });

  it('returns null next when no sprint contains an eligible pending unblocked change', () => {
    const result = board({
      changes: [change('dep'), change('blocked'), change('done', 'completed')],
      epics: [epic('dep'), epic('blocked', { deps: ['dep'] }), epic('done')],
      sprints: [sprint('active', ['blocked', 'done'], { status: 'active' })],
    });

    expect(result.next).toBeNull();
  });

  it('keeps an adapter-only view for active changes without artifacts', () => {
    const result = board({
      changes: [change('a'), change('b')],
    });

    expect(result.sprints).toEqual([]);
    expect(result.ungrouped.map((item) => item.slug)).toEqual(['a', 'b']);
    expect(result.ungrouped.every((item) => item.blockers.length === 0)).toBe(true);
    expect(result.next).toBeNull();
    expect(result.warnings).toEqual([
      expect.objectContaining({ code: 'ungroomed-change', details: { change: 'a' } }),
      expect.objectContaining({ code: 'ungroomed-change', details: { change: 'b' } }),
    ]);
  });
});

describe('no-task-plan warning', () => {
  it('flags an active change with no task list at all', () => {
    const result = board({
      changes: [{ ...change('unplanned'), hasTaskPlan: false, taskCount: 0 }],
      epics: [epic('unplanned')],
    });

    expect(result.warnings).toEqual([
      expect.objectContaining({
        code: 'no-task-plan',
        details: { change: 'unplanned', reason: 'missing' },
      }),
    ]);
  });

  it('flags an active change whose task list holds no items', () => {
    const result = board({
      changes: [{ ...change('empty-plan'), hasTaskPlan: true, taskCount: 0 }],
      epics: [epic('empty-plan')],
    });

    expect(result.warnings).toEqual([
      expect.objectContaining({
        code: 'no-task-plan',
        details: { change: 'empty-plan', reason: 'empty' },
      }),
    ]);
  });

  it('stays silent for a planned change, an archived one, and an adapter that cannot tell', () => {
    const result = board({
      changes: [
        { ...change('planned'), hasTaskPlan: true, taskCount: 3 },
        { ...change('archived-empty', 'completed', true), hasTaskPlan: false, taskCount: 0 },
        change('unknown-source'),
      ],
      epics: [epic('planned'), epic('unknown-source')],
    });

    expect(result.warnings.filter((item) => item.code === 'no-task-plan')).toEqual([]);
  });
});

describe('epic-meta status override', () => {
  it('applies a blocked override to a known change and reports it as an unsatisfied blocker', () => {
    const result = board({
      changes: [change('base'), change('dependent')],
      epics: [epic('base', {}, 'blocked'), epic('dependent', { deps: ['base'] })],
    });

    expect(findChange(result, 'base')?.status).toBe('blocked');
    expect(findChange(result, 'dependent')?.blockers).toEqual(['base']);
  });

  it('applies a paused override to a known change and reports it as an unsatisfied blocker', () => {
    const result = board({
      changes: [change('base'), change('dependent')],
      epics: [epic('base', {}, 'paused'), epic('dependent', { deps: ['base'] })],
    });

    expect(findChange(result, 'base')?.status).toBe('paused');
    expect(findChange(result, 'dependent')?.blockers).toEqual(['base']);
  });

  it('lets archived win over a blocked override', () => {
    const result = board({
      changes: [change('done-archived', 'completed', true)],
      epics: [epic('done-archived', {}, 'blocked')],
    });

    expect(findChange(result, 'done-archived')?.status).toBe('completed');
  });

  it('resolves an orphan epic with a non-override status like backlog via the broader statusFromMeta path', () => {
    const result = board({
      epics: [epic('idea', {}, 'backlog')],
    });

    expect(findChange(result, 'idea')?.status).toBe('backlog');
  });
});

describe('done status', () => {
  it('treats a done, non-archived change as satisfied: not a blocker, and group hits the completed sentinel', () => {
    const result = board({
      changes: [change('dep', 'done'), change('target')],
      epics: [epic('dep'), epic('target', { deps: ['dep'] })],
    });

    expect(findChange(result, 'target')?.blockers).toEqual([]);
    expect(findChange(result, 'dep')?.group).toBe('—');
  });
});

describe('out-of-order-dep warning', () => {
  it('flags a dependency scheduled in a later sprint', () => {
    const result = board({
      changes: [change('early'), change('late')],
      epics: [epic('early', { deps: ['late'] }), epic('late')],
      sprints: [
        sprint('first', ['early'], { startDate: '2026-01-01' }),
        sprint('second', ['late'], { startDate: '2026-02-01' }),
      ],
    });

    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'out-of-order-dep', details: { change: 'early', dep: 'late' } }),
      ]),
    );
  });

  it('does not flag a dependency scheduled in the same or an earlier sprint', () => {
    const result = board({
      changes: [change('early'), change('late')],
      epics: [epic('early', { deps: ['late'] }), epic('late')],
      sprints: [
        sprint('first', ['late'], { startDate: '2026-01-01' }),
        sprint('second', ['early'], { startDate: '2026-02-01' }),
      ],
    });

    expect(result.warnings.some((warning) => warning.code === 'out-of-order-dep')).toBe(false);
  });
});

describe('id (stable hash)', () => {
  it('keeps a change id unchanged when an unrelated change is inserted or removed', () => {
    const before = board({ changes: [change('m-change'), change('n-change')] });
    const after = board({ changes: [change('a-extra'), change('m-change'), change('n-change')] });

    const beforeIds = new Map(before.ungrouped.map((item) => [item.slug, item.id]));
    const afterIds = new Map(after.ungrouped.map((item) => [item.slug, item.id]));

    expect(afterIds.get('m-change')).toBe(beforeIds.get('m-change'));
    expect(afterIds.get('n-change')).toBe(beforeIds.get('n-change'));
  });

  it('assigns distinct hash-derived ids matching the c<hex> format', () => {
    const result = board({ changes: [change('a'), change('b')] });
    const a = findChange(result, 'a');
    const b = findChange(result, 'b');

    expect(a?.id).toMatch(/^c[0-9a-f]{4,}$/);
    expect(b?.id).toMatch(/^c[0-9a-f]{4,}$/);
    expect(a?.id).not.toBe(b?.id);
  });

  it('extends only the colliding slugs on a same-length hash collision', () => {
    // sha1('slug-12') and sha1('slug-698') share the hex prefix '8585' at 4 chars.
    const result = board({ changes: [change('slug-12'), change('slug-698'), change('unrelated')] });
    const collidingA = findChange(result, 'slug-12');
    const collidingB = findChange(result, 'slug-698');
    const untouched = findChange(result, 'unrelated');

    expect(collidingA?.id).not.toBe(collidingB?.id);
    expect(collidingA?.id).toMatch(/^c8585[0-9a-f]$/);
    expect(collidingB?.id).toMatch(/^c8585[0-9a-f]$/);
    expect(untouched?.id).toMatch(/^c[0-9a-f]{4}$/);
  });
});

describe('group (conflict track)', () => {
  it('groups two pending changes with the same track under that track string', () => {
    const result = board({
      changes: [change('a'), change('b')],
      epics: [epic('a', { track: 'storage' }), epic('b', { track: 'storage' })],
    });

    expect(findChange(result, 'a')?.group).toBe('storage');
    expect(findChange(result, 'b')?.group).toBe('storage');
  });

  it('groups pending changes with different tracks under their distinct track strings', () => {
    const result = board({
      changes: [change('a'), change('b')],
      epics: [epic('a', { track: 'storage' }), epic('b', { track: 'ui' })],
    });

    expect(findChange(result, 'a')?.group).toBe('storage');
    expect(findChange(result, 'b')?.group).toBe('ui');
  });

  it('marks a pending change with no track as ?', () => {
    const result = board({
      changes: [change('a')],
      epics: [epic('a')],
    });

    expect(findChange(result, 'a')?.group).toBe('?');
  });

  it('marks a pending change with a dangling dep and no track as ? (no ! marker)', () => {
    const result = board({
      changes: [change('has-dangling')],
      epics: [epic('has-dangling', { deps: ['missing-dep'] })],
    });

    expect(findChange(result, 'has-dangling')?.group).toBe('?');
  });

  it('marks a satisfied change as — regardless of track', () => {
    const result = board({
      changes: [change('done', 'completed')],
      epics: [epic('done', { track: 'storage' })],
    });

    expect(findChange(result, 'done')?.group).toBe('—');
  });
});

describe('execution order (intra-sprint topological sort)', () => {
  it('reorders a sprint so a dependency precedes its dependent (stored [b, a], b depends on a -> [a, b])', () => {
    const result = board({
      changes: [change('a'), change('b')],
      epics: [epic('a'), epic('b', { deps: ['a'] })],
      sprints: [sprint('active', ['b', 'a'], { status: 'active' })],
    });

    expect(result.sprints[0]!.changes.map((item) => item.slug)).toEqual(['a', 'b']);
  });

  it('exposes the sorted order to chooseNext (a is the first pending unblocked change)', () => {
    const result = board({
      changes: [change('a'), change('b')],
      epics: [epic('a'), epic('b', { deps: ['a'] })],
      sprints: [sprint('active', ['b', 'a'], { status: 'active' })],
    });

    expect(result.next).toMatchObject({ change: 'a', sprint: 'active' });
  });

  it('keeps stored order for an intra-sprint cycle and still fires dep-cycle warnings', () => {
    const result = board({
      changes: [change('x'), change('y')],
      epics: [epic('x', { deps: ['y'] }), epic('y', { deps: ['x'] })],
      sprints: [sprint('active', ['x', 'y'], { status: 'active' })],
    });

    expect(result.sprints[0]!.changes.map((item) => item.slug)).toEqual(['x', 'y']);
    expect(
      result.warnings.filter((w) => w.code === 'dep-cycle').map((w) => w.details?.change).sort(),
    ).toEqual(['x', 'y']);
  });

  it('leaves a no-dependency sprint in stored list order', () => {
    const result = board({
      changes: [change('a'), change('b')],
      epics: [epic('a'), epic('b')],
      sprints: [sprint('active', ['b', 'a'], { status: 'active' })],
    });

    expect(result.sprints[0]!.changes.map((item) => item.slug)).toEqual(['b', 'a']);
  });

  it('keeps ungrouped changes slug-sorted regardless of dependency order', () => {
    const result = board({
      changes: [change('b'), change('a')],
      epics: [epic('b', { deps: ['a'] }), epic('a')],
    });

    expect(result.ungrouped.map((item) => item.slug)).toEqual(['a', 'b']);
  });
});

describe('filterMirrorGaps', () => {
  it('keeps the same envelope and filters change arrays to gaps, missing, or blockers', () => {
    const result = board({
      changes: [change('clean'), change('gap'), change('missing'), change('blocked'), change('dep')],
      epics: [
        epic('clean'),
        epic('gap', { gaps: [{ flag: 'api' }] }),
        epic('missing', { requires: ['prd'] }),
        epic('blocked', { deps: ['dep'] }),
        epic('dep'),
      ],
      sprints: [sprint('active', ['clean', 'gap', 'missing', 'blocked'], { status: 'active' })],
    });

    const filtered = filterMirrorGaps(result);

    expect(Object.keys(filtered)).toEqual(['sprints', 'ungrouped', 'warnings', 'next']);
    expect(filtered.sprints[0]!.changes.map((item) => item.slug)).toEqual(['gap', 'missing', 'blocked']);
    expect(filtered.ungrouped).toEqual([]);
    expect(filtered.warnings).toBe(result.warnings);
  });
});

describe('MirrorChange.archived', () => {
  it('marks archived changes true and everything else false', () => {
    const result = board({
      changes: [change('active-one'), change('archived-one', 'completed', true)],
      epics: [epic('active-one'), epic('archived-one')],
    });

    expect(findChange(result, 'active-one')?.archived).toBe(false);
    expect(findChange(result, 'archived-one')?.archived).toBe(true);
  });
});

describe('filterMirrorArchived', () => {
  it('drops archived changes from ungrouped but leaves sprints and other fields untouched', () => {
    const result = board({
      changes: [change('active-one'), change('archived-one', 'completed', true)],
      epics: [epic('active-one'), epic('archived-one')],
      sprints: [sprint('active', ['archived-one'], { status: 'active', startDate: '2026-01-01' })],
    });

    const filtered = filterMirrorArchived(result);

    expect(Object.keys(filtered)).toEqual(['sprints', 'ungrouped', 'warnings', 'next']);
    expect(filtered.ungrouped.map((item) => item.slug)).toEqual(['active-one']);
    expect(filtered.sprints).toBe(result.sprints);
    expect(filtered.sprints[0]!.changes.map((item) => item.slug)).toEqual(['archived-one']);
    expect(filtered.warnings).toBe(result.warnings);
    expect(filtered.next).toBe(result.next);
  });

  it('keeps a non-archived ungrouped change', () => {
    const result = board({ changes: [change('plain-one')] });

    expect(filterMirrorArchived(result).ungrouped.map((item) => item.slug)).toEqual(['plain-one']);
  });
});

describe('deriveMirror pricing', () => {
  const flows = {
    default: 'zapply',
    profiles: {
      zapply: { xs: 0.5, s: 1, m: 2, l: 4, xl: 8 },
      'opsx-apply': { xs: 1, s: 2, m: 4, l: 8, xl: 16 },
    },
    human: { xs: 2, s: 6, m: 16, l: 40, xl: 80 },
    crossProject: false,
  };

  const pricingCases: Array<{
    name: string;
    meta: Record<string, unknown>;
    flowEstimate?: number;
    humanEstimate?: number;
  }> = [
    { name: 'prices a tier against the default flow', meta: { tier: 'm' }, flowEstimate: 2, humanEstimate: 16 },
    { name: 'prices xs against the default flow', meta: { tier: 'xs' }, flowEstimate: 0.5, humanEstimate: 2 },
    { name: 'prices a per-epic flow override against that profile', meta: { tier: 'm', flow: 'opsx-apply' }, flowEstimate: 4, humanEstimate: 16 },
    { name: 'leaves a change with an unknown flow unpriced', meta: { tier: 'm', flow: 'nope' } },
    { name: 'leaves a change without a tier unpriced', meta: { flow: 'zapply' } },
    { name: 'leaves a change with neither tier nor flow unpriced', meta: {} },
  ];

  for (const item of pricingCases) {
    it(item.name, () => {
      const result = board({
        changes: [change('target')],
        epics: [epic('target', item.meta)],
        flows,
      });
      const priced = findChange(result, 'target');
      expect(priced?.flowEstimate).toBe(item.flowEstimate);
      expect(priced?.humanEstimate).toBe(item.flowEstimate === undefined ? undefined : item.humanEstimate);
      expect(priced?.rung).toBe(item.flowEstimate === undefined ? undefined : 'config-seed');
    });
  }

  it('reports the rung on every priced change', () => {
    const result = board({
      changes: [change('a'), change('b')],
      epics: [epic('a', { tier: 's' }), epic('b', { tier: 'xl', flow: 'opsx-apply' })],
      flows,
    });
    expect(findChange(result, 'a')?.rung).toBe('config-seed');
    expect(findChange(result, 'b')?.rung).toBe('config-seed');
  });

  it('carries no estimates when the workspace declares no flows block', () => {
    const result = board({
      changes: [change('a')],
      epics: [epic('a', { tier: 'm' })],
      sprints: [sprint('s1', ['a'])],
    });
    const row = findChange(result, 'a');
    expect(row && 'flowEstimate' in row).toBe(false);
    expect(row && 'humanEstimate' in row).toBe(false);
    expect(row && 'rung' in row).toBe(false);
    expect('flowTotal' in result.sprints[0]!).toBe(false);
  });

  it('totals the flow estimates of pending changes only', () => {
    const result = board({
      changes: [change('a'), change('b'), change('c', 'done'), change('d', 'completed')],
      epics: [
        epic('a', { tier: 'm' }),
        epic('b', { tier: 's' }),
        epic('c', { tier: 'l' }),
        epic('d', { tier: 'xl' }),
      ],
      sprints: [sprint('s1', ['a', 'b', 'c', 'd'])],
      flows,
    });
    // pending: a (m → 2) + b (s → 1) = 3; done c (4) and completed d (8) excluded
    expect(result.sprints[0]!.flowTotal).toBe(3);
    expect(result.sprints[0]!.unpricedPending).toBe(0);
  });

  it('excludes unpriced pending changes from the total and counts them', () => {
    const result = board({
      changes: [change('a'), change('b'), change('c', 'done')],
      epics: [epic('a', { tier: 'm' }), epic('b'), epic('c')],
      sprints: [sprint('s1', ['a', 'b', 'c'])],
      flows,
    });
    // pending priced: a (2); pending unpriced: b; done unpriced c is not pending
    expect(result.sprints[0]!.flowTotal).toBe(2);
    expect(result.sprints[0]!.unpricedPending).toBe(1);
  });

  it('totals zero for an empty sprint', () => {
    const result = board({
      changes: [],
      epics: [],
      sprints: [sprint('s1', [])],
      flows,
    });
    expect(result.sprints[0]!.flowTotal).toBe(0);
    expect(result.sprints[0]!.unpricedPending).toBe(0);
  });

  it('totals zero when every change is satisfied', () => {
    const result = board({
      changes: [change('a', 'done'), change('b', 'completed')],
      epics: [epic('a', { tier: 'm' }), epic('b', { tier: 'l' })],
      sprints: [sprint('s1', ['a', 'b'])],
      flows,
    });
    expect(result.sprints[0]!.flowTotal).toBe(0);
    expect(result.sprints[0]!.unpricedPending).toBe(0);
  });

  it('sums unrounded values into the sprint total', () => {
    const result = board({
      changes: [change('a'), change('b'), change('c')],
      epics: [epic('a', { tier: 'xs' }), epic('b', { tier: 'xs' }), epic('c', { tier: 'xs' })],
      sprints: [sprint('s1', ['a', 'b', 'c'])],
      flows,
    });
    // 0.5 + 0.5 + 0.5 = 1.5, no per-row rounding before summing
    expect(result.sprints[0]!.flowTotal).toBe(1.5);
  });

  it('prices ungrouped changes the same way', () => {
    const result = board({
      changes: [change('loose')],
      epics: [epic('loose', { tier: 'l' })],
      flows,
    });
    expect(result.ungrouped[0]?.flowEstimate).toBe(4);
    expect(result.ungrouped[0]?.humanEstimate).toBe(40);
    expect(result.ungrouped[0]?.rung).toBe('config-seed');
  });
});

describe('deriveMirror actuals', () => {
  it('carries recorded runs and their total on the derived change', () => {
    const result = board({
      changes: [change('a')],
      epics: [epic('a', { actuals: [{ flow: 'zapply', hours: 1.75 }, { flow: 'zapply', hours: 0.5 }] })],
    });
    const row = findChange(result, 'a');
    expect(row?.actuals).toEqual([
      { flow: 'zapply', hours: 1.75 },
      { flow: 'zapply', hours: 0.5 },
    ]);
    expect(row?.actualsTotal).toBe(2.25);
  });

  it('reports none for a change with no actuals', () => {
    const result = board({
      changes: [change('a'), change('b')],
      epics: [epic('a', { actuals: [{ flow: 'zapply', hours: 2 }] }), epic('b')],
    });
    expect(findChange(result, 'b')?.actuals).toEqual([]);
    expect(findChange(result, 'b')?.actualsTotal).toBe(0);
  });

  it('keeps flow attribution across runs from two flows', () => {
    const result = board({
      changes: [change('a')],
      epics: [epic('a', { actuals: [{ flow: 'zapply', hours: 1 }, { flow: 'opsx-apply', hours: 2 }] })],
    });
    const row = findChange(result, 'a');
    expect(row?.actuals).toEqual([
      { flow: 'zapply', hours: 1 },
      { flow: 'opsx-apply', hours: 2 },
    ]);
    expect(row?.actualsTotal).toBe(3);
  });

  it('drops malformed stored entries instead of failing the render', () => {
    const result = board({
      changes: [change('a')],
      epics: [epic('a', { actuals: [{ flow: '', hours: 1 }, { flow: 'zapply', hours: -2 }, { flow: 'zapply', hours: 1 }, 'junk'] })],
    });
    const row = findChange(result, 'a');
    expect(row?.actuals).toEqual([{ flow: 'zapply', hours: 1 }]);
    expect(row?.actualsTotal).toBe(1);
  });
});

describe('deriveMirror profile ladder', () => {
  const flows = {
    default: 'zapply',
    profiles: {
      zapply: { xs: 0.5, s: 1, m: 2, l: 4, xl: 8 },
      'opsx-apply': { xs: 1, s: 2, m: 4, l: 8, xl: 16 },
    },
    human: { xs: 2, s: 6, m: 16, l: 40, xl: 80 },
    crossProject: false,
  };

  function runEpic(slug: string, tier: string, flow: string, runs: number[]): MirrorArtifact {
    return epic(slug, { tier, actuals: runs.map((hours) => ({ flow, hours })) });
  }

  it('resolves the seed rung when runs are below the threshold', () => {
    const result = board({
      changes: [change('a'), change('h1'), change('h2')],
      epics: [
        epic('a', { tier: 'm' }),
        runEpic('h1', 'm', 'zapply', [3]),
        runEpic('h2', 'm', 'zapply', [5]),
      ],
      flows,
    });
    const row = findChange(result, 'a');
    // runs 3+5 below the observation threshold of 3 → seed rung; the pair's
    // bias (2) still corrects the seeded 2 to 4
    expect(row?.flowEstimate).toBe(4);
    expect(row?.rung).toBe('config-seed');
    expect(row?.bias).toBe(2);
  });

  it('prices from observation at exactly the threshold', () => {
    const result = board({
      changes: [change('a'), change('h1'), change('h2'), change('h3')],
      epics: [
        epic('a', { tier: 'm' }),
        runEpic('h1', 'm', 'zapply', [3]),
        runEpic('h2', 'm', 'zapply', [5]),
        runEpic('h3', 'm', 'zapply', [4]),
      ],
      flows,
    });
    const row = findChange(result, 'a');
    // median of [3, 5, 4] = 4
    expect(row?.flowEstimate).toBe(4);
    expect(row?.rung).toBe('observed');
  });

  it('takes the midpoint of the middle pair for an even run count', () => {
    const result = board({
      changes: [change('a'), change('h1'), change('h2'), change('h3'), change('h4')],
      epics: [
        epic('a', { tier: 'm' }),
        runEpic('h1', 'm', 'zapply', [3, 7]),
        runEpic('h2', 'm', 'zapply', [5]),
        runEpic('h3', 'm', 'zapply', [4]),
        runEpic('h4', 'm', 'zapply', []),
      ],
      flows,
    });
    const row = findChange(result, 'a');
    // runs [3, 7, 5, 4] sorted [3, 4, 5, 7] → midpoint (4+5)/2 = 4.5
    expect(row?.flowEstimate).toBe(4.5);
    expect(row?.rung).toBe('observed');
  });

  it('does not count runs recorded under another flow', () => {
    const result = board({
      changes: [change('a'), change('h1'), change('h2'), change('h3')],
      epics: [
        epic('a', { tier: 'm' }),
        runEpic('h1', 'm', 'opsx-apply', [10]),
        runEpic('h2', 'm', 'opsx-apply', [10]),
        runEpic('h3', 'm', 'opsx-apply', [10]),
      ],
      flows,
    });
    const row = findChange(result, 'a');
    // runs all under opsx-apply; zapply m stays on its seed of 2
    expect(row?.flowEstimate).toBe(2);
    expect(row?.rung).toBe('config-seed');
    // and opsx-apply prices m from its own observation
    const other = board({
      changes: [change('b'), change('h1'), change('h2'), change('h3')],
      epics: [
        epic('b', { tier: 'm', flow: 'opsx-apply' }),
        runEpic('h1', 'm', 'opsx-apply', [10]),
        runEpic('h2', 'm', 'opsx-apply', [10]),
        runEpic('h3', 'm', 'opsx-apply', [10]),
      ],
      flows,
    });
    expect(findChange(other, 'b')?.flowEstimate).toBe(10);
    expect(findChange(other, 'b')?.rung).toBe('observed');
  });

  it('resolves tiers independently on the same board', () => {
    const result = board({
      changes: [change('a'), change('b'), change('h1'), change('h2'), change('h3')],
      epics: [
        epic('a', { tier: 's' }),
        epic('b', { tier: 'l' }),
        runEpic('h1', 's', 'zapply', [2]),
        runEpic('h2', 's', 'zapply', [4]),
        runEpic('h3', 's', 'zapply', [6]),
      ],
      flows,
    });
    // s observed at median 4; l has no runs and falls back to the seed 4 — same value, different rung
    const aRow = findChange(result, 'a');
    expect(aRow?.flowEstimate).toBe(4);
    expect(aRow?.rung).toBe('observed');
    const bRow = findChange(result, 'b');
    expect(bRow?.flowEstimate).toBe(4);
    expect(bRow?.rung).toBe('config-seed');
  });

  it('reports a flow with no seed and no runs as unpriced', () => {
    const result = board({
      changes: [change('a')],
      epics: [epic('a', { tier: 'm', flow: 'nope' })],
      flows,
    });
    const row = findChange(result, 'a');
    expect(row && 'flowEstimate' in row).toBe(false);
    expect(row && 'rung' in row).toBe(false);
  });

  it('prices a flow with no seed from observation once the threshold is met', () => {
    const result = board({
      changes: [change('a'), change('h1'), change('h2'), change('h3')],
      epics: [
        epic('a', { tier: 'm', flow: 'nope' }),
        runEpic('h1', 'm', 'nope', [2]),
        runEpic('h2', 'm', 'nope', [8]),
        runEpic('h3', 'm', 'nope', [5]),
      ],
      flows,
    });
    const row = findChange(result, 'a');
    // median of [2, 8, 5] = 5
    expect(row?.flowEstimate).toBe(5);
    expect(row?.rung).toBe('observed');
  });

  it('keeps the human estimate on the shared table regardless of rung', () => {
    const result = board({
      changes: [change('a'), change('h1'), change('h2'), change('h3')],
      epics: [
        epic('a', { tier: 'm' }),
        runEpic('h1', 'm', 'zapply', [3]),
        runEpic('h2', 'm', 'zapply', [5]),
        runEpic('h3', 'm', 'zapply', [4]),
      ],
      flows,
    });
    expect(findChange(result, 'a')?.humanEstimate).toBe(16);
  });
});

describe('deriveMirror estimate bias', () => {
  const flows = {
    default: 'zapply',
    profiles: {
      zapply: { xs: 0.5, s: 1, m: 2, l: 4, xl: 8 },
      'opsx-apply': { xs: 1, s: 2, m: 4, l: 8, xl: 16 },
    },
    human: { xs: 2, s: 6, m: 16, l: 40, xl: 80 },
    crossProject: false,
  };

  function runEpic(slug: string, tier: string, flow: string, runs: number[]): MirrorArtifact {
    return epic(slug, { tier, actuals: runs.map((hours) => ({ flow, hours })) });
  }

  it('derives bias as the median ratio of runs over their pair price', () => {
    const result = board({
      changes: [change('a'), change('h1'), change('h2')],
      epics: [
        epic('a', { tier: 'm' }),
        runEpic('h1', 'm', 'zapply', [3]),
        runEpic('h2', 'm', 'zapply', [5]),
      ],
      flows,
    });
    // 2 runs below the observation threshold → seed 2; ratios 3/2 and 5/2 → bias median 2
    const row = findChange(result, 'a');
    expect(row?.bias).toBe(2);
  });

  it('derives bias below parity when runs come in under their price', () => {
    const result = board({
      changes: [change('a'), change('h1')],
      epics: [epic('a', { tier: 'l' }), runEpic('h1', 'l', 'zapply', [2])],
      flows,
    });
    // 1 run, seed l=4 → ratio 2/4 = 0.5
    expect(findChange(result, 'a')?.bias).toBe(0.5);
  });

  it('corrects a seeded price by the pair bias and keeps the rung', () => {
    const result = board({
      changes: [change('a'), change('h1'), change('h2')],
      epics: [
        epic('a', { tier: 'm' }),
        runEpic('h1', 'm', 'zapply', [3]),
        runEpic('h2', 'm', 'zapply', [5]),
      ],
      flows,
    });
    const row = findChange(result, 'a');
    // bias 2, inside the clamp → corrected 2 × 2 = 4, still seed rung
    expect(row?.flowEstimate).toBe(4);
    expect(row?.rung).toBe('config-seed');
  });

  it('does not correct an observed price but still reports the bias', () => {
    const result = board({
      changes: [change('a'), change('h1'), change('h2'), change('h3')],
      epics: [
        epic('a', { tier: 'm' }),
        runEpic('h1', 'm', 'zapply', [3]),
        runEpic('h2', 'm', 'zapply', [5]),
        runEpic('h3', 'm', 'zapply', [4]),
      ],
      flows,
    });
    const row = findChange(result, 'a');
    // observed median 4; ratios 0.75, 1.25, 1 → bias median 1; price uncorrected
    expect(row?.flowEstimate).toBe(4);
    expect(row?.rung).toBe('observed');
    expect(row?.bias).toBe(1);
  });

  it('clamps the applied correction at the bound but reports the unclamped bias', () => {
    const result = board({
      changes: [change('a'), change('h1')],
      epics: [epic('a', { tier: 'm' }), runEpic('h1', 'm', 'zapply', [9])],
      flows,
    });
    const row = findChange(result, 'a');
    // 1 run, seed 2 → bias 4.5; applied correction clamps to ×2 → 4
    expect(row?.bias).toBe(4.5);
    expect(row?.flowEstimate).toBe(4);
    expect(row?.rung).toBe('config-seed');
  });

  it('clamps a downward correction at the lower bound', () => {
    const result = board({
      changes: [change('a'), change('h1')],
      epics: [epic('a', { tier: 'l' }), runEpic('h1', 'l', 'zapply', [1])],
      flows,
    });
    const row = findChange(result, 'a');
    // 1 run, seed 4 → bias 0.25; applied correction clamps to ×0.5 → 2
    expect(row?.bias).toBe(0.25);
    expect(row?.flowEstimate).toBe(2);
  });

  it('reports no bias and no correction for a pair with no runs', () => {
    const result = board({
      changes: [change('a')],
      epics: [epic('a', { tier: 'm' })],
      flows,
    });
    const row = findChange(result, 'a');
    expect(row && 'bias' in row).toBe(false);
    expect(row?.flowEstimate).toBe(2);
  });

  it('raises no warning when bias sits inside the band', () => {
    const result = board({
      changes: [change('a'), change('h1')],
      epics: [epic('a', { tier: 'm' }), runEpic('h1', 'm', 'zapply', [3])],
      flows,
    });
    // bias 1.5 is the top of the band
    expect(findChange(result, 'a')?.bias).toBe(1.5);
    expect(result.warnings.filter((w) => w.code === 'stale-profile')).toEqual([]);
  });

  it('warns outside the band, naming flow, tier, and direction', () => {
    const result = board({
      changes: [change('a'), change('h1'), change('h2')],
      epics: [
        epic('a', { tier: 'm' }),
        runEpic('h1', 'm', 'zapply', [5]),
        runEpic('h2', 'l', 'zapply', [1]),
      ],
      flows,
    });
    const stale = result.warnings.filter((w) => w.code === 'stale-profile');
    // zapply/m bias 2.5 (over), zapply/l bias 0.25 (under) — one entry per pair
    expect(stale.length).toBe(2);
    const byTier = new Map(stale.map((w) => [w.details?.tier, w]));
    expect(byTier.get('m')?.details).toMatchObject({ flow: 'zapply', direction: 'over' });
    expect(byTier.get('l')?.details).toMatchObject({ flow: 'zapply', direction: 'under' });
    expect(byTier.get('m')?.message).toContain('zapply');
    expect(byTier.get('m')?.message).toContain('m');
  });
});

describe('deriveMirror cross-project rung', () => {
  const baseFlows = {
    default: 'zapply',
    profiles: {
      zapply: { xs: 0.5, s: 1, m: 2, l: 4, xl: 8 },
      'opsx-apply': { xs: 1, s: 2, m: 4, l: 8, xl: 16 },
    },
    human: { xs: 2, s: 6, m: 16, l: 40, xl: 80 },
    crossProject: true,
  };

  function runEpic(slug: string, tier: string, flow: string, runs: number[]): MirrorArtifact {
    return epic(slug, { tier, actuals: runs.map((hours) => ({ flow, hours })) });
  }

  function storeRuns(flow: string, tier: string, runs: number[]) {
    return runs.map((hours) => ({ flow, tier, hours }));
  }

  const ladderCases: Array<{
    name: string;
    localRuns: number[];
    store: Array<{ flow: string; tier: string; hours: number }>;
    crossProject: boolean;
    flowEstimate: number;
    rung: string;
  }> = [
    {
      name: 'cross-project observations outrank the seed',
      localRuns: [],
      store: storeRuns('zapply', 'm', [6, 8, 10]),
      crossProject: true,
      flowEstimate: 8,
      rung: 'cross-project',
    },
    {
      name: 'repo observations outrank cross-project ones',
      localRuns: [3, 5, 4],
      store: storeRuns('zapply', 'm', [10, 12, 14]),
      crossProject: true,
      flowEstimate: 4,
      rung: 'observed',
    },
    {
      name: 'a store below the sample threshold falls back to the seed',
      localRuns: [],
      store: storeRuns('zapply', 'm', [6, 8]),
      crossProject: true,
      flowEstimate: 2,
      rung: 'config-seed',
    },
    {
      name: 'an empty store keeps the seed',
      localRuns: [],
      store: [],
      crossProject: true,
      flowEstimate: 2,
      rung: 'config-seed',
    },
    {
      name: 'a workspace without the opt-in never reaches the middle rung',
      localRuns: [],
      store: storeRuns('zapply', 'm', [6, 8, 10]),
      crossProject: false,
      flowEstimate: 2,
      rung: 'config-seed',
    },
    {
      name: 'store runs under another flow do not count',
      localRuns: [],
      store: storeRuns('opsx-apply', 'm', [6, 8, 10]),
      crossProject: true,
      flowEstimate: 2,
      rung: 'config-seed',
    },
    {
      name: 'store runs at another tier do not count',
      localRuns: [],
      store: storeRuns('zapply', 'l', [6, 8, 10]),
      crossProject: true,
      flowEstimate: 2,
      rung: 'config-seed',
    },
  ];

  for (const item of ladderCases) {
    it(item.name, () => {
      const changes = [change('a')];
      const epics = [epic('a', { tier: 'm' })];
      item.localRuns.forEach((hours, index) => {
        changes.push(change(`h${index}`));
        epics.push(runEpic(`h${index}`, 'm', 'zapply', [hours]));
      });
      const result = board({
        changes,
        epics,
        flows: { ...baseFlows, crossProject: item.crossProject },
        storeRuns: item.store,
      });
      const row = findChange(result, 'a');
      expect(row?.flowEstimate).toBe(item.flowEstimate);
      expect(row?.rung).toBe(item.rung);
    });
  }

  it('distinguishes all three rungs on one board and keeps the shared human table', () => {
    const result = board({
      changes: [change('a'), change('b'), change('c'), change('h1'), change('h2'), change('h3')],
      epics: [
        epic('a', { tier: 'm' }),
        epic('b', { tier: 's' }),
        epic('c', { tier: 'l' }),
        runEpic('h1', 'm', 'zapply', [3]),
        runEpic('h2', 'm', 'zapply', [5]),
        runEpic('h3', 'm', 'zapply', [4]),
      ],
      flows: baseFlows,
      storeRuns: storeRuns('zapply', 's', [6, 8, 10]),
    });
    // a: local median of [3, 5, 4]; b: store median of [6, 8, 10]; c: seed l = 4
    expect(findChange(result, 'a')?.rung).toBe('observed');
    expect(findChange(result, 'b')?.rung).toBe('cross-project');
    expect(findChange(result, 'b')?.flowEstimate).toBe(8);
    expect(findChange(result, 'b')?.humanEstimate).toBe(6);
    expect(findChange(result, 'c')?.rung).toBe('config-seed');
    expect(findChange(result, 'c')?.flowEstimate).toBe(4);
  });
});
