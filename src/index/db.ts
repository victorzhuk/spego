import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';

// `node:sqlite` is a Node built-in, but bundlers (Vite/Rollup) trip over the
// `node:` prefix because their built-in lists lag behind Node releases.
// Loading via createRequire keeps the import opaque to static analyzers.
const requireFromHere = createRequire(import.meta.url);
const { DatabaseSync } = requireFromHere('node:sqlite') as typeof import('node:sqlite');

export type Db = InstanceType<typeof DatabaseSync>;

/** Open (or create) the SQLite index database with safe pragmas. */
export function openIndexDb(dbPath: string): Db {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA synchronous = NORMAL');
  db.exec('PRAGMA foreign_keys = ON');
  return db;
}

export function closeIndexDb(db: Db): void {
  db.close();
}

/** Run `fn` inside a SQLite transaction. Rolls back on throw. */
export function transaction<T>(db: Db, fn: () => T): T {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // ignore secondary rollback failures
    }
    throw err;
  }
}

/**
 * Create or migrate the index schema. Idempotent.
 *
 * Tables:
 *   - artifacts:      one row per logical artifact (latest snapshot mirror)
 *   - revisions:      one row per saved revision
 *   - index_meta:     key/value (schema version, last rebuild, etc.)
 */
export function ensureIndexSchema(db: Db): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS index_meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS artifacts (
      id          TEXT PRIMARY KEY,
      type        TEXT NOT NULL,
      slug        TEXT NOT NULL,
      title       TEXT NOT NULL,
      revision    INTEGER NOT NULL,
      path        TEXT NOT NULL,
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL,
      deleted_at  TEXT,
      meta_json   TEXT NOT NULL DEFAULT '{}'
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_artifacts_type_slug
      ON artifacts (type, slug);

    CREATE INDEX IF NOT EXISTS idx_artifacts_type
      ON artifacts (type);

    CREATE INDEX IF NOT EXISTS idx_artifacts_deleted
      ON artifacts (deleted_at);

    CREATE TABLE IF NOT EXISTS revisions (
      artifact_id  TEXT NOT NULL,
      revision     INTEGER NOT NULL,
      type         TEXT NOT NULL,
      slug         TEXT NOT NULL,
      title        TEXT NOT NULL,
      path         TEXT NOT NULL,
      created_at   TEXT NOT NULL,
      meta_json    TEXT NOT NULL DEFAULT '{}',
      PRIMARY KEY (artifact_id, revision),
      FOREIGN KEY (artifact_id) REFERENCES artifacts(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_revisions_artifact
      ON revisions (artifact_id);
  `);

  db.prepare(
    `INSERT INTO index_meta (key, value) VALUES ('schema_version', '1')
     ON CONFLICT(key) DO NOTHING`,
  ).run();
}
