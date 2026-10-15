import path from 'node:path';
import fs from 'node:fs/promises';
import { writeGeneratedFile, removeGeneratedFile } from './write.js';
import { GENERATOR_VERSION } from './types.js';
import type { TargetGenerator, GenerationReport, GeneratedFile } from './types.js';
import { isLegacySpegoGenerated } from './markers.js';
import { renderAgentSkills } from './templates.js';

/** Skills root of the universal agents target: `.agents/skills/<skill>/SKILL.md`. */
export function agentsSkillsDir(projectRoot: string): string {
  return path.join(projectRoot, '.agents', 'skills');
}

function isContainedIn(root: string, candidate: string): boolean {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(candidate);
  return resolved !== resolvedRoot && resolved.startsWith(resolvedRoot + path.sep);
}

/**
 * Pre-v0.29 skills were single `spego-<name>.md` files dropped flat into a
 * skills root. Remove them when they carry the legacy marker.
 */
async function cleanupLegacyFlatSkills(skillsDir: string): Promise<GeneratedFile[]> {
  const cleaned: GeneratedFile[] = [];
  let entries: string[];
  try {
    entries = await fs.readdir(skillsDir);
  } catch {
    return cleaned;
  }
  for (const entry of entries) {
    if (!entry.startsWith('spego-') || !entry.endsWith('.md')) continue;
    // Contain the unlink to skillsDir even if an entry ever carries separators.
    if (!isContainedIn(skillsDir, path.join(skillsDir, entry))) continue;
    const filePath = path.resolve(skillsDir, entry);
    let content: string;
    try {
      content = await fs.readFile(filePath, 'utf8');
    } catch {
      // Unreadable or vanished mid-scan — leave it alone.
      continue;
    }
    if (isLegacySpegoGenerated(content)) {
      await fs.unlink(filePath);
      cleaned.push({ path: filePath, action: 'removed' });
    }
  }
  return cleaned;
}

/**
 * Remove a generated SKILL.md and its skill dir (only if the unlink happened
 * and nothing user-owned is left behind).
 */
async function removeSkillDir(skillDir: string, cleaned: GeneratedFile[]): Promise<void> {
  const skillPath = path.join(skillDir, 'SKILL.md');
  const action = await removeGeneratedFile(skillPath);
  if (!action) return;
  cleaned.push({ path: skillPath, action });
  if (action !== 'removed') return;
  try {
    await fs.rmdir(skillDir);
  } catch {
    // Directory still holds user files — keep it.
  }
}

/**
 * One-time migration: skills used to live under `.claude/skills` with slash
 * wrappers under `.claude/commands/spego`. Drop spego-generated leftovers so
 * `.claude` is no longer owned by spego. User-owned files are skipped, never
 * deleted.
 */
async function cleanupLegacyClaude(projectRoot: string): Promise<GeneratedFile[]> {
  const cleaned: GeneratedFile[] = [];
  const legacySkillsDir = path.join(projectRoot, '.claude', 'skills');
  let skillDirs: string[];
  try {
    skillDirs = await fs.readdir(legacySkillsDir);
  } catch {
    skillDirs = [];
  }
  for (const entry of skillDirs) {
    if (!entry.startsWith('spego-')) continue;
    const skillDir = path.join(legacySkillsDir, entry);
    if (!isContainedIn(legacySkillsDir, skillDir)) continue;
    await removeSkillDir(skillDir, cleaned);
  }
  const legacyCommandsDir = path.join(projectRoot, '.claude', 'commands', 'spego');
  let commandFiles: string[];
  try {
    commandFiles = await fs.readdir(legacyCommandsDir);
  } catch {
    commandFiles = [];
  }
  let removedAnyCommand = false;
  for (const entry of commandFiles) {
    if (!entry.endsWith('.md')) continue;
    const filePath = path.join(legacyCommandsDir, entry);
    if (!isContainedIn(legacyCommandsDir, filePath)) continue;
    const action = await removeGeneratedFile(filePath);
    if (!action) continue;
    cleaned.push({ path: filePath, action });
    if (action === 'removed') removedAnyCommand = true;
  }
  if (removedAnyCommand) {
    // Tidy the now-possibly-empty wrapper dirs; failures mean they are not empty.
    await fs.rmdir(legacyCommandsDir).catch(() => {});
    await fs.rmdir(path.join(projectRoot, '.claude', 'commands')).catch(() => {});
  }
  return cleaned;
}

/**
 * Retired skills (renames, removed commands) must not linger in the current
 * skills root; drop spego-generated ones the registry no longer names.
 */
async function cleanupStaleSkillDirs(skillsDir: string, currentDirs: Set<string>): Promise<GeneratedFile[]> {
  const cleaned: GeneratedFile[] = [];
  let entries: string[];
  try {
    entries = await fs.readdir(skillsDir);
  } catch {
    return cleaned;
  }
  for (const entry of entries) {
    if (!entry.startsWith('spego-') || currentDirs.has(entry)) continue;
    const skillDir = path.join(skillsDir, entry);
    if (!isContainedIn(skillsDir, skillDir)) continue;
    await removeSkillDir(skillDir, cleaned);
  }
  return cleaned;
}

export class AgentsGenerator implements TargetGenerator {
  readonly targetName = 'agents';

  async generate(projectRoot: string): Promise<GenerationReport> {
    const files: GeneratedFile[] = [];
    const skillsDir = agentsSkillsDir(projectRoot);

    files.push(...(await cleanupLegacyFlatSkills(skillsDir)));
    files.push(...(await cleanupLegacyFlatSkills(path.join(projectRoot, '.claude', 'skills'))));
    files.push(...(await cleanupLegacyClaude(projectRoot)));

    const assets = renderAgentSkills();
    files.push(...(await cleanupStaleSkillDirs(skillsDir, new Set(assets.map((a) => a.dirName)))));

    for (const asset of assets) {
      const skillPath = path.join(skillsDir, asset.dirName, 'SKILL.md');
      const action = await writeGeneratedFile(skillPath, asset.content);
      files.push({ path: skillPath, action });
    }

    return { target: this.targetName, files, version: GENERATOR_VERSION };
  }
}
