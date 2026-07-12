## 1. Workspace open/init guards

- [x] 1.1 Add `WORKSPACE_CONTAINMENT` error code to `src/errors.ts` and surface it through the CLI error envelope
- [x] 1.2 Resolve workspace root with `fs.realpath` at `ArtifactEngine.open`; `lstat`-reject symlinked `.spego`, `.spego/artifacts`, `.spego/artifacts/<type>`, `.spego/revisions` (`src/workspace/paths.ts`)
- [x] 1.3 Make `ensureDir` in `src/workspace/init.ts` fail on symlinked components instead of swallowing them

## 2. Storage containment

- [x] 2.1 In `atomicWriteFile`, realpath-verify the target's parent stays under the resolved root before mkdir/write (`src/artifacts/storage.ts`)
- [x] 2.2 Reject symlinked leaf files on read (`lstat` before `fs.readFile` in `readArtifactFile`)
- [x] 2.3 Unlink the temp file when write/fsync throws before rename

## 3. Index rebuild

- [x] 3.1 In `rebuildIndex`/`reindexRevisions`, `lstat` each entry; report symlinks in `invalidFiles` with a symlink-specific error instead of reading them (`src/index/indexer.ts`)

## 4. Tests

- [x] 4.1 Symlinked `.spego`/`artifacts`/`<type>` dir → open/init/create fail with `WORKSPACE_CONTAINMENT`, nothing written outside root
- [x] 4.2 Symlinked artifact `.md` → read/view fail; `index-rebuild` lists it in `invalidFiles` and continues
- [x] 4.3 Fence-error branches of `parseArtifactFile`: missing opening fence, unterminated fence, malformed YAML each reported via `invalidFiles[].error`
- [x] 4.4 Failed write/fsync leaves no `.tmp` file behind
