# Design

## Who owns the write

`docs/prd/change-estimation.md` leaves this open, and it is the one decision this change cannot avoid. The two existing writers both fail to fit:

- `spego-groom` persists judgment. An elapsed-hours measurement is not a judgment, and routing it through groom would mean a maintainer running a grooming session to record a number the machine already knows.
- `spego sync` reconciles mechanical state that it *derives* from the filesystem — missing epics, finished sprints. It never accepts external input, and giving it an input channel would blur what "mechanical" means.

Proposed: a third writer, narrow by construction. One command, one job, no judgment, no derivation — it appends a measurement supplied by the caller. The sole-writer requirement is amended to name it rather than being quietly violated.

Task 1.1 confirms this and the command's name with the user before implementation. The spec delta below is written against `spego record`; a different name changes the delta, not the design.

## Storage shape

```yaml
actuals:
  - flow: zapply
    hours: 1.75
  - flow: zapply
    hours: 0.5
```

A list of runs rather than a per-Flow running total. Bias needs to attribute observations to the Flow that produced them, a resumed change needs to accumulate, and a per-Flow total is a fold over the list whenever it is wanted. Storing the fold instead would throw away the run count that `add-profile-ladder` needs for its sample threshold.

Entries are append-only in practice. Nothing in this change removes one; a mistaken entry is corrected by editing the artifact, which leaves a revision behind like every other correction.

## Concurrency

The command writes through the existing artifact path with `--expected-revision`, so two flows merging at once fail loudly rather than silently dropping a run. A flow that loses the race retries against the current revision.

## Open questions to resolve before implementing

1. **Writer ownership and command name** — see above; confirm before writing code.
2. **What a flow reports when a change merges after being abandoned and resumed under a different Flow.** Accumulating entries across Flows is already supported by the shape, but whether the mirror should surface that a change was delivered by two Flows is undecided.

## Rejected alternatives

- **spego owning the clock** through start and stop marks: works for hand-delivered changes, but leaves open timing state, and a forgotten stop reads as a three-day change.
- **Deriving from git history**: measures calendar time, not work — proven wrong on this repo, where consecutive changes sit days apart and each lands as one squashed commit.
