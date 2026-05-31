import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { makeTempProject } from './helpers.js';
import { OpencodeGenerator } from '../src/generator/opencode.js';
import { generateAll, availableTargets } from '../src/generator/index.js';
import { writeGeneratedFile } from '../src/generator/write.js';

describe('OpenCode generation', () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    for (const fn of cleanups.splice(0)) await fn();
  });

  it('registers opencode as a generation target', () => {
    expect(availableTargets()).toContain('opencode');
  });

  it('creates static spego-prefixed OpenCode workflow commands', async () => {
    const { root, cleanup } = await makeTempProject();
    cleanups.push(cleanup);

    const gen = new OpencodeGenerator();
    const report = await gen.generate(root);

    for (const name of ['spego-apply', 'spego-verify', 'spego-explore']) {
      const filePath = path.join(root, '.opencode', 'commands', `${name}.md`);
      const file = report.files.find((f) => f.path === filePath);
      expect(file).toBeDefined();
      expect(file!.action).toBe('created');

      const content = await fs.readFile(filePath, 'utf8');
      expect(content).toContain('spego_generated: true');
      expect(content).not.toContain('model:');
      expect(content).not.toContain('agent:');
      expect(content).not.toContain('spego orchestrate');
      expect(content).not.toContain('opencode serve');
    }
  });

  it('is target-scoped through generateAll', async () => {
    const { root, cleanup } = await makeTempProject();
    cleanups.push(cleanup);

    const reports = await generateAll(root, ['opencode'], { emitWarnings: false });
    expect(reports.map((r) => r.target)).toEqual(['opencode']);
    await expect(fs.stat(path.join(root, '.opencode', 'commands', 'spego-apply.md'))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(root, '.claude'))).rejects.toThrow();
  });

  it('removes stale generated orchestration assets and preserves user files', async () => {
    const { root, cleanup } = await makeTempProject();
    cleanups.push(cleanup);

    const generatedOld = path.join(root, '.opencode', 'commands', 'orchestrate.md');
    await writeGeneratedFile(generatedOld, '---\nname: orchestrate\n---\n\nold');

    const userOld = path.join(root, '.opencode', 'agents', 'ultramanager.md');
    await fs.mkdir(path.dirname(userOld), { recursive: true });
    await fs.writeFile(userOld, '---\nmode: subagent\n---\n\ncustom', 'utf8');

    const gen = new OpencodeGenerator();
    const report = await gen.generate(root);

    expect(report.files).toContainEqual({ path: generatedOld, action: 'removed' });
    expect(report.files).toContainEqual({ path: userOld, action: 'skipped' });
    await expect(fs.access(generatedOld)).rejects.toThrow();
    await expect(fs.access(userOld)).resolves.toBeUndefined();
  });

  it('includes all 7 phases in SPEGO_APPLY content', async () => {
    const { root, cleanup } = await makeTempProject();
    cleanups.push(cleanup);

    const gen = new OpencodeGenerator();
    await gen.generate(root);

    const applyPath = path.join(root, '.opencode', 'commands', 'spego-apply.md');
    const content = await fs.readFile(applyPath, 'utf8');

    expect(content).toContain('Phase 1 — Select the change');
    expect(content).toContain('Phase 2 — Load context');
    expect(content).toContain('Phase 3 — Plan tasks');
    expect(content).toContain('Phase 4 — Execute work');
    expect(content).toContain('Phase 5 — Verify results');
    expect(content).toContain('Phase 6 — Update task checkboxes');
    expect(content).toContain('Phase 7 — Summarize status');
  });

  it('includes subagent guidance in SPEGO_APPLY content', async () => {
    const { root, cleanup } = await makeTempProject();
    cleanups.push(cleanup);

    const gen = new OpencodeGenerator();
    await gen.generate(root);

    const applyPath = path.join(root, '.opencode', 'commands', 'spego-apply.md');
    const content = await fs.readFile(applyPath, 'utf8');

    expect(content).toContain('current OpenCode session');
    expect(content).toContain('## Subagents');
  });

  it('excludes forbidden terms from all three commands', async () => {
    const { root, cleanup } = await makeTempProject();
    cleanups.push(cleanup);

    const gen = new OpencodeGenerator();
    await gen.generate(root);

    const commands = ['spego-apply', 'spego-verify', 'spego-explore'];
    const forbidden = [
      'AskUserQuestion tool',
      'TodoWrite tool',
      'subagent_type: "general-purpose"',
      'Skill tool',
      'spego orchestrate',
      'opencode serve',
      'OpenCode REST API',
    ];

    for (const name of commands) {
      const content = await fs.readFile(
        path.join(root, '.opencode', 'commands', `${name}.md`),
        'utf8',
      );
      for (const term of forbidden) {
        expect(content).not.toContain(term);
      }
    }
  });

  it('includes active OpenCode instance phrase in verify and explore', async () => {
    const { root, cleanup } = await makeTempProject();
    cleanups.push(cleanup);

    const gen = new OpencodeGenerator();
    await gen.generate(root);

    const verifyContent = await fs.readFile(
      path.join(root, '.opencode', 'commands', 'spego-verify.md'),
      'utf8',
    );
    expect(verifyContent).toContain('active OpenCode instance');

    const exploreContent = await fs.readFile(
      path.join(root, '.opencode', 'commands', 'spego-explore.md'),
      'utf8',
    );
    expect(exploreContent).toContain('active OpenCode instance');
  });

  it('removes stale generated opsx and openspec skill assets', async () => {
    const { root, cleanup } = await makeTempProject();
    cleanups.push(cleanup);

    const staleOpsx = path.join(root, '.opencode', 'commands', 'opsx-apply.md');
    await writeGeneratedFile(staleOpsx, '---\nname: opsx-apply\n---\n\nstale');

    const staleSkill = path.join(root, '.opencode', 'skills', 'openspec-new-change', 'SKILL.md');
    await writeGeneratedFile(staleSkill, '---\nname: openspec-new-change\n---\n\nstale');

    const staleWorkflow = path.join(root, '.opencode', 'commands', 'workflow.md');
    await writeGeneratedFile(staleWorkflow, '---\nname: workflow\n---\n\nstale');

    const gen = new OpencodeGenerator();
    const report = await gen.generate(root);

    expect(report.files).toContainEqual({ path: staleOpsx, action: 'removed' });
    expect(report.files).toContainEqual({ path: staleSkill, action: 'removed' });
    expect(report.files).toContainEqual({ path: staleWorkflow, action: 'removed' });
    await expect(fs.access(staleOpsx)).rejects.toThrow();
    await expect(fs.access(staleSkill)).rejects.toThrow();
    await expect(fs.access(staleWorkflow)).rejects.toThrow();
  });

  it('preserves user-owned opsx and openspec skill files', async () => {
    const { root, cleanup } = await makeTempProject();
    cleanups.push(cleanup);

    const userOpsx = path.join(root, '.opencode', 'commands', 'opsx-apply.md');
    await fs.mkdir(path.dirname(userOpsx), { recursive: true });
    await fs.writeFile(userOpsx, '---\nname: custom\n---\n\nuser content', 'utf8');

    const gen = new OpencodeGenerator();
    const report = await gen.generate(root);

    expect(report.files).toContainEqual({ path: userOpsx, action: 'skipped' });
    await expect(fs.access(userOpsx)).resolves.toBeUndefined();
    const content = await fs.readFile(userOpsx, 'utf8');
    expect(content).toContain('user content');
  });
});
