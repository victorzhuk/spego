import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { makeTempProject } from './helpers.js';
import { ClaudeGenerator } from '../src/generator/claude.js';
import { getWorkflowByName } from '../src/workflows/registry.js';

const COMBINED_WORKFLOWS = [
  'change-brainstorm',
  'change-review',
  'change-verify-report',
  'change-retro',
] as const;

describe('Combined OpenSpec workflow registry entries', () => {
  it('registers all combined OpenSpec workflows', () => {
    for (const name of COMBINED_WORKFLOWS) {
      expect(getWorkflowByName(name)).toBeDefined();
    }
  });

  it('uses OpenSpec change names as required input', () => {
    for (const name of COMBINED_WORKFLOWS) {
      const wf = getWorkflowByName(name)!;
      expect(wf.inputs.find((i) => i.name === 'changeName')?.required).toBe(true);
    }
  });

  it('declares the expected spego artifact outputs', () => {
    expect(getWorkflowByName('change-brainstorm')!.outputs).toContainEqual(
      expect.objectContaining({ artifactType: 'brainstorm', required: true }),
    );
    const reviewOutputs = getWorkflowByName('change-review')!.outputs.map((o) => o.artifactType);
    expect(reviewOutputs).toContain('qa');
    expect(reviewOutputs).toContain('risk');
    expect(getWorkflowByName('change-verify-report')!.outputs).toContainEqual(
      expect.objectContaining({ artifactType: 'qa', required: true }),
    );
    expect(getWorkflowByName('change-retro')!.outputs).toContainEqual(
      expect.objectContaining({ artifactType: 'retro', required: true }),
    );
  });

  it('keeps OpenSpec lifecycle mutations outside spego', () => {
    for (const name of COMBINED_WORKFLOWS) {
      const wf = getWorkflowByName(name)!;
      const safety = wf.safety.join('\n');
      expect(safety).toContain('Do not mutate OpenSpec lifecycle state through spego');
      expect(safety).toContain('OPSX/OpenSpec commands');
    }
  });
});

describe('Combined OpenSpec generated skill content', () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    for (const fn of cleanups.splice(0)) await fn();
  });

  it('renders OpenSpec context reads and spego persistence points', async () => {
    const { root, cleanup } = await makeTempProject();
    cleanups.push(cleanup);

    const gen = new ClaudeGenerator();
    await gen.generate(root);

    const brainstorm = await readWorkflowSkill(root, 'change-brainstorm');
    expect(brainstorm).toContain('spego epics --json');
    expect(brainstorm).toContain('spego --json tasks <changeName>');
    expect(brainstorm).toContain('proposal.md');
    expect(brainstorm).toContain('design.md');
    expect(brainstorm).toContain('tasks.md');
    expect(brainstorm).toContain('specs/**/*.md');
    expect(brainstorm).toContain('spego --json create --type brainstorm');
    expect(brainstorm).toContain('Do not mutate the OpenSpec change');

    const review = await readWorkflowSkill(root, 'change-review');
    expect(review).toContain('spego --json create --type qa');
    expect(review).toContain('spego --json create --type risk');
    expect(review).toContain('recommend the matching OPSX/OpenSpec action');

    const verify = await readWorkflowSkill(root, 'change-verify-report');
    expect(verify).toContain('OPSX/OpenSpec verification');
    expect(verify).toContain('spego --json create --type qa');
    expect(verify).toContain('Keep OpenSpec task completion and archive decisions in OpenSpec');

    const retro = await readWorkflowSkill(root, 'change-retro');
    expect(retro).toContain('openspec/changes/archive/');
    expect(retro).toContain('spego --json create --type retro');
    expect(retro).toContain('Include the OpenSpec change name as traceable context');
  });

  it('spego-help prioritizes active OpenSpec change workflows', async () => {
    const { root, cleanup } = await makeTempProject();
    cleanups.push(cleanup);

    const gen = new ClaudeGenerator();
    await gen.generate(root);

    const help = await readWorkflowSkill(root, 'help');
    expect(help).toContain('Active OpenSpec changes exist');
    expect(help).toContain('spego-change-brainstorm');
    expect(help).toContain('spego-change-review');
    expect(help).toContain('spego-change-verify-report');
    expect(help).toContain('spego-change-retro');
    expect(help).toContain('When no active OpenSpec changes exist');
  });
});

async function readWorkflowSkill(root: string, name: string): Promise<string> {
  const skillPath = path.join(root, '.claude', 'skills', `spego-${name}`, 'SKILL.md');
  return fs.readFile(skillPath, 'utf8');
}
