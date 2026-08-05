# Design

## Context

See proposal.md — Why. Current mechanics that shape the approach:

- `renderBoard` (src/cli/commands/board.ts) builds one width set for all sprint panels via `columnWidths(BOARD_COLUMNS, rows, { maxWidth: 36, totalWidth })`; the shrink loop trims the widest column first, so `change`, `gaps`, and `title` degrade together and the slug truncates even on wide terminals.
- `deriveMirror` (src/delivery/mirror.ts) emits `archived-in-sprint` per archived change in a non-closed sprint; `aggregateWarningRows` (board.ts) has a grouping case for it.
- `deriveSyncPlan` (src/delivery/sync.ts) is pure and keys off warning codes; application lives inline in the `spego sync` command action (src/cli/commands/sync.ts).
- The artifact engine already has `softDelete(id)` with revision bump + snapshot; `engine.list` excludes soft-deleted artifacts, so a retired epic drops out of mirror input naturally.

## Goals / Non-Goals

Goals:
- Change slug always fully readable in the default board.
- One-glance signal density: counts on the board, prose in `--gaps`.
- Archive lifecycle produces zero permanent warnings: everything mechanical self-heals via `spego sync` (or `board --sync`).

Non-Goals:
- No redesign of `--gaps` / `--graph` views (they stay the detail surfaces, full text).
- No change to `--json` payload shapes for board or sync beyond the disappearance of the `archived-in-sprint` code.
- No auto-mutation on plain `spego board` — the read-only-render invariant stands; `--sync` is explicit opt-in.
- No sprint status lifecycle work (planned→active flips stay manual/groom-owned).

## Decisions

1. **`signals` is a render-time formatting of existing arrays, not new mirror state.** `MirrorChange` keeps `blockers`/`gaps`/`missing`; board.ts formats `1 blk · 2 gap · 1 mis` (nonzero categories only, `—` when clean). Alternative — adding a `signals` field to the mirror — rejected: it would duplicate derived state into the JSON contract for a purely human concern.

2. **Column protection instead of a bigger cap.** `columnWidths` gains `opts.protect?: number[]` — column indexes whose width never shrinks below natural size (and is not capped by `maxWidth`). Board protects `change`. Alternative — raising `maxWidth` — rejected: any fixed cap re-creates the bug on longer slugs. On absurdly narrow terminals the table may exceed the budget; the panel grows rather than the slug truncating (spec guarantee).

3. **`retire-epic` keys off `orphan-epic` with `details.reason === 'archived'`.** The plan carries `{ kind: 'retire-epic', slug, id }`; the epic id comes from `MirrorInput.epics`. Application calls `engine.softDelete(id)` — reversible (snapshot kept), and idempotent for free since deleted epics vanish from `engine.list`, so the warning is gone on the next derive. Missing-reason orphans stay in `remaining`. Alternative — marking the epic `meta.status: completed` instead of deleting — rejected: the change's archived state already forces `completed`; keeping a live artifact would keep it in `spego epics` output and require a new suppression rule.

4. **Sync application extracted, reused by `board --sync`.** The apply loop moves from the sync command action into an exported `applySyncPlan(engine, plan)` (same file or `delivery/` helper); `spego board --sync` runs derive → apply → re-derive → render. Alternative — board shelling out to the sync command — rejected: same process, no reason.

5. **`archived-in-sprint` removed at the type level.** Drop the member from `WarningCode`, the emission loop, its aggregation case, and its sort slot; the compiler finds stragglers. JSON consumers watching for that code stop seeing it — noted in CHANGELOG as behavior change.

6. **Footer hints are derived, not stored.** Board computes `deriveSyncPlan` (pure) on the already-loaded state for the `N mechanical fixes — run spego sync` line, and reuses the changes' signal arrays for the `spego board --gaps` hint. Both render dim, above the existing `Suggestion:` line.

7. **Sprint panel title `<title> · <status> · <slug>`.** Sprint titles already self-describe (`Sprint 5: …`), so the leading `Sprint <slug> — ` prefix was pure duplication; the slug stays because commands take it.

## Risks / Trade-offs

- [JSON consumers matching `archived-in-sprint`] → code disappears from payloads; called out as BREAKING-adjacent in CHANGELOG; no other shape changes.
- [Auto-retire deletes judged epic content (deps/links/gap notes)] → soft delete with snapshot, restorable; fires only when the backing change is archived, i.e. the epic's job is done.
- [Protected change column on very narrow terminals] → table can exceed the terminal width and wrap; accepted — readability of the identifier wins over border aesthetics at 60 columns.
- [`board --sync` writes under a command previously guaranteed read-only] → gated behind an explicit flag; default path untouched, spec updated accordingly.

## Migration Plan

Single release: implementation + spec deltas + CHANGELOG `[Unreleased]` entries (board table layout change, warning-code removal, new sync action and flag). Update the `sync` command description in `src/command-meta/registry.ts` ("…retire epics of archived changes") and regenerate agent skills (`spego skills`) so `spego-sync`/`spego-groom` skill text matches. No data migration: retiring existing stale epics happens the first time users run `spego sync`.
