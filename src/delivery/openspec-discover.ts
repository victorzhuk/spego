import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { SpegoError } from '../errors.js';

const OPENSPEC_DIR = 'openspec';
const CONFIG_FILE = 'config.yaml';
const CHANGES_DIR = 'changes';
const META_FILE = '.openspec.yaml';

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
  let entries: string[];
  try {
    entries = await readdir(changesDir);
  } catch {
    return [];
  }

  const discovered = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = join(changesDir, entry);
      const metaPath = join(fullPath, META_FILE);

      let s;
      try {
        s = await stat(fullPath);
      } catch {
        return null;
      }
      if (!s.isDirectory()) return null;

      try {
        if (!(await stat(metaPath)).isFile()) return null;
      } catch {
        return null;
      }

      const raw = await readFile(metaPath, 'utf8').catch(() => '');
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
