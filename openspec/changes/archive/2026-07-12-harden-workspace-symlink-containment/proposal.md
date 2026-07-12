## Why

A cloned repository can ship `.spego`, `.spego/artifacts`, or `.spego/artifacts/<type>` as a git-tracked symlink pointing outside the workspace. Nothing in the engine lstat- or realpath-checks these directories, so `spego create`/`update` follows the link and writes attacker-chosen files outside the project (CWE-59), and reads/`index-rebuild` follow symlinked entries into files elsewhere on disk. Found in the 0.11.0 security review; this is the highest-severity open finding.

## What Changes

- Workspace open resolves the workspace root with `realpath` and rejects any `.spego` directory component that is a symlink, with a clear structured error.
- Every artifact write verifies the resolved target stays under the resolved workspace root before touching the filesystem.
- Artifact reads and `index-rebuild` reject symlinked entries under `.spego/artifacts` and `.spego/revisions`; rebuild reports them as invalid files instead of following them.
- `atomicWriteFile` removes its temp file when write/fsync fails before rename (currently only the rename failure path cleans up).
- Tests cover the three unexercised `parseArtifactFile` fence-error branches (missing opening fence, unterminated fence, malformed YAML) plus new symlink-rejection cases.

## Capabilities

### New Capabilities

- `workspace-containment`: all engine filesystem access stays inside the resolved workspace root; symlinked workspace directories and artifact entries are rejected with structured errors.

### Modified Capabilities

<!-- none: existing artifact-management/project-initialization requirements stay valid; containment is additive -->

## Impact

- `src/workspace/paths.ts`, `src/workspace/init.ts` — root resolution and symlink checks at open/init.
- `src/artifacts/storage.ts` — containment check before read/write, tmp cleanup on failed write.
- `src/index/indexer.ts` — reject symlinked entries during rebuild, report as invalid.
- `test/` — new symlink and fence-error cases.
- No CLI surface change; new `SpegoError` code for containment violations surfaces through the existing error envelope.
