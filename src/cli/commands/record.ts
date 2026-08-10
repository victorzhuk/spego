import path from 'node:path';
import type { Command } from 'commander';
import { SpegoError } from '../../errors.js';
import { SIZE_TIERS } from '../../artifacts/types.js';
import { discoverChanges } from '../../delivery/openspec-discover.js';
import { parseActuals } from '../../delivery/mirror.js';
import { appendStoreRun } from '../../delivery/store.js';
import { resolveStoreRoot } from '../../workspace/paths.js';
import { renderSection } from '../render.js';
import { runEngineCommand } from '../runtime.js';

interface RecordOptions {
  flow: string;
  hours: string;
  expectedRevision?: string;
  cwd?: string;
}

/**
 * The third writer, narrow by construction: one command, one job — append a
 * Flow-supplied measurement to the change's epic `actuals`. No judgment, no
 * derivation, no other epic field touched. Optimistic concurrency comes from
 * the artifact write path: a caller-supplied `--expected-revision` catches
 * staleness across the caller's own read-compute-write span, and the engine's
 * write-time check catches a race against the freshly read revision.
 */
export function registerRecord(program: Command): void {
  program
    .command('record')
    .description('Record one measured run (flow hours) against a change')
    .argument('<change>', 'OpenSpec change slug')
    .requiredOption('--flow <name>', 'Flow that ran the change')
    .requiredOption('--hours <n>', 'elapsed Flow Hours for this run')
    .option('--expected-revision <n>', 'expected current epic revision (optimistic concurrency)')
    .option('--cwd <dir>', 'project root')
    .action(async (change: string, opts: RecordOptions) => {
      await runEngineCommand({ program, cwd: opts.cwd }, async (engine) => {
        const hours = Number(opts.hours);
        if (!Number.isFinite(hours) || hours < 0) {
          throw new SpegoError('VALIDATION_FAILED', `Invalid hours value: ${opts.hours}`, {
            hours: opts.hours,
          });
        }
        if (opts.flow.trim().length === 0) {
          throw new SpegoError('VALIDATION_FAILED', 'Invalid flow name: must be non-empty', { flow: opts.flow });
        }

        const projectRoot = path.resolve(opts.cwd ?? process.cwd());
        const discovered = await discoverChanges(projectRoot);
        if (!discovered.some((item) => item.name === change)) {
          throw new SpegoError('CHANGE_NOT_FOUND', `Unknown change: ${change}`, { change });
        }
        const indexed = engine.list({ type: 'epic' }).find((item) => item.slug === change);
        if (!indexed) {
          throw new SpegoError('CHANGE_NOT_FOUND', `Change "${change}" has no epic artifact`, { change });
        }

        const current = await engine.readById(indexed.id);
        const actuals = [...parseActuals(current.frontmatter.meta.actuals), { flow: opts.flow, hours }];
        const expectedRevision =
          opts.expectedRevision !== undefined ? Number(opts.expectedRevision) : current.frontmatter.revision;
        const updated = await engine.update(indexed.id, {
          meta: { ...current.frontmatter.meta, actuals },
          expectedRevision,
        });

        // Epic first, store second: the run must land on its change before it
        // can count cross-project. A run without a usable tier cannot be keyed
        // by (Flow, Tier) and contributes nothing to the store.
        const tier = current.frontmatter.meta.tier;
        if (typeof tier === 'string' && (SIZE_TIERS as readonly string[]).includes(tier)) {
          try {
            await appendStoreRun(resolveStoreRoot(), { flow: opts.flow, tier, hours });
          } catch (err) {
            throw new SpegoError(
              'WRITE_FAILED',
              `Run recorded on the epic, but the cross-project store write failed: ${(err as Error).message}`,
              { change, flow: opts.flow, hours, cause: (err as Error).message },
            );
          }
        }

        const payload = {
          change,
          flow: opts.flow,
          hours,
          actuals,
          revision: updated.frontmatter.revision,
        };
        return {
          payload,
          human: () =>
            renderSection(
              '⏱️',
              'Record',
              `Recorded ${hours}h under flow ${opts.flow} against ${change} (epic revision ${updated.frontmatter.revision}).`,
            ),
        };
      });
    });
}
