# Design

## Which rungs bias corrects

`docs/prd/change-estimation.md` leaves this open, and it is the crux of the change. Bias is the residual between recorded runs and the prices those changes carried. On the observed rung the price is already the median of those runs, so correcting it by their own residual double-counts the same evidence and oscillates.

Proposed: bias corrects every price not derived from this workspace's own recorded runs — the seed, and the cross-project rung once it exists — and leaves local observation alone. Stated the other way, bias exists to fix prices that were never measured here, and a local observation needs no proxy for itself. Phrasing the scope against local runs rather than against a named rung keeps it correct whether or not `add-cross-project-profile` has been applied.

Task 1.1 confirms this before implementation.

## What bias is

A ratio, per Flow and Size Tier: recorded hours over the hours those runs were priced at, aggregated by median for the same long-tail reason the profile uses a median. A ratio rather than a difference so that it transfers across tiers of different magnitude and stays meaningful when a seed is off by a factor rather than by a constant.

Computing it requires knowing what a change was priced at when it ran, which is not stored. It is recomputed: the price a change would have carried under the rung that applied, against the runs recorded for it. This keeps "derived, never stored" intact and makes bias reproducible from the same inputs as everything else.

## Correction bound

Bias is clamped before it is applied. An unclamped ratio lets one pathological change — a rebase disaster, an interrupted session left running — move a whole tier's prices several-fold. The clamp is a constant in code alongside the sample threshold; the warning fires on the unclamped value, so a bias large enough to be clamped is also large enough to be reported.

## Warning threshold

The warning fires when bias for a pair leaves a band around parity. It names the Flow, the tier, and the direction, and points at re-grooming rather than at a fix, because the repair is judgment: either the seed is wrong or the tier is being judged inconsistently, and only a person can tell which.

## Open questions to resolve before implementing

1. **Correction scope** — the proposal above; confirm before writing code.
2. **Clamp and warning band values.** Both are constants; proposed as a clamp at a factor of two either way and a warning band at 1.5, confirmed during implementation against whatever real bias the first recorded runs show.

## Rejected alternatives

- **Correcting every rung including observation** — simpler to describe, but applies an observation's own residual to itself.
- **Reporting bias without correcting anything** — leaves the maintainer to translate a warning into a config edit by hand, which is the chore the ladder exists to remove.
