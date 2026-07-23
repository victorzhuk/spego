import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';
import fs from 'node:fs/promises';
import path from 'node:path';
import { SpegoError } from '../src/errors.js';
import { resolveAdapter } from '../src/delivery/resolve.js';
import { assertWorkspace, discoverChanges } from '../src/delivery/openspec-discover.js';
import { readProposalTitle, parseTasks } from '../src/delivery/openspec-parse.js';
import { createOpenSpecAdapter } from '../src/delivery/openspec-adapter.js';
import { defaultConfig } from '../src/workspace/config.js';
import { makeTempProject } from './helpers.js';

describe('delivery', () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    for (const fn of cleanups.splice(0)) await fn();
  });

  describe('5.1 adapter selection', () => {
    it('returns openspec adapter with default config', async () => {
      const { root, cleanup } = await makeTempProject();
      cleanups.push(cleanup);
      const adapter = resolveAdapter(root, defaultConfig());
      expect(adapter.name).toBe('openspec');
    });

    it('throws DELIVERY_ADAPTER_NOT_FOUND for unknown adapter', async () => {
      const { root, cleanup } = await makeTempProject();
      cleanups.push(cleanup);
      const cfg = defaultConfig();
      cfg.deliveryAdapter.name = 'unknown-adapter';
      expect(() => resolveAdapter(root, cfg)).toThrow(SpegoError);
      try {
        resolveAdapter(root, cfg);
      } catch (err) {
        expect(err).toBeInstanceOf(SpegoError);
        expect((err as SpegoError).code).toBe('DELIVERY_ADAPTER_NOT_FOUND');
      }
    });
  });

  describe('5.2 OpenSpec discovery', () => {
    it('assertWorkspace succeeds when config.yaml exists', async () => {
      const { root } = await setupOpenSpecWorkspace();
      await expect(assertWorkspace(root)).resolves.toBeUndefined();
    });

    it('assertWorkspace throws DELIVERY_ADAPTER_ERROR when no openspec dir', async () => {
      const { root, cleanup } = await makeTempProject();
      cleanups.push(cleanup);
      await expect(assertWorkspace(root)).rejects.toThrow(SpegoError);
      try {
        await assertWorkspace(root);
      } catch (err) {
        expect(err).toBeInstanceOf(SpegoError);
        expect((err as SpegoError).code).toBe('DELIVERY_ADAPTER_ERROR');
      }
    });

    it('discoverChanges returns changes with .openspec.yaml', async () => {
      const { root } = await setupChange('my-change');
      const changes = await discoverChanges(root);
      expect(changes).toHaveLength(1);
      expect(changes[0]!.name).toBe('my-change');
      expect(changes[0]!.archived).toBe(false);
    });

    it('discoverChanges skips directories without .openspec.yaml', async () => {
      const { root } = await setupOpenSpecWorkspace();
      await fs.mkdir(path.join(root, 'openspec', 'changes', 'no-meta'), { recursive: true });
      const changes = await discoverChanges(root);
      expect(changes).toHaveLength(0);
    });

    it('discoverChanges excludes archived changes', async () => {
      const { root } = await setupChange('archived-change', { archived: true });
      const changes = await discoverChanges(root);
      expect(changes).toHaveLength(1);
      expect(changes[0]!.archived).toBe(true);
    });

    it('discoverChanges recurses into archive/ and strips the date prefix from the slug', async () => {
      const { root } = await setupOpenSpecWorkspace();
      const archiveDir = path.join(root, 'openspec', 'changes', 'archive', '2026-01-15-my-archived-change');
      await fs.mkdir(archiveDir, { recursive: true });
      await fs.writeFile(path.join(archiveDir, '.openspec.yaml'), 'schema: spec-driven\ncreated: 2026-01-15\n', 'utf8');

      const changes = await discoverChanges(root);
      expect(changes).toHaveLength(1);
      expect(changes[0]!.name).toBe('my-archived-change');
      expect(changes[0]!.archived).toBe(true);
    });

    it('discoverChanges keeps the literal name for archive/ entries without a date prefix', async () => {
      const { root } = await setupOpenSpecWorkspace();
      const archiveDir = path.join(root, 'openspec', 'changes', 'archive', 'no-date-slug');
      await fs.mkdir(archiveDir, { recursive: true });
      await fs.writeFile(path.join(archiveDir, '.openspec.yaml'), 'schema: spec-driven\n', 'utf8');

      const changes = await discoverChanges(root);
      expect(changes).toHaveLength(1);
      expect(changes[0]!.name).toBe('no-date-slug');
      expect(changes[0]!.archived).toBe(true);
    });

    it('discoverChanges skips archive/ entries without .openspec.yaml', async () => {
      const { root } = await setupOpenSpecWorkspace();
      await fs.mkdir(path.join(root, 'openspec', 'changes', 'archive', '2026-01-01-no-meta'), { recursive: true });

      const changes = await discoverChanges(root);
      expect(changes).toHaveLength(0);
    });

    it('discoverChanges combines flat entries with archive/ entries', async () => {
      const { root } = await setupChange('active-change');
      const archiveDir = path.join(root, 'openspec', 'changes', 'archive', '2026-02-01-old-change');
      await fs.mkdir(archiveDir, { recursive: true });
      await fs.writeFile(path.join(archiveDir, '.openspec.yaml'), 'schema: spec-driven\n', 'utf8');

      const changes = await discoverChanges(root);
      expect(changes.map((c) => c.name).sort()).toEqual(['active-change', 'old-change']);
    });
  });

  describe('5.3 mapping and parsing', () => {
    it('readProposalTitle extracts heading from proposal.md', async () => {
      const { root, relPath } = await setupChange('title-test', {
        proposal: '# My Great Change\nSome details\n',
      });
      const title = await readProposalTitle(root, relPath);
      expect(title).toBe('My Great Change');
    });

    it('readProposalTitle falls back to folder name when no proposal.md', async () => {
      const { root, relPath } = await setupChange('fallback-name');
      const title = await readProposalTitle(root, relPath);
      expect(title).toBe('fallback-name');
    });

    it('readProposalTitle skips generic headings', async () => {
      const { root, relPath } = await setupChange('generic-test', {
        proposal: '# Why\nSome why text\n# What Changes\nMore text\n# Real Title\nDetails\n',
      });
      const title = await readProposalTitle(root, relPath);
      expect(title).toBe('Real Title');
    });

    it('parseTasks parses checked and unchecked items', async () => {
      const { root, relPath } = await setupChange('task-test', {
        tasks: '## Tasks\n- [x] 1.1 Done task\n- [ ] 1.2 Pending task\n',
      });
      const result = await parseTasks(root, relPath, 'task-test');
      expect(result.total).toBe(2);
      expect(result.done).toBe(1);
      expect(result.tasks).toHaveLength(2);
      expect(result.tasks[0]!.status).toBe('done');
      expect(result.tasks[1]!.status).toBe('pending');
    });

    it('parseTasks returns planning-incomplete when no tasks.md', async () => {
      const { root, relPath } = await setupChange('no-tasks');
      const result = await parseTasks(root, relPath, 'no-tasks');
      expect(result.status).toBe('planning-incomplete');
      expect(result.tasks).toHaveLength(0);
    });

    it('parseTasks counts done vs total correctly', async () => {
      const { root, relPath } = await setupChange('count-test', {
        tasks: '- [x] a\n- [x] b\n- [ ] c\n- [ ] d\n- [x] e\n',
      });
      const result = await parseTasks(root, relPath, 'count-test');
      expect(result.total).toBe(5);
      expect(result.done).toBe(3);
      expect(result.status).toBe('active');
    });

    it('full adapter listEpics returns epic for a change with tasks', async () => {
      const { root } = await setupChange('epic-test', {
        proposal: '# Epic Title\n',
        tasks: '- [x] 1.1 Done\n- [ ] 1.2 Todo\n',
      });
      const adapter = createOpenSpecAdapter(root);
      const epics = await adapter.listEpics();
      expect(epics).toHaveLength(1);
      expect(epics[0]!.title).toBe('Epic Title');
      expect(epics[0]!.taskCount).toBe(2);
      expect(epics[0]!.tasksDone).toBe(1);
      expect(epics[0]!.status).toBe('active');
    });

    it('full adapter listTasks returns tasks for a change', async () => {
      const { root } = await setupChange('lt-test', {
        tasks: '- [x] alpha\n- [ ] beta\n',
      });
      const adapter = createOpenSpecAdapter(root);
      const tasks = await adapter.listTasks('lt-test');
      expect(tasks).toHaveLength(2);
      expect(tasks[0]!.title).toBe('alpha');
      expect(tasks[0]!.status).toBe('done');
    });

    it('full adapter getEpic returns single epic', async () => {
      const { root } = await setupChange('single-epic', {
        proposal: '# Single\n',
        tasks: '- [x] done task\n',
      });
      const adapter = createOpenSpecAdapter(root);
      const epic = await adapter.getEpic('single-epic');
      expect(epic.externalId).toBe('single-epic');
      expect(epic.title).toBe('Single');
      expect(epic.taskCount).toBe(1);
      expect(epic.tasksDone).toBe(1);
      expect(epic.status).toBe('completed');
    });

    it('full adapter getTask returns specific task', async () => {
      const { root } = await setupChange('gt-test', {
        tasks: '- [x] find-me\n- [ ] other\n',
      });
      const adapter = createOpenSpecAdapter(root);
      const task = await adapter.getTask('gt-test', 'find-me');
      expect(task.title).toBe('find-me');
      expect(task.status).toBe('done');
    });

    it('full adapter getEpic throws for unknown change', async () => {
      const { root } = await setupOpenSpecWorkspace();
      const adapter = createOpenSpecAdapter(root);
      await expect(adapter.getEpic('nonexistent')).rejects.toThrow(SpegoError);
      try {
        await adapter.getEpic('nonexistent');
      } catch (err) {
        expect(err).toBeInstanceOf(SpegoError);
        expect((err as SpegoError).code).toBe('DELIVERY_ADAPTER_ERROR');
      }
    });
  });

  describe('5.4 filesystem-only status resolution', () => {
    it('uses no child_process execFile in listEpics, listTasks, and getEpic', async () => {
      const childProcess = createRequire(import.meta.url)('node:child_process');
      const execFileSpy = vi
        .spyOn(childProcess, 'execFile')
        .mockImplementation(() => {
          throw new Error('execFile should not be called in filesystem-only status path');
        });

      const originalPath = process.env.PATH ?? '';
      process.env.PATH = '/does-not-exist';

      const { root } = await setupOpenSpecWorkspace();
      await setupOpenSpecChange(
        root,
        'checked',
        { proposal: '# Checked\n', tasks: '- [x] done\n- [x] done\n' },
      );
      await setupOpenSpecChange(root, 'mixed', { proposal: '# Mixed\n', tasks: '- [x] done\n- [ ] todo\n' });
      await setupOpenSpecChange(root, 'no-tasks-change', { proposal: '# No tasks\n' });
      try {
        const adapter = createOpenSpecAdapter(root);

        const epics = await adapter.listEpics();
        const checkedEpic = epics.find((epic) => epic.externalId === 'checked');
        expect(epics).toHaveLength(3);
        expect(checkedEpic?.tasksDone).toBe(2);
        await adapter.listTasks('checked');
        const epic = await adapter.getEpic('mixed');
        expect(epic.externalId).toBe('mixed');
        expect(epic.status).toBe('active');

        expect(execFileSpy).toHaveBeenCalledTimes(0);
      } finally {
        execFileSpy.mockRestore();
        process.env.PATH = originalPath;
      }
    });


    it('maps tasks.md status semantics without CLI in PATH', async () => {
      const originalPath = process.env.PATH ?? '';
      process.env.PATH = '/does-not-exist';

      const { root } = await setupOpenSpecWorkspace();
      await setupOpenSpecChange(root, 'all-checked', {
        proposal: '# All Checked\n',
        tasks: '- [x] done one\n- [x] done two\n',
      });
      await setupOpenSpecChange(root, 'no-tasks', { proposal: '# No Tasks\n' });
      await setupOpenSpecChange(root, 'mixed', { proposal: '# Mixed\n', tasks: '- [x] done\n- [ ] todo\n' });

      const adapter = createOpenSpecAdapter(root);
      try {
        const epics = await adapter.listEpics();

        const statusById = new Map(epics.map((epic) => [epic.externalId, epic.status]));
        expect(statusById.get('all-checked')).toBe('completed');
        expect(statusById.get('no-tasks')).toBe('planning-incomplete');
        expect(statusById.get('mixed')).toBe('active');
      } finally {
        process.env.PATH = originalPath;
      }
    });

    it('resolves 20 changes in < 2s on filesystem status path', async () => {
      const { root } = await setupOpenSpecWorkspace();
      for (let i = 0; i < 20; i += 1) {
        await setupOpenSpecChange(root, `change-${i + 1}`, {
          proposal: `# Change ${i + 1}\n`,
          tasks: i % 2 === 0 ? '- [x] alpha\n- [ ] beta\n' : '- [ ] alpha\n',
        });
      }

      const adapter = createOpenSpecAdapter(root);
      const start = performance.now();
      const epics = await adapter.listEpics();
      const duration = performance.now() - start;

      expect(epics).toHaveLength(20);
      expect(duration).toBeLessThan(2000);
    });

    async function setupOpenSpecChange(
      root: string,
      name: string,
      opts: { proposal?: string; tasks?: string; archived?: boolean } = {},
    ) {
      const changeDir = path.join(root, 'openspec', 'changes', name);
      await fs.mkdir(changeDir, { recursive: true });

      const metaContent = opts.archived ? 'schema: spec-driven\narchived: true\n' : 'schema: spec-driven\n';
      await fs.writeFile(path.join(changeDir, '.openspec.yaml'), metaContent, 'utf8');

      if (opts.proposal !== undefined) {
        await fs.writeFile(path.join(changeDir, 'proposal.md'), opts.proposal, 'utf8');
      }

      if (opts.tasks !== undefined) {
        await fs.writeFile(path.join(changeDir, 'tasks.md'), opts.tasks, 'utf8');
      }
    }
  });



  describe('5.5 read-only rejection', () => {
    it('adapter has no mutation methods', () => {
      const adapter = createOpenSpecAdapter('/tmp');
      expect(typeof adapter.listEpics).toBe('function');
      expect(typeof adapter.getEpic).toBe('function');
      expect(typeof adapter.listTasks).toBe('function');
      expect(typeof adapter.getTask).toBe('function');
      expect((adapter as Record<string, unknown>).updateTask).toBeUndefined();
      expect((adapter as Record<string, unknown>).createTask).toBeUndefined();
    });
  });

  async function setupOpenSpecWorkspace() {
    const { root, cleanup } = await makeTempProject();
    cleanups.push(cleanup);
    const openspecDir = path.join(root, 'openspec');
    await fs.mkdir(openspecDir, { recursive: true });
    await fs.writeFile(path.join(openspecDir, 'config.yaml'), '', 'utf8');
    return { root, cleanup };
  }

  async function setupChange(
    name: string,
    opts: { proposal?: string; tasks?: string; archived?: boolean } = {},
  ) {
    const { root, cleanup } = await makeTempProject();
    cleanups.push(cleanup);

    const openspecDir = path.join(root, 'openspec');
    const changesDir = path.join(openspecDir, 'changes');
    const changeDir = path.join(changesDir, name);
    await fs.mkdir(changeDir, { recursive: true });

    await fs.writeFile(path.join(openspecDir, 'config.yaml'), '', 'utf8');

    const metaContent = opts.archived ? 'schema: spec-driven\narchived: true\n' : 'schema: spec-driven\n';
    await fs.writeFile(path.join(changeDir, '.openspec.yaml'), metaContent, 'utf8');

    if (opts.proposal !== undefined) {
      await fs.writeFile(path.join(changeDir, 'proposal.md'), opts.proposal, 'utf8');
    }
    if (opts.tasks !== undefined) {
      await fs.writeFile(path.join(changeDir, 'tasks.md'), opts.tasks, 'utf8');
    }

    const relPath = path.relative(root, changeDir);
    return { root, cleanup, relPath };
  }
});
