/**
 * Index maintenance: `spego index rebuild`.
 */

import type { Command } from 'commander';
import { renderBox, renderHeader, renderTable } from '../render.js';
import { runEngineCommand } from '../runtime.js';

export function registerIndex(program: Command): void {
  const indexCmd = program.command('index').description('Index maintenance');

  indexCmd
    .command('rebuild')
    .description('Rebuild the SQLite index from markdown files')
    .option('--cwd <dir>', 'project root')
    .action(async (opts) => {
      await runEngineCommand({ program, cwd: opts.cwd }, async (engine) => {
        const report = await engine.rebuildIndex();
        const human = (): string => {
          const summary = renderBox('Index rebuild', [
            ['scanned', String(report.scannedFiles)],
            ['indexed', String(report.indexedArtifacts)],
            ['invalid', String(report.invalidFiles.length)],
          ]);
          const header = renderHeader('📦', 'Index rebuild');
          if (report.invalidFiles.length === 0) return `${header}\n${summary}`;
          const table = renderTable(
            ['path', 'error'],
            report.invalidFiles.map((i) => [i.path, i.error]),
            { maxWidth: 80 },
          );
          return `${header}\n${summary}\n\nInvalid files:\n${table}`;
        };
        return { payload: report, human };
      });
    });
}
