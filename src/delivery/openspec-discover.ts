import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { SpegoError } from '../errors.js';

const OPENSPEC_DIR = 'openspec';
const CONFIG_FILE = 'config.yaml';
const CHANGES_DIR = 'changes';
const ARCHIVE_DIR = 'archive';
const META_FILE = '.openspec.yaml';
const ARCHIVE_NAME_PREFIX = /^\d{4}-\d{2}-\d{2}-/;

export interface DiscoveredChange {
  name: string;
  relPath: string;
  archived: boolean;
}

export async function assertWorkspace(projectRoot: string): Promise<void> {
  const cfg = join(projectRoot, OPENSPEC_DIR, CONFIG_FILE);
  try {
    const s = await stat(cfg);
    if (!s.isFile()) throw new SpegoError('DELIVERY_ADAPTER_ERROR', 'OpenSpec workspace not found');
  } catch (err) {
    if (err instanceof SpegoError) throw err;
    throw new SpegoError('DELIVERY_ADAPTER_ERROR', 'OpenSpec workspace not found', {
      hint: 'Run openspec init or check openspec/config.yaml exists',
    });
  }
}

export async function discoverChanges(projectRoot: string): Promise<DiscoveredChange[]> {
  const changesDir = join(projectRoot, OPENSPEC_DIR, CHANGES_DIR);
  const flat = await discoverFlatChanges(changesDir, projectRoot);
  const archived = await discoverArchivedChanges(join(changesDir, ARCHIVE_DIR), projectRoot);
  return [...flat, ...archived];
}

async function listDirEntries(dir: string): Promise<string[]> {
  try {
    return await readdir(dir);
  } catch {
    return [];
  }
}

async function hasMetaFile(fullPath: string): Promise<boolean> {
  let s;
  try {
    s = await stat(fullPath);
  } catch {
    return false;
  }
  if (!s.isDirectory()) return false;
  try {
    return (await stat(join(fullPath, META_FILE))).isFile();
  } catch {
    return false;
  }
}

async function discoverFlatChanges(changesDir: string, projectRoot: string): Promise<DiscoveredChange[]> {
  const entries = await listDirEntries(changesDir);
  const discovered = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = join(changesDir, entry);
      if (!(await hasMetaFile(fullPath))) return null;

      const raw = await readFile(join(fullPath, META_FILE), 'utf8').catch(() => '');
      const archived = /^(?:archived:\s*true)\s*$/m.test(raw);

      return {
        name: entry,
        relPath: relative(projectRoot, fullPath),
        archived,
      };
    }),
  );
  return discovered.filter((item): item is DiscoveredChange => item !== null);
}

/** Archived changes live under `archive/YYYY-MM-DD-<slug>/`; location implies `archived: true`. */
async function discoverArchivedChanges(archiveDir: string, projectRoot: string): Promise<DiscoveredChange[]> {
  const entries = await listDirEntries(archiveDir);
  const discovered = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = join(archiveDir, entry);
      if (!(await hasMetaFile(fullPath))) return null;

      return {
        name: entry.replace(ARCHIVE_NAME_PREFIX, ''),
        relPath: relative(projectRoot, fullPath),
        archived: true,
      };
    }),
  );
  return discovered.filter((item): item is DiscoveredChange => item !== null);
}
