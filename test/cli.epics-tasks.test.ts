import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnCli, setupInitialized, expectCliFailure } from './_cli-helpers.js';

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const fn of cleanups.splice(0)) await fn();
});

async function setupWithOpenSpec(): Promise<string> {
  const { root, cleanup } = await setupInitialized();
  cleanups.push(cleanup);
  await fs.mkdir(path.join(root, 'openspec'), { recursive: true });
  await fs.writeFile(path.join(root, 'openspec', 'config.yaml'), '', 'utf8');
  return root;
}

async function setupWithChange(changeName: string, tasksMd?: string): Promise<string> {
  const root = await setupWithOpenSpec();
  const changeDir = path.join(root, 'openspec', 'changes', changeName);
  await fs.mkdir(changeDir, { recursive: true });
  await fs.writeFile(
    path.join(changeDir, '.openspec.yaml'),
    'archived: false\nschemaVersion: 0.5\n',
    'utf8',
  );
  await fs.writeFile(path.join(changeDir, 'proposal.md'), `# ${changeName}\n`, 'utf8');
  if (tasksMd !== undefined) {
    await fs.writeFile(path.join(changeDir, 'tasks.md'), tasksMd, 'utf8');
  }
  return root;
}

describe('CLI epics command', () => {
  it('returns "No epics." under the section header for an OpenSpec workspace with no changes', async () => {
    const root = await setupWithOpenSpec();
    const { stdout } = await spawnCli(['epics', '--cwd', root], root);
    expect(stdout).toContain('📚 Epics (openspec)');
    expect(stdout).toContain('No epics.');
  });

  it('returns an empty JSON array when no changes exist', async () => {
    const root = await setupWithOpenSpec();
    const { stdout } = await spawnCli(['--json', 'epics', '--cwd', root], root);
    const result = JSON.parse(stdout);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  it('lists active epics in human mode with table headers', async () => {
    const root = await setupWithChange('demo-change', '- [x] one\n- [ ] two\n');
    const { stdout } = await spawnCli(['epics', '--cwd', root], root);
    expect(stdout).toContain('📚');
    expect(stdout).toContain('Epics');
    for (const col of ['id', 'status', 'progress', 'title']) {
      expect(stdout).toContain(col);
    }
    expect(stdout).toContain('demo-change');
  });

  it('returns one epic for a positional change name', async () => {
    const root = await setupWithChange('demo-change', '- [x] one\n- [ ] two\n');
    const { stdout } = await spawnCli(
      ['--json', 'epics', 'demo-change', '--cwd', root],
      root,
    );
    const epic = JSON.parse(stdout);
    expect(epic.externalId).toBe('demo-change');
    expect(epic.taskCount).toBe(2);
  });

  it("keeps 'epics list' as a listing alias", async () => {
    const root = await setupWithChange('demo-change', '- [x] one\n');
    const { stdout } = await spawnCli(['--json', 'epics', 'list', '--cwd', root], root);
    const epics = JSON.parse(stdout);
    expect(Array.isArray(epics)).toBe(true);
    expect(epics[0].externalId).toBe('demo-change');
  });

  it("rejects the stale 'get' action with a usage hint", async () => {
    const root = await setupWithOpenSpec();
    const err = await expectCliFailure(['--json', 'epics', 'get', '--cwd', root], root);
    const parsed = JSON.parse(err.stderr);
    expect(parsed.error.code).toBe('VALIDATION_FAILED');
    expect(parsed.error.details.usage).toBe('spego epics <name>');
  });

  it('rejects mutating action with DELIVERY_READ_ONLY', async () => {
    const root = await setupWithOpenSpec();
    const err = await expectCliFailure(['--json', 'epics', 'delete', '--cwd', root], root);
    const parsed = JSON.parse(err.stderr);
    expect(parsed.error.code).toBe('DELIVERY_READ_ONLY');
    expect(parsed.error.details).toBeTruthy();
    expect(parsed.error.details.attemptedAction).toBe('delete');
    expect(err.code).toBe(2);
  });
});

describe('CLI tasks command', () => {
  it('returns "No tasks for <name>." under the section header for a change without tasks', async () => {
    const root = await setupWithChange('empty-change');
    const { stdout } = await spawnCli(
      ['tasks', 'empty-change', '--cwd', root],
      root,
    );
    expect(stdout).toContain('✅ Tasks: empty-change (openspec)');
    expect(stdout).toContain('No tasks for empty-change.');
  });

  it('lists tasks in JSON mode', async () => {
    const root = await setupWithChange('demo-change', '- [x] alpha\n- [ ] beta\n');
    const { stdout } = await spawnCli(
      ['--json', 'tasks', 'demo-change', '--cwd', root],
      root,
    );
    const tasks = JSON.parse(stdout);
    expect(tasks).toHaveLength(2);
    expect(tasks[0].title).toBe('alpha');
    expect(tasks[0].status).toBe('done');
  });

  it('returns a single task for a positional task id', async () => {
    const root = await setupWithChange('demo-change', '- [x] alpha\n- [ ] beta\n');
    const { stdout } = await spawnCli(
      ['--json', 'tasks', 'demo-change', 'alpha', '--cwd', root],
      root,
    );
    const task = JSON.parse(stdout);
    expect(task.title).toBe('alpha');
    expect(task.status).toBe('done');
  });

  it('rejects mutating action with DELIVERY_READ_ONLY', async () => {
    const root = await setupWithChange('demo-change', '- [x] alpha\n');
    const err = await expectCliFailure(
      ['--json', 'tasks', 'create', 'demo-change', '--cwd', root],
      root,
    );
    const parsed = JSON.parse(err.stderr);
    expect(parsed.error.code).toBe('DELIVERY_READ_ONLY');
    expect(parsed.error.details.attemptedAction).toBe('create');
    expect(err.code).toBe(2);
  });

  it('fails with VALIDATION_FAILED when the change argument is missing', async () => {
    const root = await setupWithOpenSpec();
    const err = await expectCliFailure(['--json', 'tasks', '--cwd', root], root);
    const parsed = JSON.parse(err.stderr);
    expect(parsed.error.code).toBe('VALIDATION_FAILED');
    expect(typeof parsed.error.details).toBe('object');
    expect(err.code).toBe(2);
  });
});
