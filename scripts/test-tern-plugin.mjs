#!/usr/bin/env node
// Deterministic Luau runner for plugins/tern-spego/host.luau.
// Concatenates prelude + verbatim host bytes + one scenario group into a
// temporary chunk and executes it with the luau interpreter from PATH.
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const hostPath = process.env.TERN_HOST ?? join(repoRoot, 'plugins/tern-spego/host.luau');
const testDir = join(repoRoot, 'test/tern-spego');
const groups = ['lifecycle', 'validation', 'interaction'];

const arg = process.argv[2];
if (process.argv.length > 3 || (arg !== undefined && !groups.includes(arg))) {
  console.error(`usage: node scripts/test-tern-plugin.mjs [${groups.join('|')}]`);
  console.error(`unknown group: ${arg ?? '(extra argument)'}`);
  process.exit(1);
}
const selected = arg ? [arg] : groups;

const prelude = readFileSync(join(testDir, 'prelude.luau'), 'utf8');
let host;
try {
  host = readFileSync(hostPath, 'utf8');
} catch (err) {
  console.error(`cannot read host source ${hostPath}: ${err.message}`);
  process.exit(1);
}

let failures = 0;
for (const group of selected) {
  const groupPath = join(testDir, `${group}.luau`);
  if (!existsSync(groupPath)) {
    console.log(`FAIL ${group}: missing scenario file ${groupPath}`);
    failures += 1;
    continue;
  }
  const source = readFileSync(groupPath, 'utf8');
  if (!/\S/.test(source)) {
    console.log(`FAIL ${group}: scenario file is empty`);
    failures += 1;
    continue;
  }
  const chunk = prelude + '\n' + host + '\n' + source + '\nT.finish()\n';
  const dir = mkdtempSync(join(tmpdir(), `tern-spego-${group}-`));
  let result;
  try {
    const chunkPath = join(dir, `${group}.luau`);
    writeFileSync(chunkPath, chunk);
    result = spawnSync('luau', [chunkPath], {
      timeout: 10000,
      maxBuffer: 1048576,
      encoding: 'utf8',
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) {
    const reason = result.error.code === 'ETIMEDOUT' ? 'timed out after 10s' : `failed to start: ${result.error.message}`;
    console.log(`FAIL ${group}: ${reason}`);
    failures += 1;
  } else if (result.status !== 0) {
    console.log(`FAIL ${group}: exited with status ${result.status}`);
    failures += 1;
  } else {
    console.log(`PASS ${group}`);
  }
}

console.log(`${selected.length - failures}/${selected.length} scenario group(s) passed`);
process.exit(failures === 0 ? 0 : 1);
