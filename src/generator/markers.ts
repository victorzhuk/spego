import { GENERATOR_VERSION } from './types.js';

export const SPEGO_GENERATED_YAML_KEY = 'spego_generated';

export function wrapWithMarker(content: string, version: number = GENERATOR_VERSION): string {
  if (!content.startsWith('---\n')) {
    throw new Error('Cannot wrap marker: content must start with YAML frontmatter (---)');
  }
  return content.replace(
    '---\n',
    `---\n${SPEGO_GENERATED_YAML_KEY}: true\nspego_version: ${version}\n`,
  );
}

export function isSpegoGenerated(fileContent: string): boolean {
  if (!fileContent.startsWith('---\n')) return false;
  const endOfFrontmatter = fileContent.indexOf('\n---', 4);
  if (endOfFrontmatter === -1) return false;
  const frontmatter = fileContent.slice(0, endOfFrontmatter);
  return frontmatter.includes(`${SPEGO_GENERATED_YAML_KEY}: true`);
}

/** Detect old-style HTML comment markers from v1. */
export function isLegacySpegoGenerated(fileContent: string): boolean {
  return fileContent.startsWith('<!-- spego-generated');
}
