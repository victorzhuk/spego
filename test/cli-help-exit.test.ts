import { describe, it, expect } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const PROJECT_ROOT = path.resolve(import.meta.dirname, '..');
const CLI_PATH = path.join(PROJECT_ROOT, 'src', 'cli.ts');

const exec = promisify(execFile);

const cli = (args: string[]) =>
  exec('npx', ['tsx', CLI_PATH, ...args], {
    cwd: PROJECT_ROOT,
    timeout: 30_000,
    env: { ...process.env, NODE_NO_WARNINGS: '1' },
  });

describe('CLI Help and Version exits', () => {
  it('exits with 0 and prints help to stdout with no stderr noise', async () => {
    const { stdout, stderr } = await cli(['--help']);
    expect(stdout).toContain('Agent-first product orchestration: artifact engine');
    expect(stderr).toBe('');
  });

  it('exits with 0 and prints help to stdout with no stderr noise on no-arg invocation', async () => {
    const { stdout, stderr } = await cli([]);
    expect(stdout).toContain('Agent-first product orchestration: artifact engine');
    expect(stderr).toBe('');
  });

  it('exits with 0 and prints subcommand help to stdout with no stderr noise', async () => {
    const { stdout, stderr } = await cli(['create', '--help']);
    expect(stdout).toContain('Create an artifact');
    expect(stderr).toBe('');
  });

  it('exits with 0 and prints version to stdout with no stderr noise', async () => {
    const { stdout, stderr } = await cli(['--version']);
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
    expect(stderr).toBe('');
  });

  it('exits with 0 and prints help to stdout with no stderr noise in json mode', async () => {
    const { stdout, stderr } = await cli(['--json', '--help']);
    expect(stdout).toContain('Agent-first product orchestration: artifact engine');
    expect(stderr).toBe('');
  });

  it('exits with code 2 and prints validation error to stderr on real argument validation error', async () => {
    await expect(cli(['--nope'])).rejects.toMatchObject({ code: 2 });
    try {
      await cli(['--nope']);
    } catch (e) {
      const err = e as { stderr: string };
      expect(err.stderr).toContain('[VALIDATION_FAILED]');
    }
  });

  it('exits with code 2 and prints json validation error to stderr on real argument validation error in json mode', async () => {
    await expect(cli(['--json', '--nope'])).rejects.toMatchObject({ code: 2 });
    try {
      await cli(['--json', '--nope']);
    } catch (e) {
      const err = e as { stderr: string };
      const parsed = JSON.parse(err.stderr);
      expect(parsed.error.code).toBe('VALIDATION_FAILED');
      expect(typeof parsed.error.details).toBe('object');
    }
  });
});
