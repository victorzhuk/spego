# Correct estimates by how wrong they were

## Why

A ladder that reads observations still lets a whole rung stay wrong. Seeded prices never learn: a workspace can miss by a factor of two on every large change for a month and the board will keep reporting the same confident number, because nothing compares what was priced against what happened.

Overrunning should not merely be reported. The system already holds both halves — the price a change carried and the hours it took — so the correction can be automatic, and the only thing a maintainer has to notice is when the correction has grown big enough to mean the profile itself is wrong.

## What Changes

- Bias is derived per Flow and Size Tier: how far recorded runs sit from the price those changes were carrying.
- Bias corrects prices on the rungs that are not themselves observations. A price already taken from recorded runs is not corrected by the residual of those same runs.
- A new drift warning fires when bias for a pair passes a threshold, naming the Flow and tier and pointing at re-grooming.
- `--json` carries bias per priced change, so downstream consumers can weigh a price by how well that pair has been predicting.

Depends on `add-profile-ladder` (rungs and observed pricing) and, through it, on `add-flow-actual-recording` and `add-change-pricing`; its deltas are written against those changes' post-archive spec text.

Shares no requirement with `add-cross-project-profile` — this change adds its own requirement and modifies drift warnings, while that one modifies pricing — so the two may be applied in either order. The correction scope is phrased against this workspace's own recorded runs rather than against a named rung, so it holds whether or not the cross-project rung exists.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `delivery-mirror`: bias derivation, its effect on non-observed rungs, and a new drift warning.

## Impact

- `src/delivery/mirror.ts` — bias computation per Flow and Tier, correction applied during resolution, new warning code and its ordering in `WARNING_ORDER`.
- `src/cli/commands/board.ts` — the new warning rendered in the aggregated warnings table.
- Tests: `delivery-mirror.test.ts` (bias arithmetic, correction scope, warning boundary), `cli.board.test.ts` (warning rendering and `--json` shape).
- Docs: README board section, CHANGELOG `[Unreleased]`.
