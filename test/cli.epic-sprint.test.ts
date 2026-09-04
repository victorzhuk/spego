import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { expectCliFailure, setupInitialized, spawnCli } from './_cli-helpers.js';

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const fn of cleanups.splice(0)) await fn();
});

async function setupOpenSpecWorkspace(): Promise<string> {
  const { root, cleanup } = await setupInitialized();
  cleanups.push(cleanup);
  const openspecDir = path.join(root, 'openspec');
  await fs.mkdir(openspecDir, { recursive: true });
  await fs.writeFile(path.join(openspecDir, 'config.yaml'), '', 'utf8');
  return root;
}

async function setupChange(changeName: string, opts: { archived?: boolean } = {}): Promise<string> {
  const root = await setupOpenSpecWorkspace();
  const changeDir = path.join(root, 'openspec', 'changes', changeName);
  await fs.mkdir(changeDir, { recursive: true });
  const meta = opts.archived ? 'schema: spec-driven\narchived: true\n' : 'schema: spec-driven\n';
  await fs.writeFile(path.join(changeDir, '.openspec.yaml'), meta, 'utf8');
  await fs.writeFile(path.join(changeDir, 'proposal.md'), `# ${changeName}\n`, 'utf8');
  return root;
}

async function setupWithoutOpenSpec(): Promise<string> {
  const { root, cleanup } = await setupInitialized();
  cleanups.push(cleanup);
  return root;
}

function parseError(stderr: string): { error: { code: string; message: string; details: Record<string, unknown> } } {
  const start = stderr.lastIndexOf('\n{');
  const json = start === -1 ? stderr.slice(stderr.indexOf('{')) : stderr.slice(start + 1);
  if (!json.startsWith('{')) throw new Error(stderr);
  return JSON.parse(json) as {
    error: { code: string; message: string; details: Record<string, unknown> };
  };
}

describe('CLI epic mirror and sprint membership', () => {
  it('creates an epic for an active OpenSpec change', async () => {
    const root = await setupChange('add-auth');
    const { stdout } = await spawnCli(
      ['--json', 'create', '--type', 'epic', '--title', 'add-auth', '--cwd', root],
      root,
    );

    const result = JSON.parse(stdout);
    expect(result).toMatchObject({ slug: 'add-auth', type: 'epic', revision: 1 });
  });

  it('rejects an epic for an unknown OpenSpec change', async () => {
    const root = await setupOpenSpecWorkspace();
    const err = await expectCliFailure(
      ['--json', 'create', '--type', 'epic', '--title', 'add-auth', '--cwd', root],
      root,
    );

    const error = parseError(err.stderr);
    expect(error.error.code).toBe('VALIDATION_FAILED');
    expect(error.error.message).toContain('add-auth');
    expect(error.error.details).toMatchObject({ slug: 'add-auth' });
  });

  it('warns and creates an epic when OpenSpec workspace is absent', async () => {
    const root = await setupWithoutOpenSpec();
    const { stdout, stderr } = await spawnCli(
      ['--json', 'create', '--type', 'epic', '--title', 'add-auth', '--cwd', root],
      root,
    );

    const result = JSON.parse(stdout);
    expect(result).toMatchObject({ slug: 'add-auth', type: 'epic', revision: 1 });
    expect(stderr).toContain('add-auth');
    expect(stderr).toContain('not verified');
  });

  it('still updates an epic after the linked OpenSpec change is archived', async () => {
    const root = await setupChange('add-auth');
    const created = await spawnCli(
      ['--json', 'create', '--type', 'epic', '--title', 'add-auth', '--cwd', root],
      root,
    );
    const epic = JSON.parse(created.stdout) as { id: string; slug: string };
    await fs.writeFile(
      path.join(root, 'openspec', 'changes', 'add-auth', '.openspec.yaml'),
      'schema: spec-driven\narchived: true\n',
      'utf8',
    );

    const { stdout } = await spawnCli(
      [
        '--json',
        'update',
        '--id',
        epic.id,
        '--meta',
        JSON.stringify({ actuals: [{ flow: 'zapply', hours: 6.25 }] }),
        '--expected-revision',
        '1',
        '--cwd',
        root,
      ],
      root,
    );

    const updated = JSON.parse(stdout) as { revision: number; frontmatter: { slug: string; meta: { actuals: unknown } } };
    expect(updated.revision).toBe(2);
    expect(updated.frontmatter.slug).toBe(epic.slug);
    expect(updated.frontmatter.meta.actuals).toEqual([{ flow: 'zapply', hours: 6.25 }]);
  });

  it('updates an epic without re-verifying its change link when OpenSpec workspace is absent', async () => {
    const root = await setupWithoutOpenSpec();
    const created = await spawnCli(
      ['--json', 'create', '--type', 'epic', '--title', 'add-auth', '--cwd', root],
      root,
    );
    const epic = JSON.parse(created.stdout) as { id: string; slug: string };

    const { stdout, stderr } = await spawnCli(
      ['--json', 'update', '--id', epic.id, '--title', 'Add Auth Updated', '--cwd', root],
      root,
    );

    const result = JSON.parse(stdout);
    expect(result.frontmatter).toMatchObject({ slug: epic.slug, type: 'epic', revision: 2 });
    expect(stderr).not.toContain('not verified');
  });

  it('rejects duplicate active sprint-plan change membership', async () => {
    const root = await setupWithoutOpenSpec();
    await spawnCli(
      [
        '--json',
        'create',
        '--type',
        'sprint-plan',
        '--title',
        'S1',
        '--meta',
        JSON.stringify({ changes: ['add-auth'], status: 'active' }),
        '--cwd',
        root,
      ],
      root,
    );

    const err = await expectCliFailure(
      [
        '--json',
        'create',
        '--type',
        'sprint-plan',
        '--title',
        'S2',
        '--meta',
        JSON.stringify({ changes: ['add-auth'], status: 'planned' }),
        '--cwd',
        root,
      ],
      root,
    );

    const error = parseError(err.stderr);
    expect(error.error.code).toBe('VALIDATION_FAILED');
    expect(error.error.message).toContain('add-auth');
    expect(error.error.message).toContain('s1');
    expect(error.error.details).toMatchObject({ change: 'add-auth' });
  });

  it('keeps existing prd creation working', async () => {
    const root = await setupWithoutOpenSpec();
    const { stdout } = await spawnCli(
      ['--json', 'create', '--type', 'prd', '--title', 'Product Spec', '--cwd', root],
      root,
    );

    const result = JSON.parse(stdout);
    expect(result).toMatchObject({ slug: 'product-spec', type: 'prd', revision: 1 });
  });

  it('view overview reports an untouched change as backlog, not in-progress', async () => {
    const root = await setupChange('add-auth');
    await fs.writeFile(
      path.join(root, 'openspec', 'changes', 'add-auth', 'tasks.md'),
      '- [ ] 1.1 do the thing\n',
      'utf8',
    );
    await spawnCli(['--json', 'create', '--type', 'epic', '--title', 'add-auth', '--cwd', root], root);

    const { stdout } = await spawnCli(['view', '--cwd', root], root);
    expect(stdout).toMatch(/add-auth[^\n]*backlog/);
    expect(stdout).not.toMatch(/add-auth[^\n]*in-progress/);
  });

  it('view overview resolves epic status from the delivery mirror', async () => {
    const root = await setupChange('add-auth');
    await fs.writeFile(
      path.join(root, 'openspec', 'changes', 'add-auth', 'tasks.md'),
      '- [x] 1.1 do the thing\n- [ ] 1.2 do the other thing\n',
      'utf8',
    );
    await spawnCli(['--json', 'create', '--type', 'epic', '--title', 'add-auth', '--cwd', root], root);

    const { stdout } = await spawnCli(['view', '--cwd', root], root);
    expect(stdout).toMatch(/add-auth[^\n]*in-progress/);
  });

  it('view overview falls back to — when the workspace has no OpenSpec directory', async () => {
    const root = await setupWithoutOpenSpec();
    await spawnCli(['--json', 'create', '--type', 'epic', '--title', 'add-auth', '--cwd', root], root);

    const { stdout } = await spawnCli(['view', '--cwd', root], root);
    expect(stdout).toContain('📦 Artifact bundle');
    expect(stdout).toMatch(/add-auth[^\n]*—/);
  });

  it('allows duplicate sprint changes when the existing sprint is closed', async () => {
    const root = await setupWithoutOpenSpec();
    await spawnCli(
      [
        '--json',
        'create',
        '--type',
        'sprint-plan',
        '--title',
        'S1',
        '--meta',
        JSON.stringify({ changes: ['x'], status: 'closed' }),
        '--cwd',
        root,
      ],
      root,
    );

    const { stdout } = await spawnCli(
      [
        '--json',
        'create',
        '--type',
        'sprint-plan',
        '--title',
        'S2',
        '--meta',
        JSON.stringify({ changes: ['x'], status: 'active' }),
        '--cwd',
        root,
      ],
      root,
    );

    const result = JSON.parse(stdout);
    expect(result).toMatchObject({ slug: 's2', type: 'sprint-plan', revision: 1 });
  });
});
