/**
 * Invocation-local artifact snapshot read straight from canonical markdown,
 * used by `spego board --fresh`. Mirrors the indexed `list`/`readById`
 * semantics without touching the SQLite cache: same ordering, same
 * deleted-artifact filtering, but always the on-disk truth.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { ListOptions, IndexedArtifact } from '../index/indexer.js';
import { knownArtifactTypes, type WorkspaceConfig } from '../workspace/config.js';
import { artifactTypeDir, type WorkspacePaths } from '../workspace/paths.js';
import { readArtifactFile } from '../artifacts/storage.js';
import { SpegoError } from '../errors.js';

export interface FreshSnapshot {
  list(opts?: ListOptions): IndexedArtifact[];
  byId(id: string): IndexedArtifact | null;
}

/** Scan every known artifact type dir and parse each canonical markdown file. */
export async function loadFreshSnapshot(
  paths: WorkspacePaths,
  config: WorkspaceConfig,
): Promise<FreshSnapshot> {
  const rows: IndexedArtifact[] = [];
  const byId = new Map<string, IndexedArtifact>();
  for (const type of [...knownArtifactTypes(config)].sort()) {
    const dir = artifactTypeDir(paths, type);
    let entries: string[];
    try {
      entries = await fs.readdir(dir);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') continue;
      throw err;
    }
    for (const entry of entries.filter((name) => name.endsWith('.md')).sort()) {
      const filePath = path.join(dir, entry);
      const { frontmatter: fm } = await readArtifactFile(filePath);
      const existing = byId.get(fm.id);
      if (existing) {
        throw new SpegoError('VALIDATION_FAILED', `Duplicate artifact id ${fm.id}`, {
          id: fm.id,
          paths: [existing.path, filePath],
        });
      }
      const row: IndexedArtifact = {
        id: fm.id,
        type: fm.type,
        slug: fm.slug,
        title: fm.title,
        revision: fm.revision,
        path: filePath,
        createdAt: fm.createdAt,
        updatedAt: fm.updatedAt,
        deletedAt: fm.deletedAt ?? null,
        meta: fm.meta ?? {},
      };
      byId.set(row.id, row);
      rows.push(row);
    }
  }
  rows.sort((a, b) => a.type.localeCompare(b.type) || b.updatedAt.localeCompare(a.updatedAt));
  return {
    list(opts: ListOptions = {}) {
      return rows.filter(
        (row) =>
          (!opts.type || row.type === opts.type) && (opts.includeDeleted || row.deletedAt === null),
      );
    },
    byId(id: string) {
      const row = byId.get(id) ?? null;
      return row && row.deletedAt === null ? row : null;
    },
  };
}
