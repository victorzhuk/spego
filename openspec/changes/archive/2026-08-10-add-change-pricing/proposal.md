# Price changes and sprints from a declared flow profile

## Why

The board says what to pick up and what blocks it, never how long any of it takes. A sprint cannot answer when it will be done, and the overhead of a heavier delivery flow — planning fan-out, isolated worktree, review fan-out, test floor — is invisible, so nobody can tell whether it earns its keep. Hand-coding estimates do not transfer: the same change prices differently under different flows, so an absolute number carries no meaning.

This is the tracer bullet for change estimation. It prices changes from numbers a maintainer declares, end to end — epic metadata through derivation to the rendered board — and leaves every later slice to make those numbers better rather than to make them exist.

## What Changes

- Epic metadata gains `tier` (the change's Size Tier) and an optional `flow` overriding which Flow Profile prices it.
- Workspace config gains a `flows` block: per-Flow seed tables mapping Size Tier to Flow Hours, the workspace default Flow name, and one Human Hours table shared across Flows.
- The mirror derives two figures per change — a Flow Estimate from the change's Flow profile and a Human Estimate from the human table — plus the source rung that produced them. Both are derived on render, never stored, like blockers.
- Each sprint carries the total Flow Estimate of its pending changes; done and completed changes do not count toward remaining work.
- The default board's change table gains an `hours` column, and each sprint panel reports its remaining total. `--json` carries both estimates, the rung, and the sprint total.
- The groom workflow judges and records `tier` per epic alongside deps, requires, links, gaps, and track.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `delivery-mirror`: pricing derivation, sprint totals, and the board's new column and per-panel total.
- `artifact-validation`: epic metadata contract gains `tier` and `flow`.
- `project-initialization`: workspace config gains the `flows` block and its validation.
- `grooming-workflow`: analyze phase judges and assigns `tier` per epic.

## Impact

- `src/workspace/config.ts` — `flows` block schema: per-Flow seed tables, default Flow name, human tier table.
- `src/artifacts/schemas.ts` — epic meta `tier` and `flow` fields plus the meta summary line that feeds generated skill docs.
- `src/delivery/mirror.ts` — price each `MirrorChange`, total each `MirrorSprint`, carry the source rung.
- `src/cli/commands/board.ts`, `src/cli/render.ts` — `hours` column and per-sprint total within the existing panel geometry.
- `src/generator/*` — regenerated agent skills picking up the epic meta summary and groom text.
- Tests: `delivery-mirror.test.ts`, `cli.board.test.ts`, `artifact-schemas.test.ts`, `init.test.ts` (config shape).
- Docs: README board section, CHANGELOG `[Unreleased]`.
- `CONTEXT.md` and `docs/prd/change-estimation.md` already carry the vocabulary and the decisions; `decision/change-estimation-groom-judged-tier-cli-priced-hours-flow-calibrated` records the trade-offs.
