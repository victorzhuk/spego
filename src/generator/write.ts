import fs from 'node:fs/promises';
import path from 'node:path';
import { isSpegoGenerated, isLegacySpegoGenerated, wrapWithMarker } from './markers.js';
import { GENERATOR_VERSION } from './types.js';
import type { FileAction } from './types.js';

export async function writeGeneratedFile(
  absPath: string,
  content: string,
): Promise<FileAction> {
  const marked = wrapWithMarker(content, GENERATOR_VERSION);
  await fs.mkdir(path.dirname(absPath), { recursive: true });

  let existing: string | null = null;
  try {
    existing = await fs.readFile(absPath, 'utf8');
  } catch {
    // file does not exist — will create
  }

  if (existing !== null) {
    if (!isSpegoGenerated(existing) && !isLegacySpegoGenerated(existing)) {
      return 'skipped';
    }
    if (marked.trim() === existing.trim()) {
      return 'unchanged';
    }
    await fs.writeFile(absPath, marked, 'utf8');
    return 'updated';
  }

  await fs.writeFile(absPath, marked, 'utf8');
  return 'created';
}
