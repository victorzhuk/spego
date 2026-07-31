/**
 * `spego sync`: derive a reconciliation plan from the delivery mirror and apply
 * the mechanical subset — `create-epic` for every ungroomed active change and
 * `close-sprint` for every finished non-closed sprint. Judgment-only warnings
 * (orphan-epic, dangling-dep, dep-cycle, out-of-order-dep) are reported as
 * `remaining` and never applied. `--dry-run` derives and prints the plan only.
 */

import type { Command } from 'commander';
import { loadBoardState } from '../../delivery/load.js';
import { deriveSyncPlan, type SyncAction } from '../../delivery/sync.js';
import { resolveAdapter, type DeliveryAdapter } from '../../delivery/index.js';
import type { MirrorWarning } from '../../delivery/mirror.js';
import { assertWorkspace } from '../../delivery/openspec-discover.js';
import { assertEpicSlugActive } from '../epic-slug.js';
import { SpegoError } from '../../errors.js';
import { renderSection, renderTable } from '../render.js';
import { runEngineCommand } from '../runtime.js';
import type { ArtifactEngine } from '../../artifacts/engine.js';

interface SyncOptions {
  dryRun?: boolean;
  cwd?: string;
}

interface AppliedResult {
  kind: 'create-epic' | 'close-sprint';
  slug: string;
  id: string;
  revision: number;
}

interface SyncPayload {
  actions: SyncAction[];
  applied: AppliedResult[];
  dryRun: boolean;
  remaining: MirrorWarning[];
}

async function resolveEpicAdapter(engine: ArtifactEngine): Promise<DeliveryAdapter | null> {
  const adapter = resolveAdapter(engine.paths.projectRoot, engine.config);
  try {
    await assertWorkspace(engine.paths.projectRoot);
  } catch (err) {
    if (err instanceof SpegoError && err.code === 'DELIVERY_ADAPTER_ERROR') {
      return null;
    }
    throw err;
  }
  return adapter;
}

function syncRows(actions: SyncAction[], applied: AppliedResult[], dryRun: boolean): string[][] {
  if (dryRun) {
    return actions.map((action) => {
      if (action.kind === 'create-epic') {
        return ['create-epic', `epic:${action.slug}`, action.title];
      }
      return ['close-sprint', `sprint:${action.slug}`, 'close'];
    });
  }
  return applied.map((result) => {
    if (result.kind === 'create-epic') {
      return ['create-epic', `epic:${result.slug}`, `created → rev ${result.revision}`];
    }
    return ['close-sprint', `sprint:${result.slug}`, `closed → rev ${result.revision}`];
  });
}

function renderSync(payload: SyncPayload): string {
  const rows = syncRows(payload.actions, payload.applied, payload.dryRun);
  const lines: string[] = [];
  if (rows.length === 0) {
    lines.push('Mirror is reconciled — no actions.');
  } else {
    lines.push(renderTable(['action', 'target', 'detail'], rows));
  }
  if (payload.remaining.length > 0) {
    const count = payload.remaining.length;
    lines.push(`${count} judgment-only warning${count === 1 ? '' : 's'} remain — see \`spego board\`.`);
  }
  if (payload.dryRun) lines.push('Dry run: no changes written.');
  return renderSection('🔄', 'Sync', ...lines);
}

export function registerSync(program: Command): void {
  program
    .command('sync')
    .description('Reconcile the delivery mirror: create missing epics and close finished sprints')
    .option('--dry-run', 'derive and print the plan without applying')
    .option('--cwd <dir>', 'project root')
    .action(async (opts: SyncOptions) => {
      await runEngineCommand({ program, cwd: opts.cwd }, async (engine) => {
        const { input, board } = await loadBoardState(engine, opts.cwd);
        const plan = deriveSyncPlan(board, input);

        if (opts.dryRun) {
          const payload: SyncPayload = {
            actions: plan.actions,
            applied: [],
            remaining: plan.remaining,
            dryRun: true,
          };
          return { payload, human: () => renderSync(payload) };
        }

        const revisionById = new Map<string, number>();
        for (const row of engine.list({ type: 'sprint-plan' })) {
          revisionById.set(row.id, row.revision);
        }

        const needsAdapter = plan.actions.some((action) => action.kind === 'create-epic');
        const adapter = needsAdapter ? await resolveEpicAdapter(engine) : null;

        const applied: AppliedResult[] = [];
        for (const action of plan.actions) {
          if (action.kind === 'create-epic') {
            await assertEpicSlugActive(adapter, action.slug);
            const record = await engine.create({
              type: 'epic',
              title: action.title,
              slug: action.slug,
              body: '',
              meta: {},
            });
            applied.push({
              kind: 'create-epic',
              slug: record.frontmatter.slug,
              id: record.frontmatter.id,
              revision: record.frontmatter.revision,
            });
          } else {
            const expectedRevision = revisionById.get(action.id);
            if (expectedRevision === undefined) {
              throw new SpegoError(
                'ARTIFACT_NOT_FOUND',
                `Sprint artifact not found for close: ${action.slug}`,
                { id: action.id, slug: action.slug },
              );
            }
            const current = await engine.readById(action.id);
            const record = await engine.update(action.id, {
              expectedRevision,
              meta: { ...current.frontmatter.meta, status: 'closed' },
            });
            applied.push({
              kind: 'close-sprint',
              slug: record.frontmatter.slug,
              id: record.frontmatter.id,
              revision: record.frontmatter.revision,
            });
          }
        }

        const payload: SyncPayload = {
          actions: plan.actions,
          applied,
          remaining: plan.remaining,
          dryRun: false,
        };
        return { payload, human: () => renderSync(payload) };
      });
    });
}
