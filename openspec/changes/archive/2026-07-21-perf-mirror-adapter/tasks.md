# Tasks

## 1. Regression test (red first)

- [x] 1.1 Adapter test asserting `listEpics`/`getEpic`/`listTasks` make zero child-process calls (spy on `node:child_process` `execFile`) across a multi-change workspace
- [x] 1.2 Status-semantics test: all-checked → `completed`, no tasks → `planning-incomplete`, mixed → `active`, driven by `tasks.md` fixtures with `openspec` absent from PATH
- [x] 1.3 Performance budget test: mirror/epics against a fixture workspace of ≥20 changes completes under a generous wall-clock budget (e.g. 2 s) — red before the fix

## 2. Filesystem-first status resolution

- [x] 2.1 Remove `fetchCliStatus` from `src/delivery/openspec-discover.ts` and the CLI path from `resolveEpicStatus` in `src/delivery/openspec-adapter.ts`; make `parseTasks` the sole status source
- [x] 2.2 Remove the `adapter-warning` "OpenSpec CLI status unavailable" fallback warning (no fallback remains); check and update any spec/test referencing that warning text

## 3. Single discovery + parallelized scan

- [x] 3.1 Share one `discoverChanges` result across `collectMirrorInput` in `src/cli/commands/mirror.ts` (no second scan); same for `src/cli/commands/delivery.ts` paths
- [x] 3.2 Parallelize `discoverChanges` per-entry stat/read with `Promise.all`

## 4. Verification

- [x] 4.1 `npm run typecheck && npm run lint && npm test` green
- [x] 4.2 Manual timing check on a ≥20-change workspace: `spego mirror --json` comparable to filesystem-only baseline (≤ ~0.5 s)
