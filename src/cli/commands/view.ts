/**
 * Bundle export: `spego view`.
 *
 * Honors the deprecated `--format` flag during the deprecation window in
 * addition to the global `--json` flag.
 */

import type { Command } from 'commander';
import { ArtifactEngine } from '../../artifacts/engine.js';
import { viewArtifacts } from '../../export/view.js';
import { intersperseBundleDividers, renderHeader } from '../render.js';
import { deprecate, emitJson } from '../output.js';
import { fail } from '../errors.js';
import { getJsonMode } from '../runtime.js';

export function registerView(program: Command): void {
  program
    .command('view')
    .description('Export artifact bundle as markdown (default) or JSON via --json')
    .option('--type <type>', 'filter by type')
    .option('--id <id>', 'limit to a single artifact')
    .option('--revision <n>', 'specific revision (requires --id)')
    .option('--include-deleted', 'include soft-deleted artifacts', false)
    .option('--format <fmt>', '[deprecated] markdown | json — use the global --json flag instead')
    .option('--cwd <dir>', 'project root')
    .action(async (opts) => {
      const globalJson = getJsonMode(program);
      if (opts.format !== undefined) {
        deprecate(globalJson, '--format is deprecated; use the global --json flag');
      }
      const wantJson = globalJson || opts.format === 'json';

      let engine: ArtifactEngine;
      try {
        engine = await ArtifactEngine.open({ projectRoot: opts.cwd });
      } catch (err) {
        fail(err, wantJson);
      }
      try {
        const view = await viewArtifacts(engine, {
          type: opts.type,
          id: opts.id,
          revision: opts.revision !== undefined ? Number(opts.revision) : undefined,
          includeDeleted: opts.includeDeleted,
        });
        if (wantJson) {
          emitJson(view.json);
        } else {
          const body = intersperseBundleDividers(view.markdown.content);
          process.stdout.write(`${renderHeader('📦', 'Artifact bundle')}\n${body}`);
        }
      } catch (err) {
        fail(err, wantJson);
      } finally {
        engine.close();
      }
    });
}
