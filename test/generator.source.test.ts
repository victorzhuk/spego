import { describe, it, expect } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { renderAgentSkills } from '../src/generator/templates.js';
import { wrapWithMarker } from '../src/generator/markers.js';

/**
 * The committed `skills/` tree is the source `npx skills add victorzhuk/spego`
 * installs from; `spego skills` renders the same templates in end-user
 * projects. This test fails when the tree drifts from generator output, so
 * both install paths always deliver identical skills. After editing a command
 * or workflow, run `npm run skills`.
 */

const REPO_ROOT = path.resolve(import.meta.dirname, '..');
const SKILLS_DIR = path.join(REPO_ROOT, 'skills');

describe('canonical skills/ source tree', () => {
  it('contains exactly the registered skills with byte-identical SKILL.md files', async () => {
    const assets = renderAgentSkills();
    const expected = new Map(assets.map((a) => [a.dirName, wrapWithMarker(a.content)]));

    const entries = await fs.readdir(SKILLS_DIR);
    expect(new Set(entries)).toEqual(new Set(expected.keys()));

    for (const [dirName, expectedContent] of expected) {
      const skillPath = path.join(SKILLS_DIR, dirName, 'SKILL.md');
      const content = await fs.readFile(skillPath, 'utf8');
      expect(content).toBe(expectedContent);
    }
  });

  it('ships the skills tree in the npm package files', async () => {
    const pkg = JSON.parse(await fs.readFile(path.join(REPO_ROOT, 'package.json'), 'utf8'));
    expect(pkg.files).toContain('skills');
  });
});
