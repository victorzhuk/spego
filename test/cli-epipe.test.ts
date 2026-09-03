import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { setupInitialized, testStoreRoot } from './_cli-helpers.js';
import { STORE_ROOT_ENV_VAR } from '../src/workspace/paths.js';

const PROJECT_ROOT = path.resolve(import.meta.dirname, '..');
const CLI_PATH = path.join(PROJECT_ROOT, 'src', 'cli.ts');

describe('CLI stdout closed early', () => {
  let root: string;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    ({ root, cleanup } = await setupInitialized());
  });

  afterAll(async () => {
    await cleanup();
  });

  it('exits 0 without an EPIPE trace when the reader closes the pipe', async () => {
    const child = spawn('npx', ['--silent', 'tsx', CLI_PATH, 'list', '--json', '--cwd', root], {
      cwd: PROJECT_ROOT,
      env: {
        ...process.env,
        NODE_NO_WARNINGS: '1',
        npm_config_loglevel: 'silent',
        [STORE_ROOT_ENV_VAR]: testStoreRoot(),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.stdout.destroy();

    const code = await new Promise<number | null>((resolve) => child.on('close', resolve));
    expect(stderr).not.toContain('EPIPE');
    expect(code).toBe(0);
  });
});
