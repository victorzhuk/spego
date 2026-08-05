# Refine board signal density and mechanical staleness sync

## Why

The board is the primary human surface, but on real workspaces it fails its main job: the change slug — the identifier every command takes — truncates at 36 characters, while three free-text columns (`blockers`, `gaps`, `missing`) and a mostly redundant `title` column spend the width on detail the `--gaps` view already owns. Separately, the normal OpenSpec archive lifecycle leaves permanent warning noise — `orphan-epic` for every archived change's epic and `archived-in-sprint` for every mid-sprint archive — that `spego sync` classifies as judgment-only and refuses to repair, so every render nags about drift with an obvious mechanical fix.

## What Changes

- Default board table becomes `id, change, status, group, signals`: the `title`, `blockers`, `gaps`, and `missing` columns are removed; `signals` is a single counters column (`1 blk · 2 gap · 1 mis`, `—` when clean). The `change` column is never truncated. A footer hint points at `spego board --gaps` whenever any signal counter is nonzero. **BREAKING** for the human table layout only — `--json` payload shape is unchanged.
- Sprint panel titles drop the duplicated `Sprint <slug> — <title> (<status>)` form and render `<title> · <status> · <slug>`.
- The `archived-in-sprint` warning is removed entirely: an archived change in a live sprint renders struck-through and `closable-sprint` covers end-of-sprint cleanup, so the warning only nagged about normal progress.
- `spego sync` gains a `retire-epic` action: an `orphan-epic` whose change is archived is soft-deleted mechanically; the `missing`-reason orphan (no backing OpenSpec change at all) stays judgment-only in the groom workflow.
- The board footer reports how many mechanical fixes are pending (`N mechanical fixes — run spego sync`), and a new `spego board --sync` flag applies the mechanical plan before rendering. The default board stays strictly read-only.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `delivery-mirror`: rendering requirement (column set, no-truncation guarantee, sprint panel title, sync hint footer, `--sync` flag), drift-warning requirement (drop `archived-in-sprint`), and sync requirement (`retire-epic` for archived orphans, idempotence extended to it).
- `grooming-workflow`: orphan-epic disposition splits — archived-reason orphans are retired mechanically by `spego sync`; groom's confirmation-gated disposition now covers only missing-reason orphans.

## Impact

- `src/cli/commands/board.ts` — column set, counters, footer hints, `--sync` flag.
- `src/cli/render.ts` — column width priority (exempt a column from shrinking).
- `src/delivery/mirror.ts` — remove `archived-in-sprint` emission and code.
- `src/delivery/sync.ts`, `src/cli/commands/sync.ts` — `retire-epic` action.
- Skill regeneration for `spego-groom` / `spego-sync` descriptions if their text changes.
- Tests: `cli.board.test.ts`, `cli.board.aggregate.test.ts`, `delivery-mirror.test.ts`, `delivery-sync.test.ts`, `cli.sync.test.ts`, `cli.render.test.ts`.
- Docs: README board/sync sections, CHANGELOG `[Unreleased]`.
