import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { makeTempProject } from './helpers.js';
import { ClaudeGenerator } from '../src/generator/claude.js';
import { writeGeneratedFile } from '../src/generator/write.js';
import { COMMAND_REGISTRY, getCommandByName } from '../src/commands/registry.js';
import { isSpegoGenerated, SPEGO_GENERATED_MARKER } from '../src/generator/markers.js';

describe('Claude skill generation', () => {
  let cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    for (const fn of cleanups.splice(0)) await fn();
  });

  it('creates a skill file for every registered command', async () => {
    const { root, cleanup } = await makeTempProject();
    cleanups.push(cleanup);

    const gen = new ClaudeGenerator();
    const report = await gen.generate(root);

    for (const cmd of COMMAND_REGISTRY) {
      const skillPath = path.join(root, '.claude', 'skills', `spego-${cmd.name}.md`);
      const skillFile = report.files.find((f) => f.path === skillPath);
      expect(skillFile).toBeDefined();
      expect(skillFile!.action).toBe('created');

      const content = await fs.readFile(skillPath, 'utf8');
      expect(content).toContain(SPEGO_GENERATED_MARKER);
      expect(content).toContain(`name: spego-${cmd.name}`);
      expect(content).toContain(`description: ${cmd.description}`);
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

  it('report contains two files per command', async () => {
    const { root, cleanup } = await makeTempProject();
    cleanups.push(cleanup);

    const gen = new ClaudeGenerator();
    const report = await gen.generate(root);

    expect(report.files.length).toBe(COMMAND_REGISTRY.length * 2);
    expect(report.target).toBe('claude');
    expect(report.version).toBe(1);
  });
});

describe('User file preservation', () => {
  let cleanups: Array<() => Promise<void>> = [];

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

    const action = await writeGeneratedFile(filePath, 'generated content');
    expect(action).toBe('skipped');

    const onDisk = await fs.readFile(filePath, 'utf8');
    expect(onDisk).toBe(userContent);
  });

  it('overwrites files with spego-generated marker', async () => {
    const { root, cleanup } = await makeTempProject();
    cleanups.push(cleanup);

    const filePath = path.join(root, 'old-gen.md');
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    await writeGeneratedFile(filePath, 'old content');

    const action = await writeGeneratedFile(filePath, 'new content');
    expect(action).toBe('updated');

    const onDisk = await fs.readFile(filePath, 'utf8');
    expect(onDisk).toContain('new content');
    expect(onDisk).not.toContain('old content');
  });
});

describe('Deterministic regeneration', () => {
  let cleanups: Array<() => Promise<void>> = [];

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
      expect(f.action).toBe('unchanged');
    }

    for (const f of report1.files) {
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

  it('artifact commands support both markdown and json output', () => {
    const artifactCommands = COMMAND_REGISTRY.filter((c) => c.category === 'artifact');
    for (const cmd of artifactCommands) {
      expect(cmd.outputModes).toContain('markdown');
      expect(cmd.outputModes).toContain('json');
    }
  });
});
