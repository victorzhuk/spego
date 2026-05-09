import fs from 'node:fs/promises';
import path from 'node:path';
import {
  artifactFilePath,
  type WorkspacePaths,
} from '../workspace/paths.js';
import {
  parseArtifactFile,
} from '../artifacts/storage.js';
import type { ArtifactFrontmatter } from '../artifacts/types.js';
import type { Db } from './db.js';
import { ensureIndexSchema, transaction } from './db.js';
import { SpegoError } from '../errors.js';

export interface IndexedArtifact {
  id: string;
  type: string;
  slug: string;
  title: string;
  revision: number;
  path: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  meta: Record<string, unknown>;
}

function rowToArtifact(row: Record<string, unknown>): IndexedArtifact {
  return {
    id: row.id as string,
    type: row.type as string,
    slug: row.slug as string,
    title: row.title as string,
    revision: row.revision as number,
    path: row.path as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    deletedAt: (row.deleted_at as string | null) ?? null,
    meta: JSON.parse((row.meta_json as string) ?? '{}'),
  };
}

/** Upsert the artifact mirror row + revision row in a single transaction. */
export function upsertArtifact(
  db: Db,
  fm: ArtifactFrontmatter,
  filePath: string,
  revisionPath?: string,
): void {
  transaction(db, () => {
    db.prepare(
      `INSERT INTO artifacts
         (id, type, slug, title, revision, path, created_at, updated_at, deleted_at, meta_json)
       VALUES
         (@id, @type, @slug, @title, @revision, @path, @created_at, @updated_at, @deleted_at, @meta_json)
       ON CONFLICT(id) DO UPDATE SET
         type       = excluded.type,
         slug       = excluded.slug,
         title      = excluded.title,
         revision   = excluded.revision,
         path       = excluded.path,
         updated_at = excluded.updated_at,
         deleted_at = excluded.deleted_at,
         meta_json  = excluded.meta_json`,
    ).run({
      id: fm.id,
      type: fm.type,
      slug: fm.slug,
      title: fm.title,
      revision: fm.revision,
      path: filePath,
      created_at: fm.createdAt,
      updated_at: fm.updatedAt,
      deleted_at: fm.deletedAt ?? null,
      meta_json: JSON.stringify(fm.meta ?? {}),
    });

    db.prepare(
      `INSERT INTO revisions
         (artifact_id, revision, type, slug, title, path, created_at, meta_json)
       VALUES
         (@id, @revision, @type, @slug, @title, @path, @created_at, @meta_json)
       ON CONFLICT(artifact_id, revision) DO UPDATE SET
         title      = excluded.title,
         path       = excluded.path,
         meta_json  = excluded.meta_json`,
    ).run({
      id: fm.id,
      revision: fm.revision,
      type: fm.type,
      slug: fm.slug,
      title: fm.title,
      path: revisionPath ?? filePath,
      created_at: fm.updatedAt,
      meta_json: JSON.stringify(fm.meta ?? {}),
    });
  });
}

export interface ListOptions {
  type?: string;
  includeDeleted?: boolean;
}

export function listArtifacts(db: Db, opts: ListOptions = {}): IndexedArtifact[] {
  const where: string[] = [];
  const params: Record<string, string | number | null> = {};
  if (opts.type) {
    where.push('type = @type');
    params.type = opts.type;
  }
  if (!opts.includeDeleted) {
    where.push('deleted_at IS NULL');
  }
  const sql =
    `SELECT * FROM artifacts` +
    (where.length ? ` WHERE ${where.join(' AND ')}` : '') +
    ` ORDER BY type ASC, updated_at DESC`;
  const stmt = db.prepare(sql);
  const rows = where.length ? stmt.all(params) : stmt.all();
  return rows.map((r) => rowToArtifact(r as Record<string, unknown>));
}

export function getArtifactById(db: Db, id: string): IndexedArtifact | null {
  const row = db.prepare(`SELECT * FROM artifacts WHERE id = ?`).get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? rowToArtifact(row) : null;
}

export function getArtifactByTypeSlug(
  db: Db,
  type: string,
  slug: string,
): IndexedArtifact | null {
  const row = db
    .prepare(`SELECT * FROM artifacts WHERE type = ? AND slug = ?`)
    .get(type, slug) as Record<string, unknown> | undefined;
  return row ? rowToArtifact(row) : null;
}

export function listRevisions(db: Db, artifactId: string): Array<{
  revision: number;
  path: string;
  createdAt: string;
}> {
  const rows = db
    .prepare(
      `SELECT revision, path, created_at FROM revisions WHERE artifact_id = ? ORDER BY revision ASC`,
    )
    .all(artifactId) as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    revision: r.revision as number,
    path: r.path as string,
    createdAt: r.created_at as string,
  }));
}

export interface RebuildReport {
  scannedFiles: number;
  indexedArtifacts: number;
  invalidFiles: Array<{ path: string; error: string }>;
}

/**
 * Walk `.spego/artifacts/**\/*.md`, drop the index tables, and rebuild from
 * the markdown files. Invalid files are reported but do not abort the rebuild.
 */
export async function rebuildIndex(
  db: Db,
  paths: WorkspacePaths,
  knownTypes?: ReadonlySet<string>,
): Promise<RebuildReport> {
  const report: RebuildReport = {
    scannedFiles: 0,
    indexedArtifacts: 0,
    invalidFiles: [],
  };

  // Reset tables; recreate schema for safety.
  db.exec(`DROP TABLE IF EXISTS revisions; DROP TABLE IF EXISTS artifacts;`);
  ensureIndexSchema(db);

  let typeDirs: string[];
  try {
    typeDirs = await fs.readdir(paths.artifactsRoot);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return report;
    }
    throw err;
  }

  for (const type of typeDirs) {
    const typeDir = path.join(paths.artifactsRoot, type);
    let stat;
    try {
      stat = await fs.stat(typeDir);
    } catch {
      continue;
    }
    if (!stat.isDirectory()) continue;

    const entries = await fs.readdir(typeDir);
    for (const entry of entries) {
      if (!entry.endsWith('.md')) continue;
      const file = path.join(typeDir, entry);
      report.scannedFiles += 1;
      try {
        const text = await fs.readFile(file, 'utf8');
        const { frontmatter } = parseArtifactFile(text, file);
        if (knownTypes && !knownTypes.has(frontmatter.type)) {
          throw new SpegoError('INVALID_ARTIFACT_TYPE', `Unsupported artifact type: ${frontmatter.type}`, {
            type: frontmatter.type,
            path: file,
          });
        }
        const expectedName = `${frontmatter.slug}.md`;
        if (entry !== expectedName) {
          throw new SpegoError('VALIDATION_FAILED',
            `File name "${entry}" does not match slug "${frontmatter.slug}" in frontmatter`,
            { path: file, expectedSlug: frontmatter.slug, fileName: entry },
          );
        }
        // Use the canonical computed path so reads from any cwd resolve.
        const canonical = artifactFilePath(paths, frontmatter.type, frontmatter.slug);
        upsertArtifact(db, frontmatter, canonical);

        // Discover revision snapshots and reattach.
        await reindexRevisions(db, paths, frontmatter, report);

        report.indexedArtifacts += 1;
      } catch (err) {
        const message =
          err instanceof SpegoError ? `${err.code}: ${err.message}` : (err as Error).message;
        report.invalidFiles.push({ path: file, error: message });
      }
    }
  }

  db.prepare(
    `INSERT INTO index_meta (key, value) VALUES ('last_rebuild', @value)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run({ value: new Date().toISOString() });

  return report;
}

async function reindexRevisions(
  db: Db,
  paths: WorkspacePaths,
  fm: ArtifactFrontmatter,
  report: RebuildReport,
): Promise<void> {
  const revDir = path.join(paths.revisionsRoot, fm.type);
  let entries: string[];
  try {
    entries = await fs.readdir(revDir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw err;
  }
  const prefix = `${fm.slug}.r`;
  for (const entry of entries) {
    if (!entry.startsWith(prefix) || !entry.endsWith('.md')) continue;
    const file = path.join(revDir, entry);
    try {
      const text = await fs.readFile(file, 'utf8');
      const { frontmatter } = parseArtifactFile(text, file);
      if (frontmatter.id !== fm.id) continue;
      db.prepare(
        `INSERT INTO revisions
           (artifact_id, revision, type, slug, title, path, created_at, meta_json)
         VALUES
           (@id, @revision, @type, @slug, @title, @path, @created_at, @meta_json)
         ON CONFLICT(artifact_id, revision) DO UPDATE SET
           title     = excluded.title,
           path      = excluded.path,
           meta_json = excluded.meta_json`,
      ).run({
        id: frontmatter.id,
        revision: frontmatter.revision,
        type: frontmatter.type,
        slug: frontmatter.slug,
        title: frontmatter.title,
        path: file,
        created_at: frontmatter.updatedAt,
        meta_json: JSON.stringify(frontmatter.meta ?? {}),
      });
    } catch (err) {
      const message =
        err instanceof SpegoError ? `${err.code}: ${err.message}` : (err as Error).message;
      report.invalidFiles.push({ path: file, error: message });
    }
  }
}
