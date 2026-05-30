import { describe, it, expect, afterEach } from 'vitest';
import { spawnCli, setupInitialized, expectCliFailure } from './_cli-helpers.js';

describe('CLI orchestrate command', () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    for (const fn of cleanups.splice(0)) await fn();
  });

  it('requires --change (VALIDATION_FAILED in json mode)', async () => {
    const { root, cleanup } = await setupInitialized();
    cleanups.push(cleanup);
    const err = await expectCliFailure(['--json', 'orchestrate', '--cwd', root], root);
    expect(err.code).toBe(2);
    const envelope = JSON.parse(err.stderr);
    expect(envelope.error.code).toBe('VALIDATION_FAILED');
    expect(typeof envelope.error.details).toBe('object');
  });

  it('rejects an unknown change with a structured JSON error', async () => {
    const { root, cleanup } = await setupInitialized();
    cleanups.push(cleanup);
    const err = await expectCliFailure(
      ['--json', 'orchestrate', '--change', 'does-not-exist', '--cwd', root],
      root,
    );
    const envelope = JSON.parse(err.stderr);
    expect(envelope.error.code).toBe('CHANGE_NOT_FOUND');
    expect(envelope.error.details.changeName).toBe('does-not-exist');
  });

  it('rejects an unknown change with a human error envelope', async () => {
    const { root, cleanup } = await setupInitialized();
    cleanups.push(cleanup);
    const err = await expectCliFailure(
      ['orchestrate', '--change', 'does-not-exist', '--cwd', root],
      root,
    );
    expect(err.stderr).toContain('[CHANGE_NOT_FOUND]');
  });

  it('emits an orchestrate agent asset on init', async () => {
    const { root, cleanup } = await setupInitialized();
    cleanups.push(cleanup);
    const { stdout } = await spawnCli(['--json', 'skills', '--cwd', root], root);
    const reports = JSON.parse(stdout);
    const targets = reports.map((r: { target: string }) => r.target);
    expect(targets).toContain('opencode-orchestration');
  });
});
