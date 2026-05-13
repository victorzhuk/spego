import { describe, it, expect, afterEach } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import { makeTempProject } from './helpers.js';

const PROJECT_ROOT = path.resolve(import.meta.dirname, '..');
const CLI_PATH = path.join(PROJECT_ROOT, 'src', 'cli.ts');

const exec = promisify(execFile);

const cli = (args: string[], cwd: string) =>
  exec('npx', ['tsx', CLI_PATH, ...args], { cwd, timeout: 30_000 });

describe('CLI init', () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    for (const fn of cleanups.splice(0)) await fn();
  });

  it('creates .spego/ workspace', async () => {
    const { root, cleanup } = await makeTempProject();
    cleanups.push(cleanup);

    const { stdout } = await cli(['init', '--agents', 'claude', '--demo', 'false', '--cwd', root], root);
    expect(stdout).toContain('Initialized spego workspace');
    await expect(fs.stat(path.join(root, '.spego'))).resolves.toBeTruthy();
  });

  it('is idempotent on re-run', async () => {
    const { root, cleanup } = await makeTempProject();
    cleanups.push(cleanup);

    await cli(['init', '--agents', 'claude', '--demo', 'false', '--cwd', root], root);
    const { stdout } = await cli(['init', '--agents', 'claude', '--demo', 'false', '--cwd', root], root);
    expect(stdout).toContain('already initialized');
  });

  it('reports initialized workspace via status', async () => {
    const { root, cleanup } = await makeTempProject();
    cleanups.push(cleanup);

    await cli(['init', '--agents', 'claude', '--cwd', root], root);
    const { stdout } = await cli(['status', '--cwd', root], root);
    expect(stdout).toContain('Workspace ready');
  });
});

describe('CLI CRUD', () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    for (const fn of cleanups.splice(0)) await fn();
  });

  async function setupProject() {
    const { root, cleanup } = await makeTempProject();
    cleanups.push(cleanup);
    await cli(['init', '--agents', 'claude', '--demo', 'false', '--cwd', root], root);
    return root;
  }

  it('creates an artifact and returns JSON with id', async () => {
    const root = await setupProject();
    const { stdout } = await cli(
      ['--json', 'create', '--type', 'prd', '--title', 'Test PRD', '--body', 'body text', '--cwd', root],
      root,
    );
    const result = JSON.parse(stdout);
    expect(result.id).toBeTruthy();
    expect(result.type).toBe('prd');
    expect(result.slug).toBe('test-prd');
  });

  it('lists artifacts', async () => {
    const root = await setupProject();
    await cli(['--json', 'create', '--type', 'prd', '--title', 'Test PRD', '--body', 'b', '--cwd', root], root);
    const { stdout } = await cli(['--json', 'list', '--cwd', root], root);
    const items = JSON.parse(stdout);
    expect(items.length).toBeGreaterThanOrEqual(1);
    expect(items.some((i: { slug: string }) => i.slug === 'test-prd')).toBe(true);
  });

  it('reads an artifact by id', async () => {
    const root = await setupProject();
    const { stdout: created } = await cli(
      ['--json', 'create', '--type', 'prd', '--title', 'ReadById', '--body', 'b', '--cwd', root],
      root,
    );
    const { id } = JSON.parse(created);

    const { stdout } = await cli(['--json', 'read', '--id', id, '--cwd', root], root);
    const result = JSON.parse(stdout);
    expect(result.frontmatter.id).toBe(id);
  });

  it('reads an artifact by type and slug', async () => {
    const root = await setupProject();
    await cli(
      ['--json', 'create', '--type', 'prd', '--title', 'Test PRD', '--body', 'b', '--cwd', root],
      root,
    );

    const { stdout } = await cli(
      ['--json', 'read', '--type', 'prd', '--slug', 'test-prd', '--cwd', root],
      root,
    );
    const result = JSON.parse(stdout);
    expect(result.frontmatter.slug).toBe('test-prd');
  });

  it('updates an artifact and bumps revision', async () => {
    const root = await setupProject();
    const { stdout: created } = await cli(
      ['--json', 'create', '--type', 'prd', '--title', 'RevTest', '--body', 'v1', '--cwd', root],
      root,
    );
    const { id } = JSON.parse(created);

    const { stdout } = await cli(
      ['--json', 'update', '--id', id, '--body', 'updated body', '--cwd', root],
      root,
    );
    const result = JSON.parse(stdout);
    expect(result.revision).toBe(2);
  });

  it('soft-deletes an artifact', async () => {
    const root = await setupProject();
    const { stdout: created } = await cli(
      ['--json', 'create', '--type', 'risk', '--title', 'DelMe', '--body', 'b', '--cwd', root],
      root,
    );
    const { id } = JSON.parse(created);

    const { stdout } = await cli(['--json', 'delete', '--id', id, '--cwd', root], root);
    const result = JSON.parse(stdout);
    expect(result.deletedAt).toBeTruthy();
  });

  it('includes deleted artifacts with --include-deleted', async () => {
    const root = await setupProject();
    const { stdout: created } = await cli(
      ['--json', 'create', '--type', 'risk', '--title', 'DelList', '--body', 'b', '--cwd', root],
      root,
    );
    const { id } = JSON.parse(created);
    await cli(['--json', 'delete', '--id', id, '--cwd', root], root);

    const { stdout } = await cli(['--json', 'list', '--include-deleted', '--cwd', root], root);
    const items = JSON.parse(stdout);
    expect(items.some((i: { id: string }) => i.id === id)).toBe(true);
  });

  it('returns markdown bundle via view', async () => {
    const root = await setupProject();
    await cli(
      ['--json', 'create', '--type', 'api', '--title', 'ViewAPI', '--body', 'spec', '--cwd', root],
      root,
    );

    const { stdout } = await cli(['view', '--cwd', root], root);
    expect(stdout).toContain('ViewAPI');
  });
});

describe('CLI JSON output', () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    for (const fn of cleanups.splice(0)) await fn();
  });

  it('returns valid JSON for create', async () => {
    const { root, cleanup } = await makeTempProject();
    cleanups.push(cleanup);
    await cli(['init', '--agents', 'claude', '--demo', 'false', '--cwd', root], root);

    const { stdout } = await cli(
      ['--json', 'create', '--type', 'api', '--title', 'Auth', '--body', 'spec', '--cwd', root],
      root,
    );
    const result = JSON.parse(stdout);
    expect(result.id).toBeTruthy();
    expect(result.type).toBe('api');
  });

  it('returns valid JSON array for list', async () => {
    const { root, cleanup } = await makeTempProject();
    cleanups.push(cleanup);
    await cli(['init', '--agents', 'claude', '--demo', 'false', '--cwd', root], root);
    await cli(['--json', 'create', '--type', 'api', '--title', 'Auth', '--body', 'spec', '--cwd', root], root);

    const { stdout } = await cli(['--json', 'list', '--cwd', root], root);
    const items = JSON.parse(stdout);
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThanOrEqual(1);
  });
});

describe('CLI error cases', () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    for (const fn of cleanups.splice(0)) await fn();
  });

  it('exits non-zero for unsupported artifact type', async () => {
    const { root, cleanup } = await makeTempProject();
    cleanups.push(cleanup);
    await cli(['init', '--agents', 'claude', '--demo', 'false', '--cwd', root], root);

    await expect(
      cli(['--json', 'create', '--type', 'badtype', '--title', 'X', '--cwd', root], root),
    ).rejects.toThrow();
  });

  it('exits non-zero for nonexistent id on read', async () => {
    const { root, cleanup } = await makeTempProject();
    cleanups.push(cleanup);
    await cli(['init', '--agents', 'claude', '--cwd', root], root);

    await expect(
      cli(['--json', 'read', '--id', 'nonexistent-id', '--cwd', root], root),
    ).rejects.toThrow();
  });

  it('exits non-zero for nonexistent id on update', async () => {
    const { root, cleanup } = await makeTempProject();
    cleanups.push(cleanup);
    await cli(['init', '--agents', 'claude', '--cwd', root], root);

    await expect(
      cli(['--json', 'update', '--id', 'nonexistent-id', '--body', 'x', '--cwd', root], root),
    ).rejects.toThrow();
  });
});

describe('CLI index rebuild', () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    for (const fn of cleanups.splice(0)) await fn();
  });

  it('rebuilds the index', async () => {
    const { root, cleanup } = await makeTempProject();
    cleanups.push(cleanup);
    await cli(['init', '--agents', 'claude', '--demo', 'false', '--cwd', root], root);
    await cli(['--json', 'create', '--type', 'prd', '--title', 'Rebuild', '--body', 'b', '--cwd', root], root);

    const { stdout } = await cli(['--json', 'index', 'rebuild', '--cwd', root], root);
    const report = JSON.parse(stdout);
    expect(report.indexedArtifacts).toBeGreaterThanOrEqual(1);
  });
});

describe('CLI commands metadata', () => {
  it('returns JSON with command list', async () => {
    const { stdout } = await cli(['commands'], PROJECT_ROOT);
    const result = JSON.parse(stdout);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].name).toBeTruthy();
  });
});

describe('CLI workflows command', () => {
  it('returns JSON with all workflow entries', async () => {
    const { stdout } = await cli(['workflows'], PROJECT_ROOT);
    const result = JSON.parse(stdout);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(8);
    const names = result.map((w: { name: string }) => w.name);
    expect(names).toContain('brainstorm-party');
    expect(names).toContain('review-adversarial');
    expect(names).toContain('review-edge-cases');
    expect(names).toContain('editorial-prose');
    expect(names).toContain('editorial-structure');
    expect(names).toContain('help');
    expect(names).toContain('brainstorm-deep');
    expect(names).toContain('elicit');
    for (const wf of result) {
      expect(wf.personas.length).toBeGreaterThanOrEqual(1);
      expect(wf.phases.length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('CLI commands regression with workflows', () => {
  it('includes workflows command in commands list', async () => {
    const { stdout } = await cli(['commands'], PROJECT_ROOT);
    const result = JSON.parse(stdout);
    const names = result.map((c: { name: string }) => c.name);
    expect(names).toContain('workflows');
    const prevCommands = ['init', 'create', 'read', 'update', 'delete', 'list', 'view', 'status', 'epics', 'tasks'];
    for (const cmd of prevCommands) {
      expect(names).toContain(cmd);
    }
  });
});
