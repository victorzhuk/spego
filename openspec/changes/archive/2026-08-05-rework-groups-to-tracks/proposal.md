# Rework groups from dependency waves to conflict tracks

## Why

The `group` column derives parallel-safety from declared dependency waves, so a board with sparse deps shows every change in wave `A` — asserting that everything can run in parallel when the changes in fact conflict on the same files and subsystems. Dependencies cannot express conflict; the mirror needs an explicit conflict lane. Separately, a sprint's changes render and are suggested in stored list order, not execution order, so the board's `next` and any agent scheduling from `--json` (e.g. zapply picking its follow-up change) disagree with the real dependency order.

## What Changes

- Epic metadata gains an optional `track` — a conflict lane judged by the groom workflow from file/subsystem overlap (e.g. `api-contract`, `storage`, `tma`).
- The `group` value becomes the track: **same group now means the changes conflict and must run sequentially; different groups are parallel-safe** — the inverse of the wave semantics it replaces. Pending changes without a track render `?`; satisfied changes keep `—`. **BREAKING**: the JSON `group` field carries the track name (or `?`/`—`) instead of the `gNNN` wave code; wave computation and the human letter rendering (`A`, `B`, …) are removed.
- A sprint's changes are ordered by execution order everywhere — human board, `--json` `sprints[].changes`, and the `next` suggestion: topological by declared deps among the sprint's members, stable to stored list order for ties and cycle members. **BREAKING** for `--json` consumers relying on stored order.
- The groom workflow's analyze phase assigns and maintains `track` on every epic alongside deps, requires, links, and gaps.

Depends on `refine-board-signal-density` (same rendering surface); its deltas are written against that change's post-archive spec text.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `delivery-mirror`: mirror derivation (group = track, execution-order sort, next follows sorted order) and rendering (group column shows the track name; letter mapping removed).
- `artifact-validation`: epic metadata contract gains `track`.
- `grooming-workflow`: analyze phase judges and assigns `track` per epic.

## Impact

- `src/delivery/mirror.ts` — replace wave computation with track resolution; intra-sprint topological sort; `next` unchanged in logic but consistent via sorted order.
- `src/artifacts/schemas.ts` — epic meta `track` field + meta summary line (feeds generated skill docs).
- `src/cli/status.ts` — remove `deliveryGroupLabel` letter mapping.
- `src/cli/commands/board.ts` — group column renders track values.
- Regenerated agent skills (`spego skills`) picking up the epic meta summary and groom text.
- Tests: `delivery-mirror.test.ts`, `cli.board.test.ts`, `artifact-schemas.test.ts`, `cli.status.test.ts` (label tests), sprint ordering coverage.
- Docs: README board section, CONTEXT.md glossary (`Group` → conflict track), CHANGELOG `[Unreleased]` with both BREAKING notes.
- External (outside this repo, applied directly): the user-global zapply skill consults `spego board --json` for a Phase 1 blocker guard and the Phase 8 next-change suggestion.
