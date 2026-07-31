import { describe, it, expect } from 'vitest';
import { aggregateWarningRows } from '../src/cli/commands/board.js';
import type { MirrorWarning } from '../src/delivery/mirror.js';

function warning(code: MirrorWarning['code'], message: string, details: Record<string, unknown> = {}): MirrorWarning {
  return { code, message, details };
}

describe('aggregateWarningRows', () => {
  it('merges two closable-sprint warnings with different sprints into one row', () => {
    const rows = aggregateWarningRows([
      warning('closable-sprint', 'Sprint "sprint-a" can be closed.', { sprint: 'sprint-a' }),
      warning('closable-sprint', 'Sprint "sprint-b" can be closed.', { sprint: 'sprint-b' }),
    ]);
    expect(rows).toEqual([
      ['closable-sprint', 'Sprints "sprint-a", "sprint-b" have no pending changes and can be closed.'],
    ]);
  });

  it('merges two dep-cycle warnings into one row', () => {
    const rows = aggregateWarningRows([
      warning('dep-cycle', 'add-api is in a cycle.', { change: 'add-api' }),
      warning('dep-cycle', 'add-ui is in a cycle.', { change: 'add-ui' }),
    ]);
    expect(rows).toEqual([['dep-cycle', 'Changes "add-api", "add-ui" are part of a dependency cycle.']]);
  });

  it('merges two ungroomed-change warnings into one row', () => {
    const rows = aggregateWarningRows([
      warning('ungroomed-change', 'chg-1 has no epic.', { change: 'chg-1' }),
      warning('ungroomed-change', 'chg-2 has no epic.', { change: 'chg-2' }),
    ]);
    expect(rows).toEqual([['ungroomed-change', 'Active changes "chg-1", "chg-2" have no epic artifacts.']]);
  });

  it('never merges orphan-epic warnings with different reasons', () => {
    const rows = aggregateWarningRows([
      warning('orphan-epic', 'Epic "epic-1" does not resolve.', { reason: 'missing', change: 'epic-1' }),
      warning('orphan-epic', 'Epic "epic-2" points at archived.', { reason: 'archived', change: 'epic-2' }),
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0]![0]).toBe('orphan-epic');
    expect(rows[1]![0]).toBe('orphan-epic');
    expect(rows).toContainEqual(['orphan-epic', 'Epic "epic-1" does not resolve.']);
    expect(rows).toContainEqual(['orphan-epic', 'Epic "epic-2" points at archived.']);
  });

  it('passes each adapter-warning through as its own row', () => {
    const rows = aggregateWarningRows([
      warning('adapter-warning', 'adapter A failed.'),
      warning('adapter-warning', 'adapter B failed.'),
    ]);
    expect(rows).toEqual([
      ['adapter-warning', 'adapter A failed.'],
      ['adapter-warning', 'adapter B failed.'],
    ]);
  });
});
