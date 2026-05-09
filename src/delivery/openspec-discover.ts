import { execFile as execFileCb } from 'node:child_process';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { promisify } from 'node:util';
import { SpegoError } from '../errors.js';

const execFile = promisify(execFileCb);

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

  const results: DiscoveredChange[] = [];
  for (const entry of entries) {
    const fullPath = join(changesDir, entry);
    const metaPath = join(fullPath, META_FILE);
    let s;
    try {
      s = await stat(fullPath);
    } catch { continue; }
    if (!s.isDirectory()) continue;

    let hasMeta = false;
    try {
      hasMeta = (await stat(metaPath)).isFile();
    } catch { /* no meta */ }
    if (!hasMeta) continue;

    let archived = false;
    try {
      const raw = await readFile(metaPath, 'utf8');
      archived = /^(?:archived:\s*true)\s*$/m.test(raw);
    } catch { /* ignore */ }

    results.push({
      name: entry,
      relPath: relative(projectRoot, fullPath),
      archived,
    });
  }
  return results;
}

export async function fetchCliStatus(projectRoot: string, changeName: string): Promise<Record<string, unknown> | null> {
  try {
    const { stdout } = await execFile('openspec', ['status', '--change', changeName, '--json'], {
      cwd: projectRoot,
      timeout: 5000,
    });
    return JSON.parse(stdout) as Record<string, unknown>;
  } catch {
    return null;
  }
}
