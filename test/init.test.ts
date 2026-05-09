import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { initWorkspace, workspaceStatus } from '../src/workspace/init.js';
import { makeTempProject } from './helpers.js';

describe('init', () => {
  let cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    for (const fn of cleanups.splice(0)) await fn();
  });

  it('creates the workspace layout with explicit options', async () => {
    const { root, cleanup } = await makeTempProject();
    cleanups.push(cleanup);

    const summary = await initWorkspace({
      projectRoot: root,
      agents: ['claude'],
      demo: false,
    });

    expect(summary.alreadyInitialized).toBe(false);
    expect(summary.projectRoot).toBe(root);
    expect(summary.workspaceRoot).toBe(path.join(root, '.spego'));
    expect(summary.config.agents).toEqual(['claude']);
    expect(summary.config.demo).toBe(false);

    // Filesystem assertions
    await expect(fs.stat(summary.configPath)).resolves.toBeTruthy();
    await expect(fs.stat(summary.indexPath)).resolves.toBeTruthy();
    await expect(fs.stat(path.join(summary.artifactsRoot, 'prd'))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(summary.artifactsRoot, 'api'))).resolves.toBeTruthy();
    expect(summary.createdPaths.length).toBeGreaterThan(0);
  });

  it('is idempotent on re-run', async () => {
    const { root, cleanup } = await makeTempProject();
    cleanups.push(cleanup);

    await initWorkspace({ projectRoot: root, agents: ['claude'] });

    // Drop a fake artifact to make sure init does not delete it.
    const prdDir = path.join(root, '.spego', 'artifacts', 'prd');
    await fs.writeFile(path.join(prdDir, 'sentinel.md'), '---\nsentinel: true\n---\n');

    const second = await initWorkspace({ projectRoot: root });
    expect(second.alreadyInitialized).toBe(true);
    await expect(fs.stat(path.join(prdDir, 'sentinel.md'))).resolves.toBeTruthy();
  });

  it('reports missing workspace via status', async () => {
    const { root, cleanup } = await makeTempProject();
    cleanups.push(cleanup);

    const status = await workspaceStatus(root);
    expect(status.initialized).toBe(false);
    expect(status.initCommand).toBe('spego init');
  });

  it('reports initialized workspace via status', async () => {
    const { root, cleanup } = await makeTempProject();
    cleanups.push(cleanup);
    await initWorkspace({ projectRoot: root, agents: ['claude', 'cursor'] });

    const status = await workspaceStatus(root);
    expect(status.initialized).toBe(true);
    expect(status.agents).toEqual(['claude', 'cursor']);
    expect(status.indexPath).toMatch(/spego\.db$/);
  });
});
