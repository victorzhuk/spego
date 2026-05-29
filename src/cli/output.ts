/**
 * Stdout/stderr output primitives for the CLI.
 *
 * Centralizes JSON vs human emission, deprecation warnings, and trailing-newline
 * handling so individual command actions never branch on `--json` more than once.
 */

export function emitJson(payload: unknown): void {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

export function emitHuman(text: string): void {
  process.stdout.write(text.endsWith('\n') ? text : `${text}\n`);
}

/** Emit `payload` as JSON when `json` is true, otherwise lazily render and emit human text. */
export function output(json: boolean, payload: unknown, human: () => string): void {
  if (json) {
    emitJson(payload);
  } else {
    emitHuman(human());
  }
}

/** Write a single-line `deprecated: <message>` warning to stderr in human mode only. */
export function deprecate(json: boolean, message: string): void {
  if (!json) {
    process.stderr.write(`deprecated: ${message}\n`);
  }
}
