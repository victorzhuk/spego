import { describe, it, expect, afterEach, vi } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { SpegoError } from '../src/errors.js';
import { resolveAdapter } from '../src/delivery/resolve.js';
import { assertWorkspace, discoverChanges, fetchCliStatus } from '../src/delivery/openspec-discover.js';
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

  describe('5.4 CLI status fallback', () => {
    it('fetchCliStatus returns null when CLI is unavailable', async () => {
      const result = await fetchCliStatus('/tmp', 'any-change');
      expect(result).toBeNull();
    });

    it('resolveEpicStatus includes warning when CLI is unavailable', async () => {
      const { root } = await setupChange('warn-test', {
        tasks: '- [x] a\n- [ ] b\n',
      });
      const adapter = createOpenSpecAdapter(root);
      const epics = await adapter.listEpics();
      expect(epics).toHaveLength(1);
      expect(epics[0]!.warnings).toContain('OpenSpec CLI status unavailable, using filesystem fallback');
    });

    it('resolveEpicStatus omits warning when CLI provides status', async () => {
      const mock = vi.spyOn(await import('../src/delivery/openspec-discover.js'), 'fetchCliStatus').mockResolvedValue({ taskCount: 3, tasksDone: 2 });
      try {
        const { root } = await setupChange('cli-ok', {
          tasks: '- [x] done\n',
        });
        const adapter = createOpenSpecAdapter(root);
        const epics = await adapter.listEpics();
        expect(epics).toHaveLength(1);
        expect(epics[0]!.taskCount).toBe(3);
        expect(epics[0]!.tasksDone).toBe(2);
        expect(epics[0]!.warnings).toBeUndefined();
      } finally {
        mock.mockRestore();
      }
    });
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
