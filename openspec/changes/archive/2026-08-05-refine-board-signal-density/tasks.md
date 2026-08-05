# Tasks

## 1. Mirror: drop archived-in-sprint

- [x] 1.1 Remove `archived-in-sprint` from `WarningCode`, `WARNING_ORDER`, and its emission loop in `src/delivery/mirror.ts`; fix compile fallout (aggregation case + discriminator in `src/cli/commands/board.ts`); also hand-remove the code from the untyped `DRIFT_CODES` set in `src/cli/commands/workspace.ts` (compiler will not catch it)
- [x] 1.2 Update `test/delivery-mirror.test.ts` and `test/cli.board.aggregate.test.ts`: archived change in a live sprint yields no warning; re-anchor the aggregation test on `orphan-epic`

## 2. Render: protected column + signals

- [x] 2.1 Add `protect?: number[]` to `columnWidths` opts in `src/cli/render.ts` (protected columns skip `maxWidth` capping and the shrink loop); cover in `test/cli.render.test.ts` including the over-budget case
- [x] 2.2 Rework the default board table in `src/cli/commands/board.ts` to `id, change, status, group, signals` with `formatSignals` (nonzero `N blk · N gap · N mis`, else `—`), protecting `change`; drop the removed columns from row building and styling
- [x] 2.3 Render sprint panel titles as `<title> · <status> · <slug>`
- [x] 2.4 Add footer hints: dim `spego board --gaps` line when any rendered change has a nonzero signal count; dim `N mechanical fix(es) — run spego sync` line from `deriveSyncPlan` action count
- [x] 2.5 Update `test/cli.board.test.ts`: new column set, untruncated slug at narrow width, signals cell values, both footer hints, unchanged `--json` payload

## 3. Sync: retire-epic + board --sync

- [x] 3.1 Add `RetireEpicAction` to `src/delivery/sync.ts`; map `orphan-epic` with `details.reason === 'archived'` (epic id resolved from `input.epics`) to it, keep missing-reason orphans in `remaining`; cover in `test/delivery-sync.test.ts`
- [x] 3.2 Extract the apply loop from `src/cli/commands/sync.ts` into exported `applySyncPlan(engine, plan, adapter)` (adapter pre-resolved by the caller); implement `retire-epic` via `engine.softDelete`; render it in sync output rows
- [x] 3.3 Add `--sync` flag to `spego board`: apply plan, re-derive, render; keep default path write-free
- [x] 3.4 Tests: `test/cli.sync.test.ts` retire flow + idempotence (second run zero actions); `test/cli.board.test.ts` `--sync` grooms then renders, plain `board` writes nothing

## 4. Surface text and docs

- [x] 4.1 Update `sync` and `board` descriptions in `src/command-meta/registry.ts` and regenerate skills (`spego skills`); commit regenerated skill/command files
- [x] 4.2 Update groom workflow text in `src/workflows/registry.ts` (sync phase + safety): sync now also retires archived-reason orphan epics; confirmation-gated disposition covers only missing-reason orphans; regenerated `spego-groom` skill is committed via 4.1
- [x] 4.3 Update README board/sync sections (new columns, signals, `--sync`, retired epics) and CHANGELOG `[Unreleased]` (board layout change, `archived-in-sprint` removal, `retire-epic`, `board --sync`)
- [x] 4.4 Full verification: `npm run lint`, `npm run typecheck`, `npm test`
