import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
import { makeTempProject } from './helpers.js';
import { AgentsGenerator } from '../src/generator/agents.js';
import { writeGeneratedFile } from '../src/generator/write.js';
import { wrapWithMarker, isSpegoGenerated } from '../src/generator/markers.js';
import { COMMAND_REGISTRY, getCommandByName } from '../src/command-meta/registry.js';
import { WORKFLOW_REGISTRY } from '../src/workflows/registry.js';

const MARKED = '---\nspego_generated: true\nspego_version: 1\nname: test\n---\nTest';

describe('Agents skill generation', () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    for (const fn of cleanups.splice(0)) await fn();
  });

  it('creates a SKILL.md inside .agents/skills for every registered command', async () => {
    const { root, cleanup } = await makeTempProject();
    cleanups.push(cleanup);

    const gen = new AgentsGenerator();
    const report = await gen.generate(root);

    for (const cmd of COMMAND_REGISTRY) {
      const skillPath = path.join(root, '.agents', 'skills', `spego-${cmd.name}`, 'SKILL.md');
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

  it('emits parseable frontmatter that keeps the full description', async () => {
    const { root, cleanup } = await makeTempProject();
    cleanups.push(cleanup);

    await new AgentsGenerator().generate(root);

    const parseFrontmatter = async (file: string) => {
      const content = await fs.readFile(file, 'utf8');
      return YAML.parse(content.slice(4, content.indexOf('\n---', 4)));
    };
    for (const cmd of COMMAND_REGISTRY) {
      const skill = await parseFrontmatter(path.join(root, '.agents', 'skills', `spego-${cmd.name}`, 'SKILL.md'));
      expect(skill.description).toContain(`${cmd.description}. Use when`);
    }
    for (const wf of WORKFLOW_REGISTRY) {
      const skill = await parseFrontmatter(path.join(root, '.agents', 'skills', `spego-${wf.name}`, 'SKILL.md'));
      expect(skill.description).toBe(wf.description);
    }
  });

  it('generates no .claude files', async () => {
    const { root, cleanup } = await makeTempProject();
    cleanups.push(cleanup);

    const report = await new AgentsGenerator().generate(root);

    expect(report.files.some((f) => f.path.includes('.claude'))).toBe(false);
    await expect(fs.stat(path.join(root, '.claude'))).rejects.toThrow();
  });

  it('report contains one file per command and workflow', async () => {
    const { root, cleanup } = await makeTempProject();
    cleanups.push(cleanup);

    const gen = new AgentsGenerator();
    const report = await gen.generate(root);

    const skillFiles = COMMAND_REGISTRY.length + WORKFLOW_REGISTRY.length;
    expect(report.files.filter((f) => f.action !== 'removed').length).toBe(skillFiles);
    expect(report.target).toBe('agents');
    expect(report.version).toBe(1);
  });

  it('generates kebab-case CLI flags', async () => {
    const { root, cleanup } = await makeTempProject();
    cleanups.push(cleanup);

    const gen = new AgentsGenerator();
    await gen.generate(root);

    const createSkill = path.join(root, '.agents', 'skills', 'spego-create', 'SKILL.md');
    const content = await fs.readFile(createSkill, 'utf8');
    expect(content).toContain('--body-file');
    expect(content).not.toContain('--bodyFile');
  });

  it('create and update skills document the per-type --meta shape', async () => {
    const { root, cleanup } = await makeTempProject();
    cleanups.push(cleanup);

    const gen = new AgentsGenerator();
    await gen.generate(root);

    for (const name of ['create', 'update']) {
      const content = await fs.readFile(
        path.join(root, '.agents', 'skills', `spego-${name}`, 'SKILL.md'),
        'utf8',
      );
      expect(content).toContain('## Metadata Shape by Type');
      expect(content).toContain('`epic`:');
      expect(content).toContain('deps[]');
      expect(content).toContain('`sprint-plan`:');
      expect(content).toContain('changes[]');
    }
  });

  it('read, list, and delete skills document the valid artifact type list without a meta shape section', async () => {
    const { root, cleanup } = await makeTempProject();
    cleanups.push(cleanup);

    const gen = new AgentsGenerator();
    await gen.generate(root);

    for (const name of ['read', 'list', 'delete']) {
      const content = await fs.readFile(
        path.join(root, '.agents', 'skills', `spego-${name}`, 'SKILL.md'),
        'utf8',
      );
      expect(content).toContain('Artifact types:');
      expect(content).toContain('sprint-plan');
      expect(content).not.toContain('## Metadata Shape by Type');
    }
  });
});

describe('Legacy .claude migration', () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    for (const fn of cleanups.splice(0)) await fn();
  });

  it('removes generated .claude skills and slash commands when regenerating', async () => {
    const { root, cleanup } = await makeTempProject();
    cleanups.push(cleanup);

    const legacySkillDir = path.join(root, '.claude', 'skills', 'spego-create');
    const legacySkillPath = path.join(legacySkillDir, 'SKILL.md');
    await fs.mkdir(legacySkillDir, { recursive: true });
    await fs.writeFile(legacySkillPath, MARKED, 'utf8');

    const legacyCmdDir = path.join(root, '.claude', 'commands', 'spego');
    const legacyCmdPath = path.join(legacyCmdDir, 'create.md');
    await fs.mkdir(legacyCmdDir, { recursive: true });
    await fs.writeFile(legacyCmdPath, MARKED, 'utf8');

    const report = await new AgentsGenerator().generate(root);

    await expect(fs.access(legacySkillPath)).rejects.toThrow();
    await expect(fs.access(legacySkillDir)).rejects.toThrow();
    await expect(fs.access(legacyCmdPath)).rejects.toThrow();
    expect(report.files.some((f) => f.action === 'removed' && f.path === legacySkillPath)).toBe(true);
    expect(report.files.some((f) => f.action === 'removed' && f.path === legacyCmdPath)).toBe(true);

    const newSkillPath = path.join(root, '.agents', 'skills', 'spego-create', 'SKILL.md');
    await expect(fs.stat(newSkillPath)).resolves.toBeTruthy();
  });

  it('preserves user-owned .claude skills without the marker', async () => {
    const { root, cleanup } = await makeTempProject();
    cleanups.push(cleanup);

    const userSkillDir = path.join(root, '.claude', 'skills', 'spego-create');
    const userSkillPath = path.join(userSkillDir, 'SKILL.md');
    await fs.mkdir(userSkillDir, { recursive: true });
    const userContent = '---\nname: spego-create\n---\nUser-owned content';
    await fs.writeFile(userSkillPath, userContent, 'utf8');

    await new AgentsGenerator().generate(root);

    const onDisk = await fs.readFile(userSkillPath, 'utf8');
    expect(onDisk).toBe(userContent);
  });

  it('removes stale .agents skills the registry no longer names', async () => {
    const { root, cleanup } = await makeTempProject();
    cleanups.push(cleanup);

    const staleDir = path.join(root, '.agents', 'skills', 'spego-orchestrate');
    const stalePath = path.join(staleDir, 'SKILL.md');
    await fs.mkdir(staleDir, { recursive: true });
    await fs.writeFile(stalePath, MARKED, 'utf8');

    const report = await new AgentsGenerator().generate(root);

    await expect(fs.access(stalePath)).rejects.toThrow();
    await expect(fs.access(staleDir)).rejects.toThrow();
    expect(report.files.some((f) => f.action === 'removed' && f.path === stalePath)).toBe(true);
  });

  it('keeps user-owned .agents skills the registry does not name', async () => {
    const { root, cleanup } = await makeTempProject();
    cleanups.push(cleanup);

    const userDir = path.join(root, '.agents', 'skills', 'spego-custom');
    const userPath = path.join(userDir, 'SKILL.md');
    await fs.mkdir(userDir, { recursive: true });
    const userContent = '---\nname: spego-custom\n---\nUser-owned content';
    await fs.writeFile(userPath, userContent, 'utf8');

    const report = await new AgentsGenerator().generate(root);

    const onDisk = await fs.readFile(userPath, 'utf8');
    expect(onDisk).toBe(userContent);
    expect(report.files.some((f) => f.action === 'skipped' && f.path === userPath)).toBe(true);
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

    const gen = new AgentsGenerator();
    const report1 = await gen.generate(root);
    const report2 = await gen.generate(root);

    for (const f of report2.files) {
      if (f.action === 'removed') continue;
      expect(f.action).toBe('unchanged');
    }

    for (const f of report1.files) {
      if (f.action === 'removed') continue;
      const content1 = await fs.readFile(f.path, 'utf8');
      const match = report2.files.find((f2) => f2.path === f.path);
      const content2 = await fs.readFile(match!.path, 'utf8');
      expect(content1).toBe(content2);
    }
  });

  it('reports created on first generation', async () => {
    const { root, cleanup } = await makeTempProject();
    cleanups.push(cleanup);

    const gen = new AgentsGenerator();
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

    const skillsDir = path.join(root, '.agents', 'skills');
    await fs.mkdir(skillsDir, { recursive: true });

    const oldContent = '<!-- spego-generated v1 -->\n---\nname: spego-create\n---\n\nold flat skill';
    const oldPath = path.join(skillsDir, 'spego-create.md');
    await fs.writeFile(oldPath, oldContent, 'utf8');

    const gen = new AgentsGenerator();
    const report = await gen.generate(root);

    await expect(fs.access(oldPath)).rejects.toThrow();

    expect(report.files.some((f) => f.action === 'removed' && f.path === oldPath)).toBe(true);

    const newSkillPath = path.join(skillsDir, 'spego-create', 'SKILL.md');
    await expect(fs.stat(newSkillPath)).resolves.toBeTruthy();
  });

  it('removes old flat spego skill files left in the legacy .claude root', async () => {
    const { root, cleanup } = await makeTempProject();
    cleanups.push(cleanup);

    const skillsDir = path.join(root, '.claude', 'skills');
    await fs.mkdir(skillsDir, { recursive: true });

    const oldContent = '<!-- spego-generated v1 -->\n---\nname: spego-create\n---\n\nold flat skill';
    const oldPath = path.join(skillsDir, 'spego-create.md');
    await fs.writeFile(oldPath, oldContent, 'utf8');

    const gen = new AgentsGenerator();
    const report = await gen.generate(root);

    await expect(fs.access(oldPath)).rejects.toThrow();
    expect(report.files.some((f) => f.action === 'removed' && f.path === oldPath)).toBe(true);
  });

  it('preserves non-spego flat files', async () => {
    const { root, cleanup } = await makeTempProject();
    cleanups.push(cleanup);

    const skillsDir = path.join(root, '.agents', 'skills');
    await fs.mkdir(skillsDir, { recursive: true });

    const userContent = '---\nname: my-custom-skill\n---\n\ncustom content';
    const userPath = path.join(skillsDir, 'spego-custom.md');
    await fs.writeFile(userPath, userContent, 'utf8');

    const gen = new AgentsGenerator();
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

  it('tasks command has a required positional change input', () => {
    const tasks = getCommandByName('tasks');
    expect(tasks).toBeDefined();
    expect(tasks!.inputSchema.change).toBeDefined();
    expect(tasks!.inputSchema.change.required).toBe(true);
    expect(tasks!.inputSchema.change.positional).toBe(true);
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
