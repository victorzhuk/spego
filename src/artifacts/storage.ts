import fs from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
import { artifactFrontmatterSchema, type ArtifactFrontmatter } from './types.js';
import { SpegoError } from '../errors.js';

const FENCE_OPEN = /^---\r?\n/;
const FENCE_CLOSE = /\r?\n---\r?\n?/;

/** Render frontmatter + body to a single markdown string. */
export function renderArtifactFile(frontmatter: ArtifactFrontmatter, body: string): string {
  // Always quote string scalars so date-like values round-trip as strings
  // (YAML 1.1 implicit Date typing has bitten us before).
  const yaml = YAML.stringify(frontmatter, {
    lineWidth: 0,
    defaultStringType: 'QUOTE_DOUBLE',
    defaultKeyType: 'PLAIN',
  }).trimEnd();
  const trimmedBody = body.endsWith('\n') ? body : `${body}\n`;
  return `---\n${yaml}\n---\n\n${trimmedBody}`;
}

/** Parse a markdown file's text into frontmatter + body. */
export function parseArtifactFile(
  text: string,
  sourcePath: string,
): { frontmatter: ArtifactFrontmatter; body: string } {
  const openMatch = text.match(FENCE_OPEN);
  if (!openMatch) {
    throw new SpegoError(
      'VALIDATION_FAILED',
      `Missing frontmatter block in ${sourcePath}`,
      { path: sourcePath },
    );
  }
  const afterOpen = text.slice(openMatch[0].length);
  const closeMatch = afterOpen.match(FENCE_CLOSE);
  if (!closeMatch || closeMatch.index === undefined) {
    throw new SpegoError(
      'VALIDATION_FAILED',
      `Unterminated frontmatter block in ${sourcePath}`,
      { path: sourcePath },
    );
  }
  const yamlText = afterOpen.slice(0, closeMatch.index);
  const body = afterOpen.slice(closeMatch.index + closeMatch[0].length).replace(/^\n+/, '');

  let data: unknown;
  try {
    // `yaml` library defaults to YAML 1.2 / JSON-compatible scalars: ISO date
    // strings stay strings, which is what our Zod schema requires.
    data = YAML.parse(yamlText);
  } catch (err) {
    throw new SpegoError(
      'VALIDATION_FAILED',
      `Invalid YAML frontmatter in ${sourcePath}`,
      { path: sourcePath, cause: (err as Error).message },
    );
  }

  const result = artifactFrontmatterSchema.safeParse(data);
  if (!result.success) {
    throw new SpegoError('VALIDATION_FAILED', `Invalid frontmatter in ${sourcePath}`, {
      path: sourcePath,
      issues: result.error.issues,
    });
  }
  return { frontmatter: result.data, body };
}

/** Read and parse a markdown artifact file from disk. */
export async function readArtifactFile(absPath: string): Promise<{
  frontmatter: ArtifactFrontmatter;
  body: string;
}> {
  let text: string;
  try {
    text = await fs.readFile(absPath, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new SpegoError('ARTIFACT_NOT_FOUND', `Artifact file not found at ${absPath}`, {
        path: absPath,
      });
    }
    throw err;
  }
  return parseArtifactFile(text, absPath);
}

/**
 * Atomically write a markdown file: write to a temp sibling, fsync, rename.
 * Rename on the same filesystem is atomic on POSIX and Windows (ReplaceFile).
 */
export async function atomicWriteFile(absPath: string, contents: string): Promise<void> {
  await fs.mkdir(path.dirname(absPath), { recursive: true });
  const tmp = `${absPath}.${process.pid}.${Date.now()}.tmp`;
  const handle = await fs.open(tmp, 'w', 0o644);
  try {
    await handle.writeFile(contents, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await fs.rename(tmp, absPath);
  } catch (err) {
    // Clean up temp file if rename failed.
    await fs.unlink(tmp).catch(() => undefined);
    throw new SpegoError('WRITE_FAILED', `Failed to write artifact to ${absPath}`, {
      path: absPath,
      cause: (err as Error).message,
    });
  }
}
