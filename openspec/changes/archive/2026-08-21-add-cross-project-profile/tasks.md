# Tasks

## 1. Resolve open decisions

- [x] 1.1 Confirm the store's path, format, and whether runs carry the repo they came from; update `specs/delivery-mirror/spec.md` in this change if attribution is wanted

## 2. Isolation before anything reads the store

- [x] 2.1 Add the store-root override to `src/workspace/paths.ts` and set it to a temp directory in `test/_cli-helpers.ts` for every spawned CLI run, including specs written before this change; assert in a test that no run resolves the real user config directory

## 3. Config opt-in

- [x] 3.1 Write failing cases in `test/init.test.ts`: the opt-in flag parses, defaults to off, and a workspace with it off never resolves the store
- [x] 3.2 Add the flag to the `flows` block in `src/workspace/config.ts`

## 4. Store writes

- [x] 4.1 Write failing specs: recording a run appends to both the epic and the store, a store write failure reports an error while leaving the epic entry intact, and recording with the opt-in off still writes the store
- [x] 4.2 Implement the store append in the recording command, epic first and store second

## 5. Middle rung

- [x] 5.1 Write failing table-driven cases in `test/delivery-mirror.test.ts`: repo observations outrank cross-project ones, cross-project observations outrank the seed, the rung value distinguishes all three, and a workspace with the opt-in off never reaches the middle rung
- [x] 5.2 Implement the rung in `src/delivery/mirror.ts`, applying the same sample threshold and median rule as the repo rung
- [x] 5.3 Write e2e specs in `test/cli.board.test.ts` against a seeded temp store: `--json` rung values across all three rungs

## 6. Docs

- [x] 6.1 Update the README configuration section — the opt-in, the store, the override, and the reproducibility trade-off — and CHANGELOG `[Unreleased]`
- [x] 6.2 Full verification: `npm run lint`, `npm run typecheck`, `npm test`
