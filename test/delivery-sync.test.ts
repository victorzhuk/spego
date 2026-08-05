import { describe, expect, it } from 'vitest';
import { deriveMirror, type MirrorInput } from '../src/delivery/mirror.js';
import { deriveSyncPlan } from '../src/delivery/sync.js';
import type { DeliveryStatus } from '../src/delivery/types.js';

function change(slug: string, status: DeliveryStatus = 'in-progress', archived = false) {
  return { slug, title: title(slug), status, archived };
}

function epic(slug: string, meta: Record<string, unknown> = {}, status?: DeliveryStatus) {
  return {
    id: `epic-${slug}`,
    type: 'epic' as const,
    slug,
    title: title(slug),
    meta: status ? { ...meta, status } : meta,
  };
}

function sprint(slug: string, changes: string[], meta: Record<string, unknown> = {}) {
  return {
    id: `sprint-${slug}`,
    type: 'sprint-plan' as const,
    slug,
    title: title(slug),
    meta: { changes, status: 'planned', ...meta },
  };
}

function title(slug: string): string {
  return slug.split('-').map((part) => part[0]!.toUpperCase() + part.slice(1)).join(' ');
}

function plan(input: Partial<MirrorInput>) {
  const full: MirrorInput = {
    changes: [],
    epics: [],
    sprints: [],
    linkedArtifacts: [],
    warnings: [],
    ...input,
  };
  return deriveSyncPlan(deriveMirror(full), full);
}

describe('deriveSyncPlan', () => {
  it('plans create-epic for every ungroomed active change, with title resolved from the mirror', () => {
    const { actions, remaining } = plan({ changes: [change('add-foo')] });
    expect(actions).toEqual([{ kind: 'create-epic', slug: 'add-foo', title: 'Add Foo' }]);
    expect(remaining).toEqual([]);
  });

  it('falls back to the slug for the create-epic title when the change has no title', () => {
    const full: MirrorInput = {
      changes: [{ slug: 'add-bar', title: '', status: 'in-progress' }],
      epics: [],
      sprints: [],
      linkedArtifacts: [],
      warnings: [],
    };
    const { actions } = deriveSyncPlan(deriveMirror(full), full);
    expect(actions).toEqual([{ kind: 'create-epic', slug: 'add-bar', title: 'add-bar' }]);
  });

  it('plans close-sprint for a finished non-closed sprint, carrying the artifact id', () => {
    const { actions, remaining } = plan({
      changes: [change('done-thing', 'done')],
      epics: [epic('done-thing')],
      sprints: [sprint('release', ['done-thing'], { status: 'active' })],
    });
    expect(actions).toEqual([{ kind: 'close-sprint', slug: 'release', id: 'sprint-release' }]);
    expect(remaining).toEqual([]);
  });

  it('plans nothing for a sprint that is already closed', () => {
    const { actions } = plan({
      changes: [change('done-thing', 'done')],
      epics: [epic('done-thing')],
      sprints: [sprint('release', ['done-thing'], { status: 'closed' })],
    });
    expect(actions).toEqual([]);
  });

  it('plans nothing for a sprint that is not finished — pending changes or emptied', () => {
    const { actions } = plan({
      changes: [change('pending', 'in-progress')],
      epics: [epic('pending')],
      sprints: [
        sprint('wip', ['pending'], { status: 'active' }),
        sprint('empty', [], { status: 'planned' }),
      ],
    });
    expect(actions).toEqual([]);
  });

  it('routes orphan epics to remaining and never plans an action for them', () => {
    const { actions, remaining } = plan({ epics: [epic('ghost')] });
    expect(actions).toEqual([]);
    expect(remaining.map((w) => w.code)).toContain('orphan-epic');
  });

  it('keeps mechanical actions in warning order and routes judgment warnings to remaining', () => {
    // closable-sprint (WARNING_ORDER 3) sorts before ungroomed-change (8).
    const { actions, remaining } = plan({
      changes: [change('ungroomed-one'), change('done', 'done')],
      epics: [epic('done'), epic('orphan')],
      sprints: [sprint('release', ['done'], { status: 'active' })],
    });
    expect(actions).toEqual([
      { kind: 'close-sprint', slug: 'release', id: 'sprint-release' },
      { kind: 'create-epic', slug: 'ungroomed-one', title: 'Ungroomed One' },
    ]);
    expect(remaining.some((w) => w.code === 'orphan-epic')).toBe(true);
    expect(remaining.some((w) => w.code === 'ungroomed-change')).toBe(false);
    expect(remaining.some((w) => w.code === 'closable-sprint')).toBe(false);
  });

  it('plans retire-epic for an orphan epic whose backing change is archived', () => {
    const { actions, remaining } = plan({
      changes: [change('archived-change', 'completed', true)],
      epics: [epic('archived-change')],
    });
    expect(actions).toEqual([{ kind: 'retire-epic', slug: 'archived-change', id: 'epic-archived-change' }]);
    expect(remaining.some((w) => w.code === 'orphan-epic')).toBe(false);
  });

  it('leaves a missing-reason orphan epic in remaining without planning a retire', () => {
    const { actions, remaining } = plan({ epics: [epic('ghost')] });
    expect(actions.some((a) => a.kind === 'retire-epic')).toBe(false);
    expect(actions).toEqual([]);
    expect(remaining.some((w) => w.code === 'orphan-epic')).toBe(true);
  });

  it('routes dangling-dep, dep-cycle, and out-of-order-dep warnings to remaining without actions', () => {
    const { actions, remaining } = plan({
      changes: [change('a'), change('b')],
      epics: [epic('a', { deps: ['b', 'ghost'] }), epic('b', { deps: ['a'] })],
      sprints: [
        sprint('s1', ['a'], { status: 'active', startDate: '2026-01-01' }),
        sprint('s2', ['b'], { status: 'active', startDate: '2026-02-01' }),
      ],
    });
    expect(actions).toEqual([]);
    expect(remaining.some((w) => w.code === 'dangling-dep')).toBe(true);
    expect(remaining.some((w) => w.code === 'dep-cycle')).toBe(true);
    expect(remaining.some((w) => w.code === 'out-of-order-dep')).toBe(true);
  });
});
