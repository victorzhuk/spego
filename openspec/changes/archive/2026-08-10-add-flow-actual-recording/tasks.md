# Tasks

## 1. Resolve open decisions

- [x] 1.1 Confirm with the user that recorded actuals get their own writer rather than joining groom or sync, and pin the command name; update `specs/delivery-mirror/spec.md` and `specs/grooming-workflow/spec.md` in this change before writing code

## 2. Epic metadata

- [x] 2.1 Write failing cases in `test/artifact-schemas.test.ts` for `actuals`: a valid entry list, a missing `flow`, an empty-string `flow`, negative hours, and non-finite hours
- [x] 2.2 Add `actuals` to the epic schema and the meta summary line in `src/artifacts/schemas.ts`

## 3. Recording command

- [x] 3.1 Write failing e2e specs alongside `test/cli.sync.test.ts`: recording appends an entry, a second run accumulates rather than replaces, an unknown change fails with a named error, a missing epic fails with a named error, and a stale `--expected-revision` fails without writing
- [x] 3.2 Implement the command in `src/cli/commands/`, writing through the existing artifact path with optimistic concurrency and honoring `--json`
- [x] 3.3 Verify the command writes nothing under `openspec/` and mutates no other artifact

## 4. Mirror exposure

- [x] 4.1 Write failing cases in `test/delivery-mirror.test.ts`: recorded runs and their total appear on the derived change, a change with no actuals reports none, and runs from two Flows keep their attribution
- [x] 4.2 Carry recorded actuals and their total onto `MirrorChange` in `src/delivery/mirror.ts` and into `--json`

## 5. Surface text and docs

- [x] 5.1 Update the groom workflow text for the amended sole-writer rule; regenerate skills with `spego skills` and commit the regenerated files
- [x] 5.2 Update the README command table and CHANGELOG `[Unreleased]`
- [x] 5.3 Full verification: `npm run lint`, `npm run typecheck`, `npm test`
