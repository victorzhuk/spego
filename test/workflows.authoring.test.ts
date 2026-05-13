import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { makeTempProject } from './helpers.js';
import { ClaudeGenerator } from '../src/generator/claude.js';
import { WORKFLOW_REGISTRY, getWorkflowByName } from '../src/workflows/registry.js';

const PROJECT_ROOT = path.resolve(import.meta.dirname, '..');

const AUTHORING_WORKFLOWS = ['help', 'brainstorm-deep', 'elicit'] as const;

describe('Authoring workflow registry entries', () => {
  it('all three authoring entries exist in WORKFLOW_REGISTRY', () => {
    for (const name of AUTHORING_WORKFLOWS) {
      expect(getWorkflowByName(name)).toBeDefined();
    }
  });

  it('help declares no output artifact (all outputs have kind none)', () => {
    const wf = getWorkflowByName('help')!;
    expect(wf.outputs.length).toBeGreaterThan(0);
    expect(wf.outputs.every((o) => o.kind === 'none')).toBe(true);
  });

  it('elicit declares an update-kind output and the methods enumeration is non-empty', () => {
    const wf = getWorkflowByName('elicit')!;
    const updateOutput = wf.outputs.find((o) => o.kind === 'update');
    expect(updateOutput).toBeDefined();
    const methodsInput = wf.inputs.find((i) => i.name === 'methods');
    expect(methodsInput).toBeDefined();
    expect(methodsInput!.description).toContain('clarify');
    expect(methodsInput!.description).toContain('sharpen');
    expect(methodsInput!.description).toContain('stress-test');
  });

  it('registry now has eight entries total', () => {
    expect(WORKFLOW_REGISTRY).toHaveLength(8);
  });
});

describe('Authoring workflow generated skill content', () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    for (const fn of cleanups.splice(0)) await fn();
  });

  it('all three new skills have valid frontmatter and spego_generated marker', async () => {
    const { root, cleanup } = await makeTempProject();
    cleanups.push(cleanup);

    const gen = new ClaudeGenerator();
    await gen.generate(root);

    for (const name of AUTHORING_WORKFLOWS) {
      const skillPath = path.join(root, '.claude', 'skills', `spego-${name}`, 'SKILL.md');
      const content = await fs.readFile(skillPath, 'utf8');

      expect(content.startsWith('---\n')).toBe(true);
      expect(content).toContain(`name: spego-${name}`);
      expect(content).toContain('spego_generated: true');
      expect(content).toContain('spego_version:');
      expect(content).toContain('## Safety');
    }
  });

  it('spego-help skill references spego status, spego list, and spego epics', async () => {
    const { root, cleanup } = await makeTempProject();
    cleanups.push(cleanup);

    const gen = new ClaudeGenerator();
    await gen.generate(root);

    const skillPath = path.join(root, '.claude', 'skills', 'spego-help', 'SKILL.md');
    const content = await fs.readFile(skillPath, 'utf8');

    expect(content).toContain('spego status');
    expect(content).toContain('spego list');
    expect(content).toContain('spego epics');
  });

  it('spego-help rubric mentions every other workflow in WORKFLOW_REGISTRY', async () => {
    const { root, cleanup } = await makeTempProject();
    cleanups.push(cleanup);

    const gen = new ClaudeGenerator();
    await gen.generate(root);

    const skillPath = path.join(root, '.claude', 'skills', 'spego-help', 'SKILL.md');
    const content = await fs.readFile(skillPath, 'utf8');

    const otherWorkflows = WORKFLOW_REGISTRY.filter((w) => w.name !== 'help');
    for (const wf of otherWorkflows) {
      expect(content).toContain(`spego-${wf.name}`);
    }
  });

  it('spego-elicit skill mandates --expected-revision', async () => {
    const { root, cleanup } = await makeTempProject();
    cleanups.push(cleanup);

    const gen = new ClaudeGenerator();
    await gen.generate(root);

    const skillPath = path.join(root, '.claude', 'skills', 'spego-elicit', 'SKILL.md');
    const content = await fs.readFile(skillPath, 'utf8');

    expect(content).toContain('--expected-revision');
    const updateMatches = content.match(/spego update/g);
    expect(updateMatches).toBeTruthy();
    expect(content).toContain('MANDATORY');
    expect(content).toContain('5');
  });

  it('spego-brainstorm-deep skill contrasts with spego-brainstorm-party', async () => {
    const { root, cleanup } = await makeTempProject();
    cleanups.push(cleanup);

    const gen = new ClaudeGenerator();
    await gen.generate(root);

    const skillPath = path.join(root, '.claude', 'skills', 'spego-brainstorm-deep', 'SKILL.md');
    const content = await fs.readFile(skillPath, 'utf8');

    expect(content).toContain('spego-brainstorm-party');
  });

  it('spego workflows CLI lists at least 8 workflows', async () => {
    const { execSync } = await import('node:child_process');
    const result = execSync('npx tsx src/cli.ts workflows --json', {
      cwd: PROJECT_ROOT,
      encoding: 'utf8',
    });
    const jsonMatch = result.match(/\[[\s\S]*\]/);
    expect(jsonMatch).toBeTruthy();
    const workflows = JSON.parse(jsonMatch![0]);
    expect(workflows.length).toBeGreaterThanOrEqual(8);
  });
});
