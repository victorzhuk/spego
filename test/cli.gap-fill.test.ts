import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnCli, setupInitialized, expectCliFailure } from './_cli-helpers.js';

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const fn of cleanups.splice(0)) await fn();
});

async function createArtifact(
  root: string,
  type: string,
  title: string,
  body: string,
): Promise<{ id: string; path: string }> {
  const { stdout } = await spawnCli(
    ['--json', 'create', '--type', type, '--title', title, '--body', body, '--cwd', root],
    root,
  );
  return JSON.parse(stdout);
}

describe('CLI read selectors', () => {
  it('reads an artifact by absolute --path', async () => {
    const { root, cleanup } = await setupInitialized();
    cleanups.push(cleanup);
    const created = await createArtifact(root, 'prd', 'Path Read', 'pbody');
    const { stdout } = await spawnCli(
      ['--json', 'read', '--path', created.path, '--cwd', root],
      root,
    );
    const result = JSON.parse(stdout);
    expect(result.frontmatter.id).toBe(created.id);
    expect(result.body.trim()).toBe('pbody');
  });

  it('reads a historical revision via --id --revision', async () => {
    const { root, cleanup } = await setupInitialized();
    cleanups.push(cleanup);
    const created = await createArtifact(root, 'prd', 'Rev Read', 'v1');
    await spawnCli(
      ['--json', 'update', '--id', created.id, '--body', 'v2', '--cwd', root],
      root,
    );
    const { stdout } = await spawnCli(
      ['--json', 'read', '--id', created.id, '--revision', '1', '--cwd', root],
      root,
    );
    const result = JSON.parse(stdout);
    expect(result.frontmatter.revision).toBe(1);
    expect(result.body.trim()).toBe('v1');
  }, 30_000);

  it('rejects read without any selector with VALIDATION_FAILED', async () => {
    const { root, cleanup } = await setupInitialized();
    cleanups.push(cleanup);
    const err = await expectCliFailure(['--json', 'read', '--cwd', root], root);
    const parsed = JSON.parse(err.stderr);
    expect(parsed.error.code).toBe('VALIDATION_FAILED');
    expect(typeof parsed.error.details).toBe('object');
    expect(err.code).toBe(2);
  });
});

describe('CLI update payload shape and concurrency', () => {
  it('returns frontmatter and body alongside id, revision, path', async () => {
    const { root, cleanup } = await setupInitialized();
    cleanups.push(cleanup);
    const created = await createArtifact(root, 'prd', 'Up Shape', 'b1');
    const { stdout } = await spawnCli(
      ['--json', 'update', '--id', created.id, '--body', 'b2', '--cwd', root],
      root,
    );
    const result = JSON.parse(stdout);
    expect(result.id).toBe(created.id);
    expect(result.revision).toBe(2);
    expect(result.path).toBe(created.path);
    expect(result.frontmatter.id).toBe(created.id);
    expect(result.body.trim()).toBe('b2');
  });

  it('accepts the matching --expected-revision', async () => {
    const { root, cleanup } = await setupInitialized();
    cleanups.push(cleanup);
    const created = await createArtifact(root, 'prd', 'Up OK', 'b1');
    const { stdout } = await spawnCli(
      [
        '--json',
        'update',
        '--id',
        created.id,
        '--body',
        'b2',
        '--expected-revision',
        '1',
        '--cwd',
        root,
      ],
      root,
    );
    const result = JSON.parse(stdout);
    expect(result.revision).toBe(2);
  });

  it('fails with REVISION_CONFLICT when --expected-revision is stale', async () => {
    const { root, cleanup } = await setupInitialized();
    cleanups.push(cleanup);
    const created = await createArtifact(root, 'prd', 'Up Stale', 'b1');
    await spawnCli(
      ['--json', 'update', '--id', created.id, '--body', 'b2', '--cwd', root],
      root,
    );
    const err = await expectCliFailure(
      [
        '--json',
        'update',
        '--id',
        created.id,
        '--body',
        'b3',
        '--expected-revision',
        '1',
        '--cwd',
        root,
      ],
      root,
    );
    const parsed = JSON.parse(err.stderr);
    expect(parsed.error.code).toBe('REVISION_CONFLICT');
    expect(parsed.error.details).toBeTruthy();
    expect(err.code).toBe(2);
  }, 30_000);
});

describe('CLI body input modes', () => {
  it('create reads body from --body-file <path>', async () => {
    const { root, cleanup } = await setupInitialized();
    cleanups.push(cleanup);
    const bodyPath = path.join(root, 'body.md');
    await fs.writeFile(bodyPath, 'file body content', 'utf8');
    const { stdout } = await spawnCli(
      [
        '--json',
        'create',
        '--type',
        'prd',
        '--title',
        'BodyFile',
        '--body-file',
        bodyPath,
        '--cwd',
        root,
      ],
      root,
    );
    const result = JSON.parse(stdout);
    const { stdout: read } = await spawnCli(
      ['--json', 'read', '--id', result.id, '--cwd', root],
      root,
    );
    const record = JSON.parse(read);
    expect(record.body.trim()).toBe('file body content');
  });

  it('update reads body from stdin when --body-file -', async () => {
    const { root, cleanup } = await setupInitialized();
    cleanups.push(cleanup);
    const created = await createArtifact(root, 'prd', 'Stdin Body', 'orig');
    await spawnCli(
      ['--json', 'update', '--id', created.id, '--body-file', '-', '--cwd', root],
      root,
      { input: 'piped body\n' },
    );
    const { stdout: read } = await spawnCli(
      ['--json', 'read', '--id', created.id, '--cwd', root],
      root,
    );
    const record = JSON.parse(read);
    expect(record.body.trim()).toBe('piped body');
  }, 30_000);
});

describe('CLI view filters', () => {
  it('returns a single artifact when filtered by --id', async () => {
    const { root, cleanup } = await setupInitialized();
    cleanups.push(cleanup);
    const a = await createArtifact(root, 'prd', 'V1', 'b1');
    await createArtifact(root, 'prd', 'V2', 'b2');
    const { stdout } = await spawnCli(
      ['--json', 'view', '--id', a.id, '--cwd', root],
      root,
    );
    const result = JSON.parse(stdout);
    expect(result.count).toBe(1);
    expect(result.artifacts[0].id).toBe(a.id);
  });

  it('returns a specific revision via --id --revision', async () => {
    const { root, cleanup } = await setupInitialized();
    cleanups.push(cleanup);
    const a = await createArtifact(root, 'prd', 'V Rev', 'v1');
    await spawnCli(['--json', 'update', '--id', a.id, '--body', 'v2', '--cwd', root], root);
    const { stdout } = await spawnCli(
      ['--json', 'view', '--id', a.id, '--revision', '1', '--cwd', root],
      root,
    );
    const result = JSON.parse(stdout);
    expect(result.count).toBe(1);
    expect(result.artifacts[0].revision).toBe(1);
  }, 30_000);

  it('honors --include-deleted', async () => {
    const { root, cleanup } = await setupInitialized();
    cleanups.push(cleanup);
    const a = await createArtifact(root, 'risk', 'D1', '');
    await createArtifact(root, 'risk', 'D2', '');
    await spawnCli(['--json', 'delete', '--id', a.id, '--cwd', root], root);

    const { stdout: visible } = await spawnCli(
      ['--json', 'view', '--type', 'risk', '--cwd', root],
      root,
    );
    expect(JSON.parse(visible).count).toBe(1);

    const { stdout: all } = await spawnCli(
      ['--json', 'view', '--type', 'risk', '--include-deleted', '--cwd', root],
      root,
    );
    expect(JSON.parse(all).count).toBe(2);
  }, 45_000);
});

describe('CLI status uninitialized JSON shape', () => {
  it('returns initialized:false with initCommand hint', async () => {
    const { makeTempProject } = await import('./helpers.js');
    const { root, cleanup } = await makeTempProject();
    cleanups.push(cleanup);
    const { stdout } = await spawnCli(['--json', 'status', '--cwd', root], root);
    const result = JSON.parse(stdout);
    expect(result.initialized).toBe(false);
    expect(result.initCommand).toBe('spego init');
  });
});

describe('CLI validation error envelope', () => {
  it('includes details object on commander argument errors', async () => {
    const err = await expectCliFailure(['--json', '--bogus-flag'], process.cwd());
    const parsed = JSON.parse(err.stderr);
    expect(parsed.error.code).toBe('VALIDATION_FAILED');
    expect(typeof parsed.error.details).toBe('object');
    expect(err.code).toBe(2);
  });

  it('includes details on SpegoError envelope', async () => {
    const { root, cleanup } = await setupInitialized();
    cleanups.push(cleanup);
    const err = await expectCliFailure(
      ['--json', 'read', '--id', 'no-such-id', '--cwd', root],
      root,
    );
    const parsed = JSON.parse(err.stderr);
    expect(parsed.error.code).toBe('ARTIFACT_NOT_FOUND');
    expect(typeof parsed.error.details).toBe('object');
  });
});

describe('CLI init --force', () => {
  it('runs --force without overwriting artifacts', async () => {
    const { root, cleanup } = await setupInitialized();
    cleanups.push(cleanup);
    const created = await createArtifact(root, 'prd', 'PreForce', 'b');
    const { stdout } = await spawnCli(
      ['--json', 'init', '--agents', 'claude', '--force', '--cwd', root],
      root,
    );
    const summary = JSON.parse(stdout);
    expect(summary.workspaceRoot).toBeTruthy();
    // The previously-created artifact should still be there.
    const { stdout: read } = await spawnCli(
      ['--json', 'read', '--id', created.id, '--cwd', root],
      root,
    );
    expect(JSON.parse(read).frontmatter.id).toBe(created.id);
  }, 30_000);
});

describe('CLI index rebuild header', () => {
  it('human output begins with the index rebuild header', async () => {
    const { root, cleanup } = await setupInitialized();
    cleanups.push(cleanup);
    await createArtifact(root, 'prd', 'IRH', 'b');
    const { stdout } = await spawnCli(['index', 'rebuild', '--cwd', root], root);
    expect(stdout).toMatch(/^📦\s+Index rebuild/);
    expect(stdout).toMatch(/╭─ Index rebuild/);
  });
});
