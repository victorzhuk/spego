# Record what a change actually took

## Why

Prices from `add-change-pricing` are declared numbers with nothing to check them against. Twenty-nine changes have shipped and none of them left a record of what it cost, so the next estimate is no better informed than the first. Without observed hours there is no ladder to climb, no bias to compute, and no way to tell whether a heavier Flow earns its overhead.

Recording has to be free at the point of use. A maintainer will not run a stopwatch, and asking at groom time collects recall rather than measurement. The Flow already knows when it started and when it merged, so it reports its own elapsed time and nothing else changes.

## What Changes

- Epic metadata gains `actuals`: recorded runs, each carrying the Flow that ran and the Flow Hours it took.
- A new command records one run against a change — the Flow reports its own elapsed hours and its Flow name on a successful merge. Recording is additive: a change delivered across several runs accumulates entries rather than overwriting the last one.
- `--json` exposes recorded actuals per change and their total, so a consumer can compare what a change cost against what it was priced at.
- The sole-writer rule gains its first carve-out. Recorded actuals are neither judgment nor filesystem-derived state: they are measurements arriving from outside the workspace, so they get an explicit writer rather than being smuggled into groom.

Depends on `add-change-pricing` (epic metadata contract, Flow naming); its deltas are written against that change's post-archive spec text.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `artifact-validation`: epic metadata contract gains `actuals`.
- `delivery-mirror`: a command that records a Flow's measured hours against a change, and JSON exposure of recorded runs.
- `grooming-workflow`: the sole-writer rule carves out Flow-reported actuals.

## Impact

- `src/artifacts/schemas.ts` — epic meta `actuals` entries plus the meta summary line.
- `src/cli/commands/` — the recording command, its flag parsing, and its error contract.
- `src/delivery/mirror.ts` — carry recorded actuals and their total onto each derived change.
- `src/delivery/sync.ts` — reuse of the existing artifact-write path with `--expected-revision` semantics.
- Tests: `artifact-schemas.test.ts`, `delivery-mirror.test.ts`, a new CLI spec alongside `cli.sync.test.ts`.
- Docs: README command table, CHANGELOG `[Unreleased]`.
- External (outside this repo, applied directly): the `zapply` flow gains a merge-time call that reports its elapsed hours.
