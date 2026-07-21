## Why

`spego mirror` (and `spego epics list`) spawn one `openspec status --change <name> --json` subprocess per active change, awaited serially in `listEpics` (src/delivery/openspec-adapter.ts). Measured on a synthetic workspace: ~950 ms per change, linear — 20 changes → 19.7 s. The filesystem fallback path (`parseTasks`) completes the same 20-change workspace in 0.17 s. The subprocess adds ~114× latency for data spego already derives from `tasks.md`, and makes correctness silently dependent on `openspec` being on PATH (a hang costs N × 5 s timeout).

## What Changes

- Adapter resolves epic status from the filesystem (`parseTasks` on `tasks.md`) as the primary path; the per-change `openspec status` subprocess call is removed from `listEpics`/`getEpic`.
- Status semantics preserved: `done === total` → `completed`, `total === 0` → `planning-incomplete`, otherwise `active` — identical to what the fallback already produces.
- `discoverChanges` no longer runs twice per mirror render: the discovered list is shared between the adapter call and `collectMirrorInput` instead of re-scanned.
- `discoverChanges` internal per-entry stat/read loop parallelized with `Promise.all`.

Non-goal: parallelizing subprocess spawns (Fix B) — the subprocess is removed, not made concurrent. Non-goal: changing any mirror rendering, warning, or next-change logic.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `delivery-adapters`: adapter status resolution SHALL derive from filesystem state without spawning per-change CLI subprocesses.

## Impact

- `src/delivery/openspec-adapter.ts` (remove `resolveEpicStatus` CLI path), `src/delivery/openspec-discover.ts` (remove `fetchCliStatus`, parallelize discovery), `src/delivery/openspec-parse.ts` (status derivation primary), `src/cli/commands/mirror.ts` (single discovery), `src/cli/commands/delivery.ts` (same adapter path for `epics`/`tasks`).
- Removes the implicit runtime dependency on `openspec` being installed and on PATH for mirror/epics commands.
- Tests: adapter unit tests, mirror/e2e suites; new regression test asserting mirror completes N changes within a time budget without spawning `openspec`.
