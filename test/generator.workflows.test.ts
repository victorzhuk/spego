import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { makeTempProject } from './helpers.js';
import { ClaudeGenerator } from '../src/generator/claude.js';
import { WORKFLOW_REGISTRY } from '../src/workflows/registry.js';
import { COMMAND_REGISTRY } from '../src/commands/registry.js';

describe('Workflow skill generation', () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    for (const fn of cleanups.splice(0)) await fn();
  });

  it('creates SKILL.md for every registered workflow', async () => {
    const { root, cleanup } = await makeTempProject();
    cleanups.push(cleanup);

    const gen = new ClaudeGenerator();
    const report = await gen.generate(root);

    for (const wf of WORKFLOW_REGISTRY) {
      const skillPath = path.join(root, '.claude', 'skills', `spego-${wf.name}`, 'SKILL.md');
      const skillFile = report.files.find((f) => f.path === skillPath);
      expect(skillFile).toBeDefined();
      expect(skillFile!.action).toBe('created');

      const content = await fs.readFile(skillPath, 'utf8');
      expect(content.startsWith('---\n')).toBe(true);
      expect(content).toContain(`name: spego-${wf.name}`);
      expect(content).toContain('description:');
      expect(content).toContain('spego_generated: true');
      expect(content).toContain('spego_version:');
      expect(content).toContain('## Personas');
      expect(content).toContain('## Phases');
      expect(content).toContain('## Safety');
    }
  });

  it('workflow skills and command skills coexist without conflicts', async () => {
    const { root, cleanup } = await makeTempProject();
    cleanups.push(cleanup);

    const gen = new ClaudeGenerator();
    const report = await gen.generate(root);

    const allPaths = report.files.map((f) => f.path);

    expect(new Set(allPaths).size).toBe(allPaths.length);

    const commandSkillPaths = allPaths.filter((p) =>
      COMMAND_REGISTRY.some((c) => p.includes(`spego-${c.name}`))
    );
    const workflowSkillPaths = allPaths.filter((p) =>
      WORKFLOW_REGISTRY.some((w) => p.includes(`spego-${w.name}`))
    );

    expect(commandSkillPaths.length).toBeGreaterThan(0);
    expect(workflowSkillPaths.length).toBeGreaterThan(0);
  });

  it('workflow skills are included in the generation report', async () => {
    const { root, cleanup } = await makeTempProject();
    cleanups.push(cleanup);

    const gen = new ClaudeGenerator();
    const report = await gen.generate(root);

    const workflowFiles = report.files.filter((f) =>
      WORKFLOW_REGISTRY.some((w) => f.path.includes(`spego-${w.name}`))
    );
    expect(workflowFiles.length).toBe(WORKFLOW_REGISTRY.length);
  });

  it('workflow skills are idempotent on second generation', async () => {
    const { root, cleanup } = await makeTempProject();
    cleanups.push(cleanup);

    const gen = new ClaudeGenerator();
    await gen.generate(root);
    const report2 = await gen.generate(root);

    const workflowFiles = report2.files.filter((f) =>
      WORKFLOW_REGISTRY.some((w) => f.path.includes(`spego-${w.name}`))
    );
    for (const f of workflowFiles) {
      expect(f.action).toBe('unchanged');
    }
  });
});

describe('Workflow legacy flat-file cleanup', () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    for (const fn of cleanups.splice(0)) await fn();
  });

  it('removes legacy flat files for workflow skills', async () => {
    const { root, cleanup } = await makeTempProject();
    cleanups.push(cleanup);

    const skillsDir = path.join(root, '.claude', 'skills');
    await fs.mkdir(skillsDir, { recursive: true });

    const oldContent = '<!-- spego-generated v1 -->\n---\nname: spego-brainstorm-party\n---\n\nold flat skill';
    const oldPath = path.join(skillsDir, 'spego-brainstorm-party.md');
    await fs.writeFile(oldPath, oldContent, 'utf8');

    const oldContent2 = '<!-- spego-generated v1 -->\n---\nname: spego-review-adversarial\n---\n\nold flat skill';
    const oldPath2 = path.join(skillsDir, 'spego-review-adversarial.md');
    await fs.writeFile(oldPath2, oldContent2, 'utf8');

    const gen = new ClaudeGenerator();
    const report = await gen.generate(root);

    await expect(fs.access(oldPath)).rejects.toThrow();
    await expect(fs.access(oldPath2)).rejects.toThrow();

    expect(report.files.some((f) => f.action === 'cleaned' && f.path === oldPath)).toBe(true);
    expect(report.files.some((f) => f.action === 'cleaned' && f.path === oldPath2)).toBe(true);

    const newSkillPath = path.join(skillsDir, 'spego-brainstorm-party', 'SKILL.md');
    await expect(fs.stat(newSkillPath)).resolves.toBeTruthy();
    const newSkillPath2 = path.join(skillsDir, 'spego-review-adversarial', 'SKILL.md');
    await expect(fs.stat(newSkillPath2)).resolves.toBeTruthy();
  });
});
