# Price from observed hours, falling back to the seed

## Why

Prices are still whatever was typed into config, and actuals are recorded but unread. The two need to meet: once a repo has seen enough runs of a given size under a given Flow, its own history is a better price than a declared guess, and it keeps getting better without anyone maintaining it.

The fallback matters as much as the derivation. A profile that silently mixes measured and declared numbers is a profile nobody can argue with, so every price says where it came from.

## What Changes

- A Flow Profile is derived rather than declared: for a Flow and Size Tier with enough recorded runs, the price comes from those runs; otherwise it falls back to the config seed.
- Every price reports its rung — observed or seed — in both human and JSON output, so a measured number is never mistaken for a guess.
- The sample threshold is fixed in code, like the Size Tier scale. A configurable threshold would let two projects disagree about what "enough evidence" means and would make a price depend on config read order.
- Recorded runs are attributed per Flow, so runs under one Flow never price another.

Depends on `add-flow-actual-recording` (recorded runs) and, through it, `add-change-pricing` (pricing and the rung field); its deltas are written against those changes' post-archive spec text.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `delivery-mirror`: pricing resolves down a ladder — observed hours, then the config seed — and reports the rung reached.

## Impact

- `src/delivery/mirror.ts` — profile resolution from recorded runs, per-Flow and per-Tier aggregation, rung reporting.
- `src/cli/commands/board.ts` — the rung shown alongside the hours column in human output.
- Tests: `delivery-mirror.test.ts` (aggregation and threshold boundaries), `cli.board.test.ts` (rung rendering and `--json` shape).
- Docs: README board section, CHANGELOG `[Unreleased]`.
