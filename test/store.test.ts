import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { appendStoreRun, readStoreRuns } from '../src/delivery/store.js';
import { resolveStoreRoot, storeRunsPath, STORE_ROOT_ENV_VAR } from '../src/workspace/paths.js';
import { testStoreRoot } from './_cli-helpers.js';
import { makeTempProject } from './helpers.js';

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const fn of cleanups.splice(0)) await fn();
});

describe('resolveStoreRoot', () => {
  it('honors the environment override before any fallback', () => {
    const root = resolveStoreRoot({ [STORE_ROOT_ENV_VAR]: 'some/where' });
    expect(root).toBe(path.resolve('some/where'));
  });

  it('treats a blank override as absent', () => {
    const root = resolveStoreRoot({ [STORE_ROOT_ENV_VAR]: '   ', XDG_CONFIG_HOME: '/xdg' });
    expect(root).toBe(path.join('/xdg', 'spego'));
  });

  it('falls back to the platform configuration directory', () => {
    const root = resolveStoreRoot({});
    if (process.platform === 'win32') {
      expect(root).toBe(path.join(os.homedir(), '.config', 'spego'));
    } else if (process.platform === 'darwin') {
      expect(root).toBe(path.join(os.homedir(), 'Library', 'Application Support', 'spego'));
    } else {
      expect(root).toBe(path.join(os.homedir(), '.config', 'spego'));
    }
  });
});

describe('cross-project store', () => {
  async function tempRoot(): Promise<string> {
    const { root, cleanup } = await makeTempProject();
    cleanups.push(cleanup);
    return path.join(root, 'store');
  }

  it('reads a missing store as empty', async () => {
    expect(await readStoreRuns(await tempRoot())).toEqual([]);
  });

  it('appends runs, creating the root on first write', async () => {
    const root = await tempRoot();
    await appendStoreRun(root, { flow: 'zapply', tier: 'm', hours: 2 });
    await appendStoreRun(root, { flow: 'opsx-apply', tier: 'l', hours: 9 });
    expect(await readStoreRuns(root)).toEqual([
      { flow: 'zapply', tier: 'm', hours: 2 },
      { flow: 'opsx-apply', tier: 'l', hours: 9 },
    ]);
  });

  it('drops malformed lines and keeps the history around them', async () => {
    const root = await tempRoot();
    await fs.mkdir(root, { recursive: true });
    const lines = [
      '{"flow":"zapply","tier":"m","hours":2}',
      'not json',
      '{"flow":"zapply","tier":"m","hours":-1}',
      '{"flow":"zapply","tier":"huge","hours":3}',
      '{"flow":"","tier":"m","hours":3}',
      '{"tier":"m","hours":3}',
      '{"flow":"zapply","tier":"m","hours":4}',
    ];
    await fs.writeFile(storeRunsPath(root), `${lines.join('\n')}\n`, 'utf8');
    expect(await readStoreRuns(root)).toEqual([
      { flow: 'zapply', tier: 'm', hours: 2 },
      { flow: 'zapply', tier: 'm', hours: 4 },
    ]);
  });
});

describe('test-wide store isolation', () => {
  it('points every spawned CLI run at a temp root, never the real configuration directory', () => {
    const isolated = testStoreRoot();
    expect(isolated.startsWith(os.tmpdir())).toBe(true);
    expect(path.resolve(isolated)).not.toBe(resolveStoreRoot({}));
  });
});
