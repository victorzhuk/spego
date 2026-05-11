import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { makeTempProject } from './helpers.js';
import { ClaudeGenerator } from '../src/generator/claude.js';
import { writeGeneratedFile } from '../src/generator/write.js';
import { wrapWithMarker, isSpegoGenerated } from '../src/generator/markers.js';
import { COMMAND_REGISTRY, getCommandByName } from '../src/commands/registry.js';

describe('Claude skill generation', () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    for (const fn of cleanups.splice(0)) await fn();
  });

  it('creates a SKILL.md inside directory for every registered command', async () => {
    const { root, cleanup } = await makeTempProject();
    cleanups.push(cleanup);

    const gen = new ClaudeGenerator();
    const report = await gen.generate(root);

    for (const cmd of COMMAND_REGISTRY) {
      const skillPath = path.join(root, '.claude', 'skills', `spego-${cmd.name}`, 'SKILL.md');
      const skillFile = report.files.find((f) => f.path === skillPath);
      expect(skillFile).toBeDefined();
      expect(skillFile!.action).toBe('created');

      const content = await fs.readFile(skillPath, 'utf8');
      expect(content).toContain(`name: spego-${cmd.name}`);
      expect(content).toContain('description:');
      expect(content).toContain('spego_generated: true');
      expect(content).toContain('spego_version:');
      expect(content).toContain('## Usage');
      expect(content).toContain('## Options');
      expect(content).toContain('## Output');
      expect(content).toContain('## Safety');
    }
  });

  it('creates a slash command file for every registered command', async () => {
    const { root, cleanup } = await makeTempProject();
    cleanups.push(cleanup);

    const gen = new ClaudeGenerator();
    const report = await gen.generate(root);

    for (const cmd of COMMAND_REGISTRY) {
      const cmdPath = path.join(root, '.claude', 'commands', 'spego', `${cmd.name}.md`);
      const cmdFile = report.files.find((f) => f.path === cmdPath);
      expect(cmdFile).toBeDefined();
      expect(cmdFile!.action).toBe('created');

      const content = await fs.readFile(cmdPath, 'utf8');
      expect(content).toContain(`name: spego:${cmd.name}`);
      expect(content).toContain('$ARGUMENTS');
    }
  });

  it('report contains two files per command plus any cleanups', async () => {
    const { root, cleanup } = await makeTempProject();
    cleanups.push(cleanup);

    const gen = new ClaudeGenerator();
    const report = await gen.generate(root);

    expect(report.files.filter((f) => f.action !== 'cleaned').length).toBe(COMMAND_REGISTRY.length * 2);
    expect(report.target).toBe('claude');
    expect(report.version).toBe(1);
  });

  it('generates kebab-case CLI flags', async () => {
    const { root, cleanup } = await makeTempProject();
    cleanups.push(cleanup);

    const gen = new ClaudeGenerator();
    await gen.generate(root);

    const createSkill = path.join(root, '.claude', 'skills', 'spego-create', 'SKILL.md');
    const content = await fs.readFile(createSkill, 'utf8');
    expect(content).toContain('--body-file');
    expect(content).not.toContain('--bodyFile');
  });
});

describe('User file preservation', () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    for (const fn of cleanups.splice(0)) await fn();
  });

  it('skips files without spego-generated marker', async () => {
    const { root, cleanup } = await makeTempProject();
    cleanups.push(cleanup);

    const filePath = path.join(root, 'custom-skill.md');
    const userContent = 'my custom content that should not be touched';
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, userContent, 'utf8');

    const action = await writeGeneratedFile(filePath, '---\nname: test\n---\n\ngenerated content');
    expect(action).toBe('skipped');

    const onDisk = await fs.readFile(filePath, 'utf8');
    expect(onDisk).toBe(userContent);
  });

  it('overwrites files with spego-generated marker', async () => {
    const { root, cleanup } = await makeTempProject();
    cleanups.push(cleanup);

    const filePath = path.join(root, 'old-gen.md');
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    await writeGeneratedFile(filePath, '---\nname: test\n---\n\nold content');

    const action = await writeGeneratedFile(filePath, '---\nname: test\n---\n\nnew content');
    expect(action).toBe('updated');

    const onDisk = await fs.readFile(filePath, 'utf8');
    expect(onDisk).toContain('new content');
    expect(onDisk).not.toContain('old content');
  });

  it('overwrites files with legacy HTML comment marker', async () => {
    const { root, cleanup } = await makeTempProject();
    cleanups.push(cleanup);

    const filePath = path.join(root, 'legacy-cmd.md');
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    const legacyContent = '<!-- spego-generated v1 -->\n---\nname: spego:create\n---\n\nold content';
    await fs.writeFile(filePath, legacyContent, 'utf8');

    const action = await writeGeneratedFile(filePath, '---\nname: test\n---\n\nnew content');
    expect(action).toBe('updated');

    const onDisk = await fs.readFile(filePath, 'utf8');
    expect(onDisk).toContain('new content');
    expect(onDisk).toContain('spego_generated: true');
    expect(onDisk).not.toContain('<!-- spego-generated');
  });
});

describe('Deterministic regeneration', () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    for (const fn of cleanups.splice(0)) await fn();
  });

  it('produces identical output on second generation', async () => {
    const { root, cleanup } = await makeTempProject();
    cleanups.push(cleanup);

    const gen = new ClaudeGenerator();
    const report1 = await gen.generate(root);
    const report2 = await gen.generate(root);

    for (const f of report2.files) {
      if (f.action === 'cleaned') continue;
      expect(f.action).toBe('unchanged');
    }

    for (const f of report1.files) {
      if (f.action === 'cleaned') continue;
      const content1 = await fs.readFile(f.path, 'utf8');
      const match = report2.files.find((f2) => f2.path === f.path);
      const content2 = await fs.readFile(match!.path, 'utf8');
      expect(content1).toBe(content2);
    }
  });

  it('reports created on first generation', async () => {
    const { root, cleanup } = await makeTempProject();
    cleanups.push(cleanup);

    const gen = new ClaudeGenerator();
    const report = await gen.generate(root);

    for (const f of report.files) {
      expect(f.action).toBe('created');
    }
  });
});

describe('Legacy flat-file cleanup', () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    for (const fn of cleanups.splice(0)) await fn();
  });

  it('removes old flat spego skill files on regeneration', async () => {
    const { root, cleanup } = await makeTempProject();
    cleanups.push(cleanup);

    const skillsDir = path.join(root, '.claude', 'skills');
    await fs.mkdir(skillsDir, { recursive: true });

    const oldContent = '<!-- spego-generated v1 -->\n---\nname: spego-create\n---\n\nold flat skill';
    const oldPath = path.join(skillsDir, 'spego-create.md');
    await fs.writeFile(oldPath, oldContent, 'utf8');

    const gen = new ClaudeGenerator();
    const report = await gen.generate(root);

    await expect(fs.access(oldPath)).rejects.toThrow();

    expect(report.files.some((f) => f.action === 'cleaned' && f.path === oldPath)).toBe(true);

    const newSkillPath = path.join(skillsDir, 'spego-create', 'SKILL.md');
    await expect(fs.stat(newSkillPath)).resolves.toBeTruthy();
  });

  it('preserves non-spego flat files', async () => {
    const { root, cleanup } = await makeTempProject();
    cleanups.push(cleanup);

    const skillsDir = path.join(root, '.claude', 'skills');
    await fs.mkdir(skillsDir, { recursive: true });

    const userContent = '---\nname: my-custom-skill\n---\n\ncustom content';
    const userPath = path.join(skillsDir, 'spego-custom.md');
    await fs.writeFile(userPath, userContent, 'utf8');

    const gen = new ClaudeGenerator();
    await gen.generate(root);

    const onDisk = await fs.readFile(userPath, 'utf8');
    expect(onDisk).toBe(userContent);
  });
});

describe('Command registry metadata', () => {
  it('every command has required fields', () => {
    for (const cmd of COMMAND_REGISTRY) {
      expect(cmd.name).toBeTruthy();
      expect(cmd.description).toBeTruthy();
      expect(cmd.slashName).toBe(`/spego:${cmd.name}`);
      expect(cmd.category).toBeDefined();
      expect(cmd.outputModes.length).toBeGreaterThan(0);
    }
  });

  it('every input field has required properties', () => {
    for (const cmd of COMMAND_REGISTRY) {
      for (const [key, field] of Object.entries(cmd.inputSchema)) {
        expect(field.name).toBe(key);
        expect(['string', 'number', 'boolean', 'json']).toContain(field.type);
        expect(typeof field.required).toBe('boolean');
        expect(field.description).toBeTruthy();
      }
    }
  });

  it('getCommandByName finds existing commands', () => {
    expect(getCommandByName('create')).toBeDefined();
    expect(getCommandByName('nonexistent')).toBeUndefined();
  });

  it('tasks command has --change input', () => {
    const tasks = getCommandByName('tasks');
    expect(tasks).toBeDefined();
    expect(tasks!.inputSchema.change).toBeDefined();
    expect(tasks!.inputSchema.change.required).toBe(true);
  });
});

describe('wrapWithMarker', () => {
  it('throws when content lacks frontmatter', () => {
    expect(() => wrapWithMarker('no frontmatter here')).toThrow('YAML frontmatter');
  });

  it('injects marker into valid frontmatter', () => {
    const result = wrapWithMarker('---\nname: test\n---\n\nbody');
    expect(result).toContain('spego_generated: true');
    expect(result).toContain('spego_version:');
    expect(result.startsWith('---\n')).toBe(true);
  });
});

describe('isSpegoGenerated', () => {
  it('does not match marker text in body content', () => {
    const content = '---\nname: user-skill\n---\n\nThis mentions spego_generated: true in prose.';
    expect(isSpegoGenerated(content)).toBe(false);
  });

  it('matches marker inside frontmatter', () => {
    const content = '---\nspego_generated: true\nspego_version: 1\nname: test\n---\nbody';
    expect(isSpegoGenerated(content)).toBe(true);
  });

  it('rejects content without frontmatter', () => {
    expect(isSpegoGenerated('just some text')).toBe(false);
  });
});
