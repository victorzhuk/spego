#!/usr/bin/env node
/**
 * spego CLI orchestrator.
 *
 * `buildProgram` wires the global `--json` flag, the program-level help and
 * version handling, and one registrar per command group. Every command body
 * lives under `src/cli/commands/` and routes through the shared runtime helper
 * in `src/cli/runtime.ts`. Error formatting is centralized in `src/cli/errors.ts`.
 */
import { Command } from 'commander';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import pkg from '../package.json' with { type: 'json' };
import { fail, failValidation } from './cli/errors.js';
import { registerMeta } from './cli/commands/meta.js';
import { registerWorkspace } from './cli/commands/workspace.js';
import { registerArtifact } from './cli/commands/artifact.js';
import { registerView } from './cli/commands/view.js';
import { registerIndex } from './cli/commands/index-rebuild.js';
import { registerSkills } from './cli/commands/skills.js';
import { registerDelivery } from './cli/commands/delivery.js';
import { registerMirror } from './cli/commands/mirror.js';

export function buildProgram(): Command {
  const program = new Command();
  program
    .name('spego')
    .description('Agent-first product orchestration: artifact engine')
    .option('--json', 'emit JSON output (deterministic, decoration-free)', false)
    .version(pkg.version);

  program.configureOutput({
    writeErr: (str: string) => {
      const json = program.opts().json as boolean;
      if (!json) {
        process.stderr.write(str);
      }
    },
  });

  program.exitOverride((err) => {
    if (
      err.code === 'commander.help' ||
      err.code === 'commander.helpDisplayed' ||
      err.code === 'commander.version'
    ) {
      process.exit(err.exitCode ?? 0);
    }
    failValidation(err, program.opts().json as boolean);
  });

  registerMeta(program);
  registerWorkspace(program);
  registerArtifact(program);
  registerView(program);
  registerIndex(program);
  registerSkills(program);
  registerDelivery(program);
  registerMirror(program);

  return program;
}

/**
 * Detect whether this module is the process entry point. Without this guard,
 * importing `buildProgram` from a test would execute `parseAsync` against the
 * test runner's own argv and either error out or terminate the process.
 */
function isEntryPoint(): boolean {
  if (typeof process === 'undefined') return false;
  const argv1 = process.argv[1];
  if (!argv1) return false;
  try {
    return realpathSync(argv1) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (isEntryPoint()) {
  const program = buildProgram();
  const args = process.argv;
  if (args.length <= 2) {
    program.parseAsync([...args, '--help']).catch((err) => {
      fail(err, program.opts().json as boolean);
    });
  } else {
    program.parseAsync(args).catch((err) => {
      fail(err, program.opts().json as boolean);
    });
  }
}
