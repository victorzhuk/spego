import fs from 'node:fs/promises';
import { revisionFilePath, type WorkspacePaths } from '../workspace/paths.js';
import { atomicWriteFile, parseArtifactFile, renderArtifactFile } from '../artifacts/storage.js';
import type { ArtifactFrontmatter } from '../artifacts/types.js';
import { SpegoError } from '../errors.js';

/**
 * Persist a snapshot of an artifact at the given revision under
 * `.spego/revisions/<type>/<slug>.r<n>.md`.
 */
export async function writeRevisionSnapshot(
  paths: WorkspacePaths,
  frontmatter: ArtifactFrontmatter,
  body: string,
): Promise<string> {
  const dest = revisionFilePath(paths, frontmatter.type, frontmatter.slug, frontmatter.revision);
  await atomicWriteFile(dest, renderArtifactFile(frontmatter, body));
  return dest;
}

/** Read a previously snapshotted revision. */
export async function readRevisionSnapshot(
  paths: WorkspacePaths,
  type: string,
  slug: string,
  revision: number,
): Promise<{ frontmatter: ArtifactFrontmatter; body: string; path: string }> {
  const file = revisionFilePath(paths, type, slug, revision);
  let raw: string;
  try {
    raw = await fs.readFile(file, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new SpegoError(
        'REVISION_NOT_FOUND',
        `Revision ${revision} not found for ${type}/${slug}`,
        { type, slug, revision, path: file },
      );
    }
    throw err;
  }
  const parsed = parseArtifactFile(raw, file);
  return { ...parsed, path: file };
}
