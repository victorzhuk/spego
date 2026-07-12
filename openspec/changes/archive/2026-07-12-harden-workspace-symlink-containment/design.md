## Context

Security review of 0.11.0 found a CWE-59 class issue: no code path lstat- or realpath-checks `.spego` directory components before reads/writes. `atomicWriteFile` (`src/artifacts/storage.ts:94`) does `fs.mkdir(path.dirname(absPath), { recursive: true })` then `fs.rename(tmp, absPath)` — both follow directory symlinks. `ensureDir` (`src/workspace/init.ts:39`) swallows `EEXIST` on a symlinked component. Reads (`storage.ts:78`, `indexer.ts:210`) follow symlinks too. Rename onto a symlinked leaf file replaces the link inode, so the leaf-file write case is already safe; only directory components and read paths are exploitable.

## Goals / Non-Goals

- Goal: no engine read or write ever follows a symlink under `.spego`; violations fail with structured errors; rebuild degrades gracefully.
- Goal: keep the fix inside `workspace/` + `artifacts/storage.ts` + `index/indexer.ts`; no CLI surface change.
- Non-goal: sandboxing beyond `.spego` (generator writes to `.claude`/`.opencode` are separate trust surface, unchanged here).
- Non-goal: TOCTOU-proof guarantees against a concurrent local attacker; threat model is a malicious cloned repo, not a hostile local process racing the CLI.

## Decisions

- Containment check = `fs.realpath(workspaceRoot)` once at engine open, then per-write: resolve the target parent or its nearest existing ancestor via realpath and require it remains under the resolved root. This accepts a valid symlinked project-root alias while rejecting escaping or dangling directory links.
- Symlink rejection at open/init uses `lstat` on engine-owned directories (`.spego`, `artifacts`, `revisions`, `index`, and type dirs) and file leaves (`config.yaml`, `spego.db`) before I/O. This is a small explicit allowlist with clear errors.
- Reads use `lstat`-then-open instead of realpath containment: a symlinked leaf `.md` is rejected outright (per spec), which is stricter and cheaper than checking where it points.
- New `SpegoError` code `WORKSPACE_CONTAINMENT` (exit path follows existing `VALIDATION_FAILED` envelope) so agents get a machine-readable cause.
- Rebuild treats symlinked entries as invalid files (existing `invalidFiles` reporting) rather than aborting — matches the artifact-validation continue-on-error contract.

## Risks / Trade-offs

- [realpath cost per write] → one extra syscall per artifact write; negligible for a CLI writing single files.
- [legit symlink workflows broken] → a user who intentionally symlinks `.spego` to shared storage loses that setup; accepted, documented in changelog as a security hardening.
- [TOCTOU window between check and write] → out of scope per threat model; the check defeats the committed-symlink vector, which is the realistic attack.

## Migration Plan

Pure hardening; no data or config migration. Ship in a minor release with a changelog Security note. Rollback = revert commit.

## Open Questions

None.
