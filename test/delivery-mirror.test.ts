import { describe, expect, it } from 'vitest';
import {
  deriveMirror,
  filterMirrorGaps,
  type MirrorArtifact,
  type MirrorBoard,
  type MirrorInput,
  type MirrorWarning,
} from '../src/delivery/mirror.js';
import type { DeliveryStatus } from '../src/delivery/types.js';

function change(slug: string, status: DeliveryStatus = 'active', archived = false) {
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
