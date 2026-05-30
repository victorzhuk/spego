/**
 * Per-task file gate.
 *
 * Each worker may persist edits only to the files listed in its sub-task
 * allow-list. Anything outside the list is reverted and the sub-task is
 * marked failed. Detection is pure (and unit-tested); reverting is delegated
 * to an injected callback so the policy stays decoupled from git/fs IO.
 */

function normalizePath(p: string): string {
  return p.replace(/^\.\//, '').replace(/\\/g, '/').replace(/^\/+/, '');
}

/** Return the changed paths that fall outside the allow-list. */
export function detectFileGateViolations(changedPaths: string[], allowed: string[]): string[] {
  const allow = new Set(allowed.map(normalizePath));
  return changedPaths.filter((p) => !allow.has(normalizePath(p)));
}

export interface FileGateResult {
  violations: string[];
}

/** Detect violations, revert each one through the supplied callback, and report them. */
export async function enforceFileGate(opts: {
  changedPaths: string[];
  allowed: string[];
  revert: (path: string) => Promise<void> | void;
}): Promise<FileGateResult> {
  const violations = detectFileGateViolations(opts.changedPaths, opts.allowed);
  for (const violation of violations) {
    await opts.revert(violation);
  }
  return { violations };
}
