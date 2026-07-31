/**
 * Delivery-mirror reconciliation plan.
 *
 * `deriveSyncPlan` is pure, like `deriveMirror`: it reads the derived board
 * plus the mirror input and splits the board's warnings into the mechanical
 * subset an agent (or `spego sync`) can apply without judgment — create an epic
 * for every ungroomed change, close every finished non-closed sprint — and the
 * judgment-only remainder (orphan-epic, dangling-dep, dep-cycle,
 * out-of-order-dep) that still belongs to the groom workflow.
 */

import type {
  MirrorBoard,
  MirrorInput,
  MirrorWarning,
} from './mirror.js';

export interface CreateEpicAction {
  kind: 'create-epic';
  /** OpenSpec change slug the new epic mirrors; passed explicitly to `engine.create`. */
  slug: string;
  /** Resolved epic title (from the mirror change, falling back to the slug). */
  title: string;
}

export interface CloseSprintAction {
  kind: 'close-sprint';
  /** sprint-plan slug, for display. */
  slug: string;
  /** sprint-plan artifact id, the update target. */
  id: string;
}

export type SyncAction = CreateEpicAction | CloseSprintAction;

export interface SyncPlan {
  actions: SyncAction[];
  /** Warnings that need human judgment and are deliberately not actioned here. */
  remaining: MirrorWarning[];
}

/**
 * Derive the mechanical reconciliation plan from a derived board.
 *
 * Warning order is preserved as `deriveMirror` returns it (sorted by
 * `WARNING_ORDER`): `ungroomed-change` → `create-epic`, `closable-sprint` →
 * `close-sprint`, every other code → `remaining`.
 */
export function deriveSyncPlan(board: MirrorBoard, input: MirrorInput): SyncPlan {
  const titleBySlug = new Map<string, string>();
  for (const sprint of board.sprints) {
    for (const change of sprint.changes) {
      if (!titleBySlug.has(change.slug)) titleBySlug.set(change.slug, change.title);
    }
  }
  for (const change of board.ungrouped) {
    if (!titleBySlug.has(change.slug)) titleBySlug.set(change.slug, change.title);
  }

  const sprintIdBySlug = new Map<string, string>();
  for (const artifact of input.sprints) sprintIdBySlug.set(artifact.slug, artifact.id);

  const actions: SyncAction[] = [];
  const remaining: MirrorWarning[] = [];

  for (const warning of board.warnings) {
    if (warning.code === 'ungroomed-change') {
      const slug = String(warning.details?.change ?? '');
      const title = titleBySlug.get(slug) || slug;
      actions.push({ kind: 'create-epic', slug, title });
    } else if (warning.code === 'closable-sprint') {
      const slug = String(warning.details?.sprint ?? '');
      const id = sprintIdBySlug.get(slug);
      if (id) {
        actions.push({ kind: 'close-sprint', slug, id });
      } else {
        remaining.push(warning);
      }
    } else {
      remaining.push(warning);
    }
  }

  return { actions, remaining };
}

