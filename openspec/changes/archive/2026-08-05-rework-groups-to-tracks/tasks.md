# Tasks

## 1. Epic track metadata

- [x] 1.1 Add `track: z.string().min(1).optional()` to the epic schema and extend `META_SHAPES.epic` in `src/artifacts/schemas.ts`; cover valid/empty-string cases in `test/artifact-schemas.test.ts`

## 2. Mirror: track groups + execution order

- [x] 2.1 Replace wave computation in `src/delivery/mirror.ts`: `group` = epic `meta.track` | `?` (pending, untracked) | `—` (satisfied); delete `computeWave`, `renderGroup`, `Wave`
- [x] 2.2 Sort each derived sprint's `changes` by Kahn's over intra-sprint dep edges, ready set and cycle leftovers in stored list order; `ungrouped` stays slug-sorted
- [x] 2.3 Remove `deliveryGroupLabel` from `src/cli/status.ts` and its call sites in `src/cli/commands/board.ts` (group cell renders the raw value); drop its tests in `test/cli.status.test.ts`
- [x] 2.4 Update `test/delivery-mirror.test.ts`: track group values, execution-order sort (stored `[b, a]` with `b`→`a` dep derives `[a, b]`), cycle stored-order fallback, `next` respects sorted order
- [x] 2.5 Update `test/cli.board.test.ts` / `test/cli.epics-tasks.test.ts` fixtures asserting `gNNN`/letter groups or stored sprint order

## 3. Surface text and docs

- [x] 3.1 Regenerate skills (`spego skills`) after META_SHAPES/groom text changes; commit regenerated files
- [x] 3.2 Update README (group semantics, `?` marker, execution order), CONTEXT.md glossary (Group = conflict track), CHANGELOG `[Unreleased]` with both BREAKING notes
- [x] 3.3 Full verification: `npm run lint`, `npm run typecheck`, `npm test`
