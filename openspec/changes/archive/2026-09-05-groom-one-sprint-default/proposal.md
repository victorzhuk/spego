# Groom schedules one sprint by default

## Why

The groom workflow's `plan` phase proposes "sprint grouping as releasable, testable units" and stops there, so in practice every pending change gets a sprint at the first groom. That front-loads decisions the board cannot yet ground: sprint three is planned before sprint one has landed, its changes drift while they wait, and the next groom edits sprint plans instead of forming one. A single scheduled sprint with the rest in the backlog keeps every sprint plan a fresh judgment made when it is about to run.

## What Changes

- The groom `plan` phase schedules **one** sprint by default — the first releasable, testable unit — and leaves every other pending change in the backlog: an epic with no `sprint-plan`. The next sprint is formed at the groom that follows the scheduled sprint's close.
- Scheduling more than one sprint in a session stays available, but only on an explicit user ask; the workflow does not propose it.
- The `groom` workflow text in the registry, the generated skill it feeds, and `docs/workflows.md` say the same thing.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `grooming-workflow`: the plan phase's default output is one sprint plan; further sprints are formed at later grooms or on explicit request.

## Impact

- `src/workflows/registry.ts` — the `groom` entry's `plan` phase instruction.
- `docs/workflows.md` — the groom section.
- `test/workflows.registry.test.ts` — the groom entry's phase text.
- CHANGELOG `[Unreleased]`.
- No CLI, schema, board, or sync behavior changes; the board already renders changes without a sprint as `Ungrouped`.
