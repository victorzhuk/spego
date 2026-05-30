import { describe, it, expect } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { makeTempProject } from './helpers.js';
import { initWorkspace } from '../src/workspace/init.js';
import { buildDependencyTiers } from '../src/orchestration/tiers.js';
import { parseBreakdown, stripJsonFences } from '../src/orchestration/schema.js';
import { detectFileGateViolations, enforceFileGate } from '../src/orchestration/file-gate.js';
import { runSwarm } from '../src/orchestration/scheduler.js';
import { resolveOrchestrationConfig } from '../src/orchestration/config.js';
import { orchestrateChange } from '../src/orchestration/engine.js';
import { defaultConfig } from '../src/workspace/config.js';
import type { SubTask, SubtaskResult } from '../src/orchestration/types.js';
import type { OpenCodeApi, SendMessageInput } from '../src/orchestration/client.js';

function task(id: string, dependsOn: string[] = [], priority = 0): SubTask {
  return {
    id,
    title: id,
    description: '',
    files: [`${id}.ts`],
    acceptanceCriteria: [],
    dependsOn,
    priority,
  };
}

describe('buildDependencyTiers', () => {
  it('groups independent tasks into a single tier', () => {
    const { tiers, hadCycle } = buildDependencyTiers([task('a'), task('b'), task('c')]);
    expect(hadCycle).toBe(false);
    expect(tiers).toHaveLength(1);
    expect(tiers[0]!.map((t) => t.id).sort()).toEqual(['a', 'b', 'c']);
  });

  it('orders dependent tasks into successive tiers', () => {
    const { tiers } = buildDependencyTiers([task('a'), task('b', ['a']), task('c', ['b'])]);
    expect(tiers.map((t) => t.map((x) => x.id))).toEqual([['a'], ['b'], ['c']]);
  });

  it('falls back to sequential single-task tiers on a cycle', () => {
    const { tiers, hadCycle } = buildDependencyTiers([task('a', ['b']), task('b', ['a'])]);
    expect(hadCycle).toBe(true);
    expect(tiers.every((t) => t.length === 1)).toBe(true);
    expect(tiers).toHaveLength(2);
  });
});

describe('parseBreakdown', () => {
  const valid = JSON.stringify({
    goal: 'Do the thing',
    context_summary: 'ctx',
    execution_mode: 'adaptive',
    test_command: 'npm test',
    language: 'typescript',
    subtasks: [
      { id: 'one', title: 'T1', description: 'd', files: ['a.ts'], acceptance_criteria: ['x'], depends_on: [], priority: 0 },
    ],
  });

  it('parses a valid snake_case breakdown into the camelCase model', () => {
    const b = parseBreakdown(valid);
    expect(b.goal).toBe('Do the thing');
    expect(b.executionMode).toBe('adaptive');
    expect(b.subtasks[0]!.acceptanceCriteria).toEqual(['x']);
    expect(b.subtasks[0]!.dependsOn).toEqual([]);
  });

  it('strips a json code fence before parsing', () => {
    const fenced = '```json\n' + valid + '\n```';
    expect(stripJsonFences(fenced)).toBe(valid);
    expect(parseBreakdown(fenced).goal).toBe('Do the thing');
  });

  it('throws on non-JSON output', () => {
    expect(() => parseBreakdown('not json at all')).toThrow();
  });

  it('throws when required fields are missing', () => {
    expect(() => parseBreakdown(JSON.stringify({ goal: 'x', subtasks: [] }))).toThrow();
  });
});

describe('file gate', () => {
  it('detects paths outside the allow-list', () => {
    const violations = detectFileGateViolations(['./src/a.ts', 'src/b.ts'], ['src/a.ts']);
    expect(violations).toEqual(['src/b.ts']);
  });

  it('reverts each violation via the injected callback', async () => {
    const reverted: string[] = [];
    const { violations } = await enforceFileGate({
      changedPaths: ['src/a.ts', 'secret.env'],
      allowed: ['src/a.ts'],
      revert: (p) => {
        reverted.push(p);
      },
    });
    expect(violations).toEqual(['secret.env']);
    expect(reverted).toEqual(['secret.env']);
  });
});

describe('runSwarm', () => {
  it('runs adaptive tiers sequentially with bounded parallelism', async () => {
    const order: string[] = [];
    let active = 0;
    let peak = 0;
    const runTask = async (t: SubTask): Promise<SubtaskResult> => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      order.push(t.id);
      return { subtaskId: t.id, sessionId: 's', success: true, summary: '', changedFiles: [], gateViolations: [] };
    };
    const breakdown = {
      goal: 'g', contextSummary: '', executionMode: 'adaptive' as const, testCommand: 'x', language: 'ts',
      subtasks: [task('a'), task('b'), task('c', ['a', 'b'])],
    };
    const { results } = await runSwarm(breakdown, { maxParallel: 2, runTask });
    expect(results).toHaveLength(3);
    expect(peak).toBeLessThanOrEqual(2);
    expect(order[order.length - 1]).toBe('c');
  });
});

describe('resolveOrchestrationConfig', () => {
  it('reads from config and applies env overrides', () => {
    const cfg = defaultConfig();
    const rc = resolveOrchestrationConfig(cfg, {
      SPEGO_ORCHESTRATION_MODEL_MANAGER: 'prov/manager',
      SPEGO_ORCHESTRATION_SERVER_URL: 'http://example:9999',
      SPEGO_ORCHESTRATION_MAX_PARALLEL: '8',
    });
    expect(rc.serverUrl).toBe('http://example:9999');
    expect(rc.models.manager).toBe('prov/manager');
    expect(rc.maxParallel).toBe(8);
    expect(rc.models.worker).toBe('');
  });
});

describe('orchestrateChange (fake backend)', () => {
  async function setupChange(): Promise<{ root: string; cleanup: () => Promise<void> }> {
    const project = await makeTempProject();
    await initWorkspace({ projectRoot: project.root, agents: ['claude'] });
    const changeDir = path.join(project.root, 'openspec', 'changes', 'demo');
    await fs.mkdir(changeDir, { recursive: true });
    await fs.writeFile(path.join(project.root, 'openspec', 'config.yaml'), 'schema: spec-driven\n', 'utf8');
    await fs.writeFile(path.join(changeDir, '.openspec.yaml'), 'schema: spec-driven\n', 'utf8');
    await fs.writeFile(path.join(changeDir, 'proposal.md'), '## Why\nBecause.\n', 'utf8');
    await fs.writeFile(path.join(changeDir, 'tasks.md'), '## 1. Work\n- [ ] 1.1 Do it\n', 'utf8');
    return project;
  }

  const fakeClient = (): OpenCodeApi => {
    let counter = 0;
    return {
      health: async () => ({ version: 'fake' }),
      createSession: async () => ({ id: `session-${counter++}` }),
      sendMessage: async (_id: string, input: SendMessageInput) => {
        if (input.system?.includes('UltraManager')) {
          return {
            parts: [
              {
                type: 'text',
                text: JSON.stringify({
                  goal: 'Implement demo',
                  context_summary: 'ctx',
                  execution_mode: 'sequential',
                  test_command: 'npm test',
                  language: 'typescript',
                  subtasks: [
                    { id: 'one', title: 'One', description: 'd', files: ['a.ts'], acceptance_criteria: ['x'], depends_on: [], priority: 0 },
                  ],
                }),
              },
            ],
          };
        }
        if (input.system?.includes('UltraVerifier')) {
          return {
            parts: [{ type: 'text', text: JSON.stringify({ passed: true, test_output: 'ok', failing_criteria: [], regressions: [], notes: '' }) }],
          };
        }
        return { parts: [{ type: 'text', text: 'done\nULTRAWORKER_STATUS: SUCCESS' }] };
      },
      getSessionDiff: async () => [{ path: 'a.ts' }],
      deleteSession: async () => undefined,
    };
  };

  it('runs the pipeline and emits a passing verdict', async () => {
    const { root, cleanup } = await setupChange();
    try {
      const outcome = await orchestrateChange({
        projectRoot: root,
        changeName: 'demo',
        client: fakeClient(),
        env: { SPEGO_ORCHESTRATION_MODEL_MANAGER: 'm', SPEGO_ORCHESTRATION_MODEL_WORKER: 'w', SPEGO_ORCHESTRATION_MODEL_VERIFIER: 'v' },
      });
      expect(outcome.verdict.passed).toBe(true);
      expect(outcome.tasksSucceeded).toBe(1);
      expect(outcome.tasksTotal).toBe(1);
      const breakdown = await fs.readFile(path.join(root, '.spego', 'orchestration', 'demo', 'breakdown.json'), 'utf8');
      expect(breakdown).toContain('Implement demo');
      const verdict = await fs.readFile(path.join(root, '.spego', 'orchestration', 'demo', 'verdict.json'), 'utf8');
      expect(JSON.parse(verdict).passed).toBe(true);
    } finally {
      await cleanup();
    }
  });

  it('rejects an unknown change with CHANGE_NOT_FOUND', async () => {
    const { root, cleanup } = await setupChange();
    try {
      await expect(
        orchestrateChange({ projectRoot: root, changeName: 'nope', client: fakeClient() }),
      ).rejects.toMatchObject({ code: 'CHANGE_NOT_FOUND' });
    } finally {
      await cleanup();
    }
  });
});
