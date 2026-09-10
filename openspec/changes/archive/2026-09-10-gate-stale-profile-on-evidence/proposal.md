# Measure bias against the declared profile and warn only on evidence

## Why

`stale-profile` is the one warning that asks a maintainer to change a judgment — re-tier a change, or reseed a Flow Profile. It currently fires in exactly the case where neither action is justified, and stays silent in the case where one of them is.

Bias is defined as the ratio of recorded runs to the price those runs' changes were carrying. Once a pair has enough runs, that price *is* the median of those same runs, so the ratio is the median over itself: parity, on every board, forever. A pair with enough evidence to prove its seed wrong can therefore never raise the warning. Below the sample threshold the reference falls back to the seed, so a pair with one or two runs is the only pair that ever warns — and it is the pair whose price the mirror already corrects automatically, clamped, precisely because the evidence is too thin to act on by hand.

The result reads as a standing defect on a real board: two runs recorded against a Flow and Tier pair raise a warning that cannot be resolved, because the runs' changes are archived and their tier judgment is no longer editable, while the well-evidenced pairs on the same board report parity and say nothing about seeds that have drifted 25% from observation.

## What Changes

- Bias is measured against the declared config seed for the pair, always. It becomes what its name and its documentation claim: how far recorded runs have drifted from the profile the workspace declared, reportable for every pair with runs.
- `stale-profile` fires only once a pair holds enough recorded runs to price from observation — the same sample threshold the ladder already uses. A pair below it reports its bias and raises nothing.
- Pricing is unchanged. The correction still applies only to prices not taken from this workspace's own runs, which by construction are the pairs below the threshold, where the reference was already the seed. No estimate on any board moves.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `delivery-mirror`: the reference bias is measured against, and the evidence condition on the `stale-profile` warning.

## Impact

- `src/delivery/mirror.ts` — the bias reference in `deriveBias`, and the warning's evidence guard.
- Tests: `delivery-mirror.test.ts` (the warning cases are written on single-run pairs and must move to evidenced ones, plus new cases for a thin pair staying silent and an observed pair warning), `cli.board.test.ts` (its bias fixture serves both the correction assertions and the warning assertions and must split, since one needs a pair below the threshold and the other a pair above it).
- Docs: `docs/estimation.md` bias section, CHANGELOG `[Unreleased]`.
- No change to any recorded artifact, config shape, or command surface.
