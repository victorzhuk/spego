# Price a new repo from history it does not have

## Why

A Flow's cost is mostly a property of the Flow, not of the repo it runs in. Every new project nevertheless starts at the bottom rung, pricing from whatever seed was typed in, and spends its first weeks proving something the maintainer's other repos already know. The evidence exists; it is simply filed in the wrong place.

## What Changes

- Recorded runs also accumulate in a cross-project store keyed by Flow and Size Tier, so evidence gathered in one repo can price another.
- The ladder gains its middle rung: this repo's observations first, then cross-project observations, then the config seed. A repo with its own evidence never defers to the global picture.
- The cross-project rung is opt-in per workspace. A workspace that does not enable it prices from repo observations and the seed alone, and its output stays reproducible from the repo.
- The store's location is overridable, so the test suite and any reproducible run can point it somewhere hermetic instead of the real home directory.

Depends on `add-profile-ladder` (rung resolution) and, through it, on `add-flow-actual-recording` and `add-change-pricing`; its deltas are written against those changes' post-archive spec text.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `delivery-mirror`: the ladder's middle rung and its rung reporting.
- `project-initialization`: workspace config opts into cross-project pricing; the store location is overridable.

## Impact

- `src/workspace/config.ts` — the opt-in flag inside the `flows` block.
- `src/workspace/paths.ts` — resolution of the cross-project store root and its override.
- `src/delivery/mirror.ts` — the middle rung in profile resolution and its rung value.
- `src/cli/commands/` — the recording command appends to the cross-project store as well as to the epic.
- Tests: `delivery-mirror.test.ts`, `init.test.ts` (config shape), and every e2e spec that renders a board — all of which must run against an isolated store root.
- Docs: README configuration section, CHANGELOG `[Unreleased]`.
