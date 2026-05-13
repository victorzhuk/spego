import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { makeTempProject } from './helpers.js';
import { ClaudeGenerator } from '../src/generator/claude.js';
import { WORKFLOW_REGISTRY, getWorkflowByName } from '../src/workflows/registry.js';

const NEW_WORKFLOWS = ['review-edge-cases', 'editorial-prose', 'editorial-structure'] as const;

describe('Review suite registry entries', () => {
  it('all three new entries exist in WORKFLOW_REGISTRY', () => {
    for (const name of NEW_WORKFLOWS) {
      expect(getWorkflowByName(name)).toBeDefined();
    }
  });

  it('each new entry has at least 4 phases including a final record phase', () => {
    for (const name of NEW_WORKFLOWS) {
      const wf = getWorkflowByName(name)!;
      expect(wf.phases.length).toBeGreaterThanOrEqual(4);
      expect(wf.phases[wf.phases.length - 1].name).toBe('record');
    }
  });

  it('each new entry declares artifactRef as required input', () => {
    for (const name of NEW_WORKFLOWS) {
      const wf = getWorkflowByName(name)!;
      const ref = wf.inputs.find((i) => i.name === 'artifactRef');
      expect(ref).toBeDefined();
      expect(ref!.required).toBe(true);
    }
  });

  it('each new entry declares qa as output artifact type', () => {
    for (const name of NEW_WORKFLOWS) {
      const wf = getWorkflowByName(name)!;
      const qa = wf.outputs.find((o) => o.artifactType === 'qa');
      expect(qa).toBeDefined();
    }
  });

  it('registry now has five entries total', () => {
    expect(WORKFLOW_REGISTRY).toHaveLength(5);
  });
});

describe('Review suite generated skill content', () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    for (const fn of cleanups.splice(0)) await fn();
  });

  it('review-edge-cases skill instructs to derive edge classes mechanically and write JSON findings', async () => {
    const { root, cleanup } = await makeTempProject();
    cleanups.push(cleanup);

    const gen = new ClaudeGenerator();
    await gen.generate(root);

    const skillPath = path.join(root, '.claude', 'skills', 'spego-review-edge-cases', 'SKILL.md');
    const content = await fs.readFile(skillPath, 'utf8');

    expect(content).toContain('derive-edge-classes');
    expect(content).toContain('off-by-one');
    expect(content).toContain('unguarded input');
    expect(content).toContain('race condition');
    expect(content).toContain('fenced json block');
    expect(content).toContain('location');
    expect(content).toContain('trigger_condition');
    expect(content).toContain('guard_snippet');
    expect(content).toContain('potential_consequence');
  });

  it('editorial-prose skill instructs to pass --expected-revision when updating', async () => {
    const { root, cleanup } = await makeTempProject();
    cleanups.push(cleanup);

    const gen = new ClaudeGenerator();
    await gen.generate(root);

    const skillPath = path.join(root, '.claude', 'skills', 'spego-editorial-prose', 'SKILL.md');
    const content = await fs.readFile(skillPath, 'utf8');

    expect(content).toContain('--expected-revision');
    expect(content).toContain('spego update');
    expect(content).toContain('Copy-editor');
  });

  it('editorial-structure skill explicitly states it does not mutate the source', async () => {
    const { root, cleanup } = await makeTempProject();
    cleanups.push(cleanup);

    const gen = new ClaudeGenerator();
    await gen.generate(root);

    const skillPath = path.join(root, '.claude', 'skills', 'spego-editorial-structure', 'SKILL.md');
    const content = await fs.readFile(skillPath, 'utf8');

    expect(content).toContain('does not mutate the source artifact');
    expect(content).toContain('does NOT mutate');
  });

  it('all three new skills have valid frontmatter and spego_generated marker', async () => {
    const { root, cleanup } = await makeTempProject();
    cleanups.push(cleanup);

    const gen = new ClaudeGenerator();
    await gen.generate(root);

    for (const name of NEW_WORKFLOWS) {
      const skillPath = path.join(root, '.claude', 'skills', `spego-${name}`, 'SKILL.md');
      const content = await fs.readFile(skillPath, 'utf8');

      expect(content.startsWith('---\n')).toBe(true);
      expect(content).toContain(`name: spego-${name}`);
      expect(content).toContain('spego_generated: true');
      expect(content).toContain('spego_version:');
      expect(content).toContain('## Safety');
    }
  });
});
