export const SPEGO_GENERATED_MARKER = '<!-- spego-generated';

export function wrapWithMarker(content: string, version: number = 1): string {
  return `${SPEGO_GENERATED_MARKER} v${version} -->\n${content}`;
}

export function isSpegoGenerated(fileContent: string): boolean {
  return fileContent.startsWith(SPEGO_GENERATED_MARKER);
}
