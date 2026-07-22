import { afterEach, describe, expect, it } from 'vitest';
import { ArtifactEngine } from '../src/artifacts/engine.js';
import { initWorkspace } from '../src/workspace/init.js';
import { makeTempProject } from './helpers.js';
import { spawnCli } from './_cli-helpers.js';
import type { CommandMeta } from '../src/command-meta/registry.js';

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const fn of cleanups.splice(0)) await fn();
});

async function setupProject(): Promise<string> {
  const { root, cleanup } = await makeTempProject();
  cleanups.push(cleanup);
  await initWorkspace({ projectRoot: root, agents: ['claude'] });
  return root;
}

async function createSprint(root: string, title: string, meta: Record<string, unknown>): Promise<void> {
  const engine = await ArtifactEngine.open({ projectRoot: root });
  try {
    await engine.create({ type: 'sprint-plan', title, body: '', meta });
  } finally {
    engine.close();
  }
}

describe('CLI sprints command', () => {
  it('lists sprint plans in board order with dated sprints first', async () => {
    const root = await setupProject();
    await createSprint(root, 'Undated backlog', { status: 'planned', changes: ['c-later'] });
    await createSprint(root, 'Sprint 2', { status: 'planned', startDate: '2026-02-01', changes: [] });
    await createSprint(root, 'Sprint 1', {
      status: 'active',
      startDate: '2026-01-01',
      endDate: '2026-01-14',
      changes: ['add-api', 'add-ui'],
    });

    const { stdout } = await spawnCli(['--json', 'sprints', '--cwd', root], root);
    const sprints = JSON.parse(stdout);
    expect(sprints.map((s: { slug: string }) => s.slug)).toEqual(['sprint-1', 'sprint-2', 'undated-backlog']);
    expect(sprints[0]).toMatchObject({
      slug: 'sprint-1',
      status: 'active',
      startDate: '2026-01-01',
      endDate: '2026-01-14',
      changes: ['add-api', 'add-ui'],
    });
  }, 30_000);

  it('renders a human table and an empty message', async () => {
    const root = await setupProject();
    const empty = await spawnCli(['sprints', '--cwd', root], root);
    expect(empty.stdout.trim()).toBe('No sprint plans.');

    await createSprint(root, 'Sprint 1', { status: 'active', startDate: '2026-01-01', changes: ['a', 'b'] });
    const { stdout } = await spawnCli(['sprints', '--cwd', root], root);
    expect(stdout).toContain('Sprints');
    expect(stdout).toContain('sprint-1');
    expect(stdout).toContain('active');
  }, 30_000);

  it('lists sprints in commands JSON metadata', async () => {
    const { stdout } = await spawnCli(['--json', 'commands']);
    const commands = JSON.parse(stdout) as CommandMeta[];
    expect(commands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'sprints', category: 'planning', slashName: '/spego:sprints' }),
      ]),
    );
  });
});
