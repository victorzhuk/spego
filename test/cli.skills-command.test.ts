import { describe, it, expect, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { makeTempProject } from './helpers.js';

const PROJECT_ROOT = path.resolve(import.meta.dirname, '..');
const CLI_PATH = path.join(PROJECT_ROOT, 'src', 'cli.ts');
const exec = promisify(execFile);
const cli = (args: string[], cwd: string) =>
  exec('npx', ['tsx', CLI_PATH, ...args], {
    cwd,
    timeout: 30_000,
    env: { ...process.env, NODE_NO_WARNINGS: '1' },
  });

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const fn of cleanups.splice(0)) await fn();
});

async function setup() {
  const { root, cleanup } = await makeTempProject();
  cleanups.push(cleanup);
  await cli(['init', '--agents', 'claude', '--demo', 'false', '--cwd', root], root);
  return root;
}

describe('CLI skills command', () => {
  it('skills human output contains 🛠️ Skill regeneration and is not JSON', async () => {
    const root = await setup();
    const { stdout } = await cli(['skills', '--cwd', root], root);
    expect(stdout).toContain('🛠️ Skill regeneration');
    expect(() => JSON.parse(stdout)).toThrow();
  });

  it('skills --json output parses as JSON array of reports', async () => {
    const root = await setup();
    const { stdout } = await cli(['--json', 'skills', '--cwd', root], root);
    const result = JSON.parse(stdout);
    expect(Array.isArray(result)).toBe(true);
    expect(result[0].target).toBeTruthy();
    expect(Array.isArray(result[0].files)).toBe(true);
  });

  it('regenerate hidden alias still works and emits deprecation warning', async () => {
    const root = await setup();
    const { stdout, stderr } = await cli(['regenerate', '--cwd', root], root);
    expect(stdout).toContain('🛠️ Skill regeneration');
    expect(stderr).toContain("deprecated:");
  });

  it('regenerate --json does not emit deprecation warning to stderr', async () => {
    const root = await setup();
    const { stdout, stderr } = await cli(['--json', 'regenerate', '--cwd', root], root);
    const result = JSON.parse(stdout);
    expect(Array.isArray(result)).toBe(true);
    expect(stderr).not.toContain('deprecated:');
  });

  it('--help lists skills and does not list regenerate', async () => {
    const root = await setup();
    let output = '';
    try {
      const result = await cli(['--help'], root);
      output = result.stdout;
    } catch (e: unknown) {
      const err = e as { stdout?: string; stderr?: string };
      output = err.stdout ?? err.stderr ?? '';
    }
    expect(output).toContain('skills');
    expect(output).not.toContain('regenerate');
  });

  it('commands lists skills and does not list regenerate', async () => {
    const root = await setup();
    const { stdout } = await cli(['--json', 'commands'], root);
    const result = JSON.parse(stdout);
    expect(Array.isArray(result)).toBe(true);
    expect(result.some((c: { name: string }) => c.name === 'skills')).toBe(true);
    expect(result.some((c: { name: string }) => c.name === 'regenerate')).toBe(false);
  });

  it('skills command generates spego-skills paths', async () => {
    const root = await setup();
    await cli(['skills', '--cwd', root], root);
    const skill = await fs.stat(path.join(root, '.claude', 'skills', 'spego-skills', 'SKILL.md'));
    expect(skill.isFile()).toBe(true);
    const cmd = await fs.stat(path.join(root, '.claude', 'commands', 'spego', 'skills.md'));
    expect(cmd.isFile()).toBe(true);
  });

  it('removes legacy spego-regenerate paths when present', async () => {
    const root = await setup();
    const legacySkillDir = path.join(root, '.claude', 'skills', 'spego-regenerate');
    const legacySkillPath = path.join(legacySkillDir, 'SKILL.md');
    const legacyCmdDir = path.join(root, '.claude', 'commands', 'spego');
    const legacyCmdPath = path.join(legacyCmdDir, 'regenerate.md');

    await fs.mkdir(legacySkillDir, { recursive: true });
    await fs.writeFile(
      legacySkillPath,
      '---\nspego_generated: true\nspego_version: 1\n---\nTest',
    );
    await fs.mkdir(legacyCmdDir, { recursive: true });
    await fs.writeFile(
      legacyCmdPath,
      '---\nspego_generated: true\nspego_version: 1\n---\nTest',
    );

    const { stdout } = await cli(['--json', 'skills', '--cwd', root], root);
    const reports = JSON.parse(stdout);
    const allFiles = reports.flatMap((r: { files: { path: string; action: string }[] }) => r.files);
    const cleaned = allFiles.filter(
      (f: { path: string; action: string }) => f.action === 'removed',
    );
    expect(cleaned.length).toBe(2);
    await expect(fs.access(legacySkillPath)).rejects.toThrow();
    await expect(fs.access(legacyCmdPath)).rejects.toThrow();
  });

  it('does not report legacy cleanup on second run', async () => {
    const root = await setup();
    const legacySkillDir = path.join(root, '.claude', 'skills', 'spego-regenerate');
    const legacyCmdDir = path.join(root, '.claude', 'commands', 'spego');

    await fs.mkdir(legacySkillDir, { recursive: true });
    await fs.writeFile(
      path.join(legacySkillDir, 'SKILL.md'),
      '---\nspego_generated: true\nspego_version: 1\n---\nTest',
    );
    await fs.mkdir(legacyCmdDir, { recursive: true });
    await fs.writeFile(
      path.join(legacyCmdDir, 'regenerate.md'),
      '---\nspego_generated: true\nspego_version: 1\n---\nTest',
    );

    await cli(['--json', 'skills', '--cwd', root], root);

    const { stdout: stdout2 } = await cli(['--json', 'skills', '--cwd', root], root);
    const reports2 = JSON.parse(stdout2);
    const allFiles2 = reports2.flatMap((r: { files: { path: string; action: string }[] }) => r.files);
    const legacyCleaned2 = allFiles2.filter(
      (f: { path: string; action: string }) =>
        f.action === 'removed' && f.path.includes('regenerate'),
    );
    expect(legacyCleaned2).toHaveLength(0);
  });

  it('does not remove legacy spego-regenerate paths without spego_generated marker', async () => {
    const root = await setup();
    const legacySkillDir = path.join(root, '.claude', 'skills', 'spego-regenerate');
    const legacySkillPath = path.join(legacySkillDir, 'SKILL.md');
    const legacyCmdDir = path.join(root, '.claude', 'commands', 'spego');
    const legacyCmdPath = path.join(legacyCmdDir, 'regenerate.md');

    await fs.mkdir(legacySkillDir, { recursive: true });
    await fs.writeFile(
      legacySkillPath,
      '---\nname: my-custom-skill\n---\nUser-owned content',
    );
    await fs.mkdir(legacyCmdDir, { recursive: true });
    await fs.writeFile(
      legacyCmdPath,
      '---\nname: my-custom-command\n---\nUser-owned content',
    );

    const { stdout } = await cli(['--json', 'skills', '--cwd', root], root);
    const reports = JSON.parse(stdout);
    const allFiles = reports.flatMap((r: { files: { path: string; action: string }[] }) => r.files);
    const skipped = allFiles.filter(
      (f: { path: string; action: string }) => f.action === 'skipped' && f.path.includes('regenerate'),
    );
    expect(skipped.length).toBe(2);

    await expect(fs.access(legacySkillPath)).resolves.toBeUndefined();
    await expect(fs.access(legacyCmdPath)).resolves.toBeUndefined();
  });
});
