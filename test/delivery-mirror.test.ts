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
      ],
    });

    expect(warningCodes(result.warnings)).toEqual([
      'archived-in-sprint',
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
        expect.objectContaining({ code: 'archived-in-sprint', details: { sprint: 'active', change: 'archived-change' } }),
        expect.objectContaining({ code: 'closable-sprint', details: { sprint: 'closable' } }),
        expect.objectContaining({ code: 'ungroomed-change', details: { change: 'active-without-epic' } }),
        expect.objectContaining({ code: 'orphan-epic', details: { change: 'archived-change', reason: 'archived' } }),
        expect.objectContaining({ code: 'orphan-epic', details: { change: 'missing-change', reason: 'missing' } }),
      ]),
    );
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

describe('group (parallel wave)', () => {
  it('assigns the same group to two independent changes', () => {
    const result = board({
      changes: [change('a'), change('b')],
      epics: [epic('a'), epic('b')],
    });

    const a = findChange(result, 'a');
    const b = findChange(result, 'b');
    expect(a?.group).toBe('g001');
    expect(b?.group).toBe('g001');
  });

  it('assigns a strictly later group to a change blocked by another', () => {
    const result = board({
      changes: [change('dep'), change('blocked')],
      epics: [epic('dep'), epic('blocked', { deps: ['dep'] })],
    });

    expect(findChange(result, 'dep')?.group).toBe('g001');
    expect(findChange(result, 'blocked')?.group).toBe('g002');
  });

  it('marks a change with a dangling dep as unresolved', () => {
    const result = board({
      changes: [change('has-dangling')],
      epics: [epic('has-dangling', { deps: ['missing-dep'] })],
    });

    expect(findChange(result, 'has-dangling')?.group).toBe('!');
  });

  it('marks a completed change as done', () => {
    const result = board({
      changes: [change('done', 'completed')],
      epics: [epic('done')],
    });

    expect(findChange(result, 'done')?.group).toBe('—');
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
