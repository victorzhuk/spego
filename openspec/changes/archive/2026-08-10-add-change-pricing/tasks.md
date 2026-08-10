# Tasks

## 1. Resolve open decisions

- [x] 1.1 Confirm with the user how a change with no `tier` renders in the `hours` column and whether it counts toward its sprint total, plus the rounding and display unit; update `specs/delivery-mirror/spec.md` in this change before writing code

## 2. Config: flows block

- [x] 2.1 Write failing tests in `test/init.test.ts` for the `flows` block: valid config parses, `default` naming no profile fails, a profile missing a tier fails, negative hours fail
- [x] 2.2 Add the `flows` schema to `src/workspace/config.ts` — `default`, `profiles` per Flow keyed by tier, shared `human` table — with the fixed five-tier scale

## 3. Epic metadata

- [x] 3.1 Write failing cases in `test/artifact-schemas.test.ts` for epic `tier` (enum, optional) and `flow` (non-empty string, optional)
- [x] 3.2 Add both fields to the epic schema and the meta summary line in `src/artifacts/schemas.ts`

## 4. Pricing derivation

- [x] 4.1 Write failing table-driven cases in `test/delivery-mirror.test.ts` with hand-computed expected values: tier priced against the default Flow, a per-epic `flow` override selecting another profile, human estimate from the shared table, unknown Flow name, epic without `tier`, and the rung reported on every priced change
- [x] 4.2 Write failing cases for sprint totals: sum over pending changes, done and completed excluded, an empty sprint, and a sprint whose changes are all satisfied
- [x] 4.3 Extend `MirrorChange` and `MirrorSprint` in `src/delivery/mirror.ts` with the derived figures and the rung; thread resolved `flows` config through `MirrorInput` and its call sites in `src/delivery/load.ts`

## 5. Rendering and JSON

- [x] 5.1 Add the `hours` column to the default board's change table and the remaining total to each sprint panel in `src/cli/commands/board.ts` / `src/cli/render.ts`, respecting the existing panel geometry and the untruncatable `change` column
- [x] 5.2 Write e2e specs in `test/cli.board.test.ts` once the column and total render: `--json` carries both estimates, the rung, and the sprint total; `--plain` output is ANSI-free; a narrow terminal still shows every change slug in full

## 6. Groom and surface text

- [x] 6.1 Update the groom workflow text so the analyze phase judges and persists `tier`; regenerate skills with `spego skills` and commit the regenerated files
- [x] 6.2 Update the README board section and CHANGELOG `[Unreleased]`
- [x] 6.3 Full verification: `npm run lint`, `npm run typecheck`, `npm test`
