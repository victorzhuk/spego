/**
 * Skill regeneration: `spego skills` (and the hidden `regenerate` alias).
 */

import path from 'node:path';
import type { Command } from 'commander';
import { resolveWorkspacePaths } from '../../workspace/paths.js';
import { readConfig } from '../../workspace/config.js';
import { generateAll } from '../../generator/index.js';
import { emitOrchestrationAssets } from '../../orchestration/emit.js';
import { renderHeader } from '../render.js';
import { deprecate } from '../output.js';
import { runCommand } from '../runtime.js';

async function runSkills(cwd: string | undefined, json: boolean): Promise<{
  payload: unknown;
  human: () => string;
}> {
  const projectRoot = path.resolve(cwd ?? process.cwd());
  const wsPaths = resolveWorkspacePaths(projectRoot);
  const config = await readConfig(wsPaths.configPath);
  const reports = await generateAll(projectRoot, config.agents, { emitWarnings: !json });
  reports.push(await emitOrchestrationAssets(projectRoot));
  const human = (): string => {
    const lines: string[] = [renderHeader('🛠️', 'Skill regeneration'), ''];
    for (const r of reports) {
      lines.push(`[${r.target}]`);
      for (const f of r.files) {
        lines.push(`  ${f.action}  ${f.path}`);
      }
    }
    return lines.join('\n');
  };
  return { payload: reports, human };
}

export function registerSkills(program: Command): void {
  program
    .command('skills')
    .description('Regenerate agent skill and command files')
    .option('--cwd <dir>', 'project root')
    .action(async (opts) => {
      await runCommand({ program }, async (json) => runSkills(opts.cwd, json));
    });

  program
    .command('regenerate', { hidden: true })
    .description('Regenerate agent skill and command files')
    .option('--cwd <dir>', 'project root')
    .action(async (opts) => {
      await runCommand({ program }, async (json) => {
        deprecate(json, "'spego regenerate' is now 'spego skills'");
        return runSkills(opts.cwd, json);
      });
    });
}
