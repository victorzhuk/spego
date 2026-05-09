import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();

async function readPkg() {
  return JSON.parse(await fs.readFile(path.join(ROOT, 'package.json'), 'utf8'));
}

describe('package.json metadata', () => {
  it('name is @zhuk/spego', async () => {
    const pkg = await readPkg();
    expect(pkg.name).toBe('@zhuk/spego');
  });

  it('version matches semver pattern', async () => {
    const pkg = await readPkg();
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('license is MIT', async () => {
    const pkg = await readPkg();
    expect(pkg.license).toBe('MIT');
  });

  it('repository.url contains victorzhuk/spego', async () => {
    const pkg = await readPkg();
    expect(pkg.repository.url).toContain('victorzhuk/spego');
  });

  it('publishConfig.access is public', async () => {
    const pkg = await readPkg();
    expect(pkg.publishConfig.access).toBe('public');
  });

  it('bin.spego points to ./dist/cli.js', async () => {
    const pkg = await readPkg();
    expect(pkg.bin.spego).toBe('./dist/cli.js');
  });

  it('main points to ./dist/index.js', async () => {
    const pkg = await readPkg();
    expect(pkg.main).toBe('./dist/index.js');
  });

  it('types points to ./dist/index.d.ts', async () => {
    const pkg = await readPkg();
    expect(pkg.types).toBe('./dist/index.d.ts');
  });

  it('files includes dist, README.md, and CHANGELOG.md', async () => {
    const pkg = await readPkg();
    expect(pkg.files).toContain('dist');
    expect(pkg.files).toContain('README.md');
    expect(pkg.files).toContain('CHANGELOG.md');
  });

  it('engines.node is >=22.14.0', async () => {
    const pkg = await readPkg();
    expect(pkg.engines.node).toBe('>=22.14.0');
  });
});

describe('npm pack output', () => {
  let packEntries: string[];

  beforeAll(async () => {
    const raw = execSync('npm pack --dry-run --json', { cwd: ROOT, encoding: 'utf8' });
    const parsed = JSON.parse(raw);
    packEntries = parsed[0].files.map((f: { path: string }) => f.path);
  });

  it('includes dist/cli.js', () => {
    expect(packEntries).toContain('dist/cli.js');
  });

  it('includes dist/index.js', () => {
    expect(packEntries).toContain('dist/index.js');
  });

  it('includes README.md', () => {
    expect(packEntries).toContain('README.md');
  });

  it('includes LICENSE', () => {
    expect(packEntries).toContain('LICENSE');
  });

  it('includes CHANGELOG.md', () => {
    expect(packEntries).toContain('CHANGELOG.md');
  });

  it('excludes src/ files', () => {
    expect(packEntries.every((f) => !f.startsWith('src/'))).toBe(true);
  });

  it('excludes test/ files', () => {
    expect(packEntries.every((f) => !f.startsWith('test/'))).toBe(true);
  });

  it('excludes .spego/ files', () => {
    expect(packEntries.every((f) => !f.startsWith('.spego/'))).toBe(true);
  });
});

describe('built CLI runs', () => {
  let pkgVersion: string;

  beforeAll(async () => {
    pkgVersion = (await readPkg()).version;
  });

  it('--version outputs version matching package.json', () => {
    let output = '';
    try {
      output = execSync(`node ${path.join(ROOT, 'dist', 'cli.js')} --version`, {
        encoding: 'utf8',
      }).trim();
    } catch (err: unknown) {
      output = (err as { stdout: string }).stdout.trim();
    }
    expect(output).toBe(pkgVersion);
  });

  it('commands outputs valid JSON with array of commands', () => {
    const output = execSync(`node ${path.join(ROOT, 'dist', 'cli.js')} commands`, {
      encoding: 'utf8',
    });
    const result = JSON.parse(output);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });
});
