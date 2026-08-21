# Ask for the size while the change is being written

## Why

A Size Tier only reaches an epic when someone grooms, so a freshly proposed change sits unpriced until the next grooming session — exactly when a maintainer is deciding whether to schedule it. The judgment is cheapest at authoring time, when the proposal's scope is already in the author's head, and it is the moment the question is least likely to be skipped.

OpenSpec supports project-local schema forks, so the prompt can live in change authoring without spego writing anything under `openspec/` and without patching a third-party package.

## What Changes

- The project forks the `spec-driven` schema locally and adds an estimating step to change authoring: the author judges the change's Size Tier and persists it through the spego CLI onto the change's epic.
- The step writes through spego, not into OpenSpec files. OpenSpec owns the ritual, spego owns the state, so the experimental schema surface carries no data.
- Grooming keeps judging tiers for changes that arrive without one, so nothing depends on the fork being present.

No spec deltas — spego's own behavior is unchanged; the tier field, its validation, and its pricing all ship in `add-change-pricing`. `skip_specs: true`.

Depends on `add-change-pricing` (the `tier` field the step writes).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None.

## Impact

- A project-local OpenSpec schema created with `openspec schema fork spec-driven`, adding the estimating step's instruction and template.
- `openspec/config.yaml` — the project's schema selection.
- Docs: README section on authoring a priced change, CHANGELOG `[Unreleased]`.
- Nothing under `src/`; the CLI is untouched.

The `openspec schema` surface prints that it is experimental and may change. If it does, the fork is what breaks — the prompt disappears and every tier already recorded stays where it is, on the epic.
