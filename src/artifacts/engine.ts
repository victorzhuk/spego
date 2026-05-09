import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import {
  artifactFilePath,
  artifactTypeDir,
  resolveWorkspacePaths,
  type WorkspacePaths,
} from '../workspace/paths.js';
import {
  closeIndexDb,
  ensureIndexSchema,
  openIndexDb,
  type Db,
} from '../index/db.js';
import {
  getArtifactById,
  getArtifactByTypeSlug,
  listArtifacts,
  listRevisions,
  rebuildIndex,
  upsertArtifact,
  type IndexedArtifact,
  type ListOptions,
  type RebuildReport,
} from '../index/indexer.js';
import {
  atomicWriteFile,
  readArtifactFile,
  renderArtifactFile,
} from './storage.js';
import { writeRevisionSnapshot, readRevisionSnapshot } from '../index/revisions.js';
import { makeSlug, uniqueSlug } from './slug.js';
import {
  artifactFrontmatterSchema,
  type ArtifactFrontmatter,
  type ArtifactRecord,
} from './types.js';
import {
  assertSupportedType,
  parseCreateInput,
  parseUpdateInput,
  validateArtifactMeta,
  type CreateArtifactInput,
} from './validation.js';
import { knownArtifactTypes, readConfig, type WorkspaceConfig } from '../workspace/config.js';
import { SpegoError } from '../errors.js';

export interface EngineOptions {
  /** Project root containing `.spego/`. Defaults to cwd. */
  projectRoot?: string;
}

/** Create with `await ArtifactEngine.open(opts)`; remember to `close()`. */
export class ArtifactEngine {
  private closed = false;

  private constructor(
    public readonly paths: WorkspacePaths,
    public readonly config: WorkspaceConfig,
    private readonly db: Db,
  ) {}

  static async open(opts: EngineOptions = {}): Promise<ArtifactEngine> {
    const paths = resolveWorkspacePaths(opts.projectRoot ?? process.cwd());
    let config: WorkspaceConfig;
    try {
      config = await readConfig(paths.configPath);
    } catch (err) {
      if (err instanceof SpegoError && err.code === 'WORKSPACE_NOT_FOUND') {
        throw new SpegoError(
          'WORKSPACE_NOT_FOUND',
          'No spego workspace at this project root. Run `spego init` first.',
          { projectRoot: paths.projectRoot },
        );
      }
      throw err;
    }
    const db = openIndexDb(paths.indexDbPath);
    ensureIndexSchema(db);
    return new ArtifactEngine(paths, config, db);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    closeIndexDb(this.db);
  }

  // ---------------------------------------------------------------- create

  async create(input: unknown): Promise<ArtifactRecord> {
    const data = parseCreateInput(input);
    assertSupportedType(data.type, this.config);
    const validatedMeta = validateArtifactMeta(data.type, data.meta ?? {});
    const now = new Date().toISOString();
    const slug = await this.resolveCreateSlug(data);
    const fm = artifactFrontmatterSchema.parse({
      id: randomUUID(),
      type: data.type,
      slug,
      title: data.title,
      revision: 1,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      meta: validatedMeta,
    });
    const filePath = artifactFilePath(this.paths, fm.type, fm.slug);

    // File-first: write canonical + snapshot, then mirror to index.
    await atomicWriteFile(filePath, renderArtifactFile(fm, data.body));
    const snapPath = await writeRevisionSnapshot(this.paths, fm, data.body);
    upsertArtifact(this.db, fm, filePath, snapPath);

    return { frontmatter: fm, body: data.body, path: filePath };
  }

  private async resolveCreateSlug(data: CreateArtifactInput): Promise<string> {
    const desired = data.slug ? makeSlug(data.slug) : makeSlug(data.title);
    // Existing slugs come from the index (fast) and fallback file scan (truth).
    const existing = new Set<string>();
    for (const row of listArtifacts(this.db, { type: data.type, includeDeleted: true })) {
      existing.add(row.slug);
    }
    try {
      const dirEntries = await fs.readdir(artifactTypeDir(this.paths, data.type));
      for (const entry of dirEntries) {
        if (entry.endsWith('.md')) existing.add(entry.replace(/\.md$/, ''));
      }
    } catch {
      // type dir may not exist yet — fine.
    }
    return uniqueSlug(desired, existing);
  }

  // ------------------------------------------------------------------ read

  async readById(id: string): Promise<ArtifactRecord> {
    const indexed = getArtifactById(this.db, id);
    if (!indexed || indexed.deletedAt) {
      throw new SpegoError('ARTIFACT_NOT_FOUND', `Artifact not found: ${id}`, { id });
    }
    const file = await readArtifactFile(indexed.path);
    return { ...file, path: indexed.path };
  }

  async readByTypeSlug(type: string, slug: string): Promise<ArtifactRecord> {
    assertSupportedType(type, this.config);
    const indexed = getArtifactByTypeSlug(this.db, type, slug);
    if (!indexed || indexed.deletedAt) {
      throw new SpegoError('ARTIFACT_NOT_FOUND', `Artifact not found: ${type}/${slug}`, {
        type,
        slug,
      });
    }
    const file = await readArtifactFile(indexed.path);
    return { ...file, path: indexed.path };
  }

  async readByPath(absPath: string): Promise<ArtifactRecord> {
    const file = await readArtifactFile(absPath);
    return { ...file, path: absPath };
  }

  list(opts: ListOptions = {}): IndexedArtifact[] {
    return listArtifacts(this.db, opts);
  }

  // ---------------------------------------------------------------- update

  async update(id: string, input: unknown): Promise<ArtifactRecord> {
    const data = parseUpdateInput(input);
    const indexed = getArtifactById(this.db, id);
    if (!indexed || indexed.deletedAt) {
      throw new SpegoError('ARTIFACT_NOT_FOUND', `Artifact not found: ${id}`, { id });
    }

    const current = await readArtifactFile(indexed.path);

    if (
      data.expectedRevision !== undefined &&
      data.expectedRevision !== current.frontmatter.revision
    ) {
      throw new SpegoError(
        'REVISION_CONFLICT',
        `Stale revision for ${id}: expected ${data.expectedRevision}, current ${current.frontmatter.revision}`,
        { id, expectedRevision: data.expectedRevision, currentRevision: current.frontmatter.revision },
      );
    }

    if (data.meta !== undefined) {
      data.meta = validateArtifactMeta(indexed.type, data.meta);
    }
    const nextBody = data.body ?? current.body;
    const fm = artifactFrontmatterSchema.parse({
      ...current.frontmatter,
      title: data.title ?? current.frontmatter.title,
      meta: data.meta ?? current.frontmatter.meta ?? {},
      revision: current.frontmatter.revision + 1,
      updatedAt: new Date().toISOString(),
    });

    await atomicWriteFile(indexed.path, renderArtifactFile(fm, nextBody));
    const snapPath = await writeRevisionSnapshot(this.paths, fm, nextBody);
    upsertArtifact(this.db, fm, indexed.path, snapPath);

    return { frontmatter: fm, body: nextBody, path: indexed.path };
  }

  // ---------------------------------------------------------------- delete

  /**
   * Soft delete: set `deletedAt`, bump revision, snapshot, and mirror to the
   * index. The markdown file is preserved for revision history; agents must
   * pass `includeDeleted` to see it again.
   */
  async softDelete(id: string): Promise<ArtifactRecord> {
    const indexed = getArtifactById(this.db, id);
    if (!indexed) {
      throw new SpegoError('ARTIFACT_NOT_FOUND', `Artifact not found: ${id}`, { id });
    }
    if (indexed.deletedAt) {
      // Idempotent: return the latest snapshot.
      const file = await readArtifactFile(indexed.path);
      return { ...file, path: indexed.path };
    }
    const current = await readArtifactFile(indexed.path);
    const fm = artifactFrontmatterSchema.parse({
      ...current.frontmatter,
      revision: current.frontmatter.revision + 1,
      updatedAt: new Date().toISOString(),
      deletedAt: new Date().toISOString(),
    });
    await atomicWriteFile(indexed.path, renderArtifactFile(fm, current.body));
    const snapPath = await writeRevisionSnapshot(this.paths, fm, current.body);
    upsertArtifact(this.db, fm, indexed.path, snapPath);
    return { frontmatter: fm, body: current.body, path: indexed.path };
  }

  // ------------------------------------------------------------- revisions

  listRevisions(id: string): Array<{ revision: number; path: string; createdAt: string }> {
    return listRevisions(this.db, id);
  }

  async readRevision(id: string, revision: number): Promise<ArtifactRecord> {
    const indexed = getArtifactById(this.db, id);
    if (!indexed) {
      throw new SpegoError('ARTIFACT_NOT_FOUND', `Artifact not found: ${id}`, { id });
    }
    if (revision === indexed.revision) {
      const current = await readArtifactFile(indexed.path);
      return { ...current, path: indexed.path };
    }
    const snap = await readRevisionSnapshot(
      this.paths,
      indexed.type,
      indexed.slug,
      revision,
    );
    return { frontmatter: snap.frontmatter, body: snap.body, path: snap.path };
  }

  // ---------------------------------------------------------------- rebuild

  async rebuildIndex(): Promise<RebuildReport> {
    const known = knownArtifactTypes(this.config);
    return rebuildIndex(this.db, this.paths, known);
  }

  // ------------------------------------------------------------ frontmatter

  /**
   * Direct accessor used by the export module. Resolves the latest record
   * for an indexed entry without re-querying SQLite.
   */
  async readForIndexed(indexed: IndexedArtifact): Promise<ArtifactRecord> {
    const file = await readArtifactFile(indexed.path);
    return { ...file, path: indexed.path };
  }

  /** Convenience accessor for callers that need the latest frontmatter. */
  static frontmatterFromRecord(record: ArtifactRecord): ArtifactFrontmatter {
    return record.frontmatter;
  }
}
