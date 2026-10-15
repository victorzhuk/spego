/**
 * Regenerate the canonical `skills/` source tree from the command and
 * workflow registries.
 *
 * This is the same render path `spego skills` uses in end-user projects, so
 * the committed `skills/` directory stays byte-identical to generated output.
 * It is what `npx skills add victorzhuk/spego` installs from. Run it whenever
 * a command or workflow changes; test/generator.source.test.ts fails when the
 * tree drifts.
 */

import path from 'node:path';
import fs from 'node:fs/promises';
import { renderAgentSkills } from '../src/generator/templates.js';
import { wrapWithMarker } from '../src/generator/markers.js';

const repoRoot = path.resolve(import.meta.dirname, '..');
const skillsDir = path.join(repoRoot, 'skills');

const assets = renderAgentSkills();
const currentDirs = new Set(assets.map((a) => a.dirName));

let created = 0;
let updated = 0;
for (const asset of assets) {
  const skillDir = path.join(skillsDir, asset.dirName);
  const skillPath = path.join(skillDir, 'SKILL.md');
  const content = wrapWithMarker(asset.content);
  await fs.mkdir(skillDir, { recursive: true });
  const existing = await fs.readFile(skillPath, 'utf8').catch(() => null);
  if (existing === content) continue;
  await fs.writeFile(skillPath, content, 'utf8');
  if (existing === null) created += 1;
  else updated += 1;
}

let removed = 0;
let entries: string[];
try {
  entries = await fs.readdir(skillsDir);
} catch {
  entries = [];
}
for (const entry of entries) {
  if (!entry.startsWith('spego-') || currentDirs.has(entry)) continue;
  // The script owns the whole `skills/spego-*` tree; stale dirs go wholesale.
  const resolvedRoot = path.resolve(skillsDir);
  const dir = path.resolve(skillsDir, entry);
  if (dir === resolvedRoot || !dir.startsWith(resolvedRoot + path.sep)) continue;
  await fs.rm(dir, { recursive: true, force: true });
  removed += 1;
}

console.log(
  `skills: ${assets.length} skills at ${path.relative(repoRoot, skillsDir)} ` +
    `(${created} created, ${updated} updated, ${removed} removed)`,
);
