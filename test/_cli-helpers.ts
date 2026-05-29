/**
 * Shared CLI spawn helpers for end-to-end tests.
 *
 * Each test file should import `spawnCli` and `setupInitialized` from here so
 * the temp-project plumbing stays in one place and individual tests stay
 * focused on the behavior they are asserting.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { makeTempProject } from './helpers.js';

const PROJECT_ROOT = path.resolve(import.meta.dirname, '..');
const CLI_PATH = path.join(PROJECT_ROOT, 'src', 'cli.ts');

const exec = promisify(execFile);

export interface CliResult {
  stdout: string;
  stderr: string;
}

export interface CliExecError extends Error {
  code: number;
  stdout: string;
  stderr: string;
}

export function spawnCli(
  args: string[],
  cwd: string = PROJECT_ROOT,
  opts: { input?: string } = {},
): Promise<CliResult> {
  const child = exec('npx', ['tsx', CLI_PATH, ...args], {
    cwd,
    timeout: 30_000,
    env: { ...process.env, NODE_NO_WARNINGS: '1' },
  });
  if (opts.input !== undefined && child.child.stdin) {
    child.child.stdin.end(opts.input);
  }
  return child;
}

export async function setupInitialized(): Promise<{
  root: string;
  cleanup: () => Promise<void>;
}> {
  const project = await makeTempProject();
  await spawnCli(['init', '--agents', 'claude', '--demo', 'false', '--cwd', project.root], project.root);
  return project;
}

export async function expectCliFailure(
  args: string[],
  cwd: string,
): Promise<CliExecError> {
  try {
    await spawnCli(args, cwd);
  } catch (e) {
    return e as CliExecError;
  }
  throw new Error(`Expected CLI to fail for args: ${args.join(' ')}`);
}
