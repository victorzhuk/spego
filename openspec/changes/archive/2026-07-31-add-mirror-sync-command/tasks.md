## 1. Specification

- [x] 1.1 Run `openspec validate add-mirror-sync-command --strict` and resolve any structural errors before any code lands.

## 2. Sync plan derivation (`src/delivery/sync.ts`, new)

- [x] 2.1 Define `SyncAction` (`create-epic` | `close-sprint`) and `SyncPlan { actions: SyncAction[]; remaining: MirrorWarning[] }`.
- [x] 2.2 `deriveSyncPlan(board: MirrorBoard, input: MirrorInput): SyncPlan` — pure, no I/O, mirroring how `deriveMirror` is a pure function over `MirrorInput`:
  - `create-epic` for every change carrying the `ungroomed-change` warning; title from `MirrorChange.title` (itself falling back to the slug).
  - `close-sprint` for every sprint where `status !== 'closed'` and `sprint.complete` is true (the same predicate `closable-sprint` already uses).
  - Every other warning code (`orphan-epic`, `dangling-dep`, `dep-cycle`, `out-of-order-dep`) lands in `remaining`, untouched.
- [x] 2.3 Do not derive an "unlink archived change from sprint" action — that is deliberately out of scope; a shipped sprint's change list is history, not drift (see the `archived-in-sprint` gate in task 4).

## 3. `archived-in-sprint` gate (`src/delivery/mirror.ts`)

- [x] 3.1 Skip emitting `archived-in-sprint` for a sprint whose `status === 'closed'`; keep emitting it for `planned`/`active` sprints holding an archived change.
- [x] 3.2 Update the exact-ordered-warning-code-list assertion in `test/delivery-mirror.test.ts` to reflect the gate — this is the one existing assertion this change legitimately moves.

## 4. `spego sync` command (`src/cli/commands/sync.ts`, new)

- [x] 4.1 `spego sync [--dry-run] [--cwd <dir>]`, global `--json`. Load state via the existing `loadBoardState`, call `deriveSyncPlan`.
- [x] 4.2 Apply `create-epic` via `engine.create({ type: 'epic', ... })`, going through the same `assertEpicSlugActive` check `spego create --type epic` already runs.
- [x] 4.3 Apply `close-sprint` via `engine.update(id, { expectedRevision, meta: { status: 'closed' } })` — reject (not silently skip) on a stale-revision conflict, same as every other update path.
- [x] 4.4 `--dry-run` derives the plan and prints it without calling `engine.create`/`engine.update`.
- [x] 4.5 Human output: an action table (action, target, detail). `--json` output: `{ actions, applied, remaining }`.
- [x] 4.6 Register in `src/cli.ts`; add a `COMMAND_REGISTRY` entry in `src/command-meta/registry.ts` so `spego commands` and skill generation pick it up.

## 5. Workflow and ownership docs

- [x] 5.1 `src/workflows/registry.ts`: rewrite groom's phase 2 to run `spego sync` first for the mechanical subset, then do judgment-only work (orphan disposition, deps, gaps, grouping). Run `spego skills` afterwards to regenerate `.claude/skills/spego-groom/SKILL.md`.
- [x] 5.2 Amend `.spego/artifacts/decision/mirror-state-per-epic-markdown-derived-graph-groom-sole-writer.md` via `spego update --expected-revision` (not a hand edit): groom owns judgment, `spego sync` owns mechanical reconciliation; the CLI still never mutates on render.
- [x] 5.3 `CONTEXT.md`: update the **Groom** entry to match.
- [x] 5.4 `README.md`: scope the "sprint closes require explicit confirmation" sentence to the groom workflow, and state that `spego sync` closes deterministically with `--dry-run` as the preview. Add one line distinguishing `spego sync` (mirror reconciliation) from OpenSpec's own `sync`/`/opsx:sync` (spec-delta merge) next to the adapter read-only paragraph.
- [x] 5.5 Check `src/cli/commands/workspace.ts`'s `DRIFT_CODES` literal against the new warning set — it does not derive from `WarningCode` and will not fail loudly if it drifts.

## 6. Tests

- [x] 6.1 `test/delivery-sync.test.ts`: `deriveSyncPlan` over fixtures — ungroomed change yields `create-epic`; finished non-closed sprint yields `close-sprint`; already-closed sprint yields nothing; an emptied-but-not-finished sprint yields nothing; orphan epics land in `remaining`, never in `actions`.
- [x] 6.2 `test/cli.sync.test.ts`: end-to-end — `--dry-run` writes nothing (assert via `git status`-equivalent file-mtime/listing check on the workspace); a real run creates the epic file and bumps the sprint-plan revision; a second run is a no-op; `--json` shape; a stale-revision conflict during apply is rejected, not silently skipped.
- [x] 6.3 `test/delivery-mirror.test.ts`: `archived-in-sprint` absent for a closed sprint holding an archived change, present for a planned/active one.

## 7. Documentation

- [x] 7.1 CHANGELOG `[Unreleased]` → `Added`: `spego sync` command. `Changed`: `archived-in-sprint` no longer fires for closed sprints (note this is an agent-facing `--json` change, unlike the companion rendering change).
