import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { initWorkspace, workspaceStatus } from '../src/workspace/init.js';
import { readConfig } from '../src/workspace/config.js';
import { makeTempProject } from './helpers.js';

describe('init', () => {
  const cleanups: Array<() => Promise<void>> = [];

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
    expect(summary.config.orchestration).toBeUndefined();

    // Filesystem assertions
    await expect(fs.stat(summary.configPath)).resolves.toBeTruthy();
    await expect(fs.stat(summary.indexPath)).resolves.toBeTruthy();
    await expect(fs.stat(path.join(summary.artifactsRoot, 'prd'))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(summary.artifactsRoot, 'api'))).resolves.toBeTruthy();
    expect(summary.createdPaths.length).toBeGreaterThan(0);

    const configText = await fs.readFile(summary.configPath, 'utf8');
    expect(configText).not.toContain('orchestration:');
  });

  it('initializes OpenCode target files when opencode is configured', async () => {
    const { root, cleanup } = await makeTempProject();
    cleanups.push(cleanup);

    const summary = await initWorkspace({
      projectRoot: root,
      agents: ['opencode'],
      demo: false,
    });

    expect(summary.config.agents).toEqual(['opencode']);
    await expect(fs.stat(path.join(root, '.opencode', 'commands', 'spego-apply.md'))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(root, '.opencode', 'commands', 'spego-verify.md'))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(root, '.opencode', 'commands', 'spego-explore.md'))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(root, '.claude'))).rejects.toThrow();
  });

  it('reads legacy orchestration config without requiring model settings', async () => {
    const { root, cleanup } = await makeTempProject();
    cleanups.push(cleanup);

    const summary = await initWorkspace({ projectRoot: root, agents: ['claude'] });
    await fs.writeFile(
      summary.configPath,
      [
        'version: 1',
        'agents:',
        '  - claude',
        'demo: false',
        'extraArtifactTypes: []',
        'deliveryAdapter:',
        '  name: openspec',
        '  options: {}',
        'orchestration:',
        '  serverUrl: http://127.0.0.1:4096',
        '  models:',
        '    manager: ""',
        '    worker: ""',
        '    verifier: ""',
        '    fallback: ""',
        '  maxParallel: 4',
        '  workDir: .spego/orchestration',
        '',
      ].join('\n'),
      'utf8',
    );

    const config = await readConfig(summary.configPath);
    expect(config.agents).toEqual(['claude']);
    expect(config.orchestration?.serverUrl).toBe('http://127.0.0.1:4096');
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
