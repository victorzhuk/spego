# Tasks

## 1. Bias reference

- [x] 1.1 Write failing cases in `test/delivery-mirror.test.ts`: a pair with enough runs to price from observation reports the ratio of that median to its config seed, not parity; a pair with one run reports the same ratio against the same seed; a pair whose Flow has no seed reports no bias
- [x] 1.2 Take the reference in `deriveBias` from the Flow's seed for every pair in `src/delivery/mirror.ts`, and correct the function's contract comment

## 2. Evidence guard on the warning

- [x] 2.1 Write failing cases in `test/delivery-mirror.test.ts`: a pair below the sample threshold raises no `stale-profile` however far its bias sits from parity, while still reporting that bias and its corrected price; a pair at or above the threshold whose observed median leaves the band raises the warning naming Flow, tier, and direction
- [x] 2.2 Guard the warning loop in `src/delivery/mirror.ts` with the ladder's sample threshold

## 3. Pricing is unchanged

- [x] 3.1 Assert in `test/delivery-mirror.test.ts` that the seeded correction and its clamp are unaffected: a thin pair's seeded price is still corrected by the clamped bias, and an observed price is still uncorrected

## 4. End-to-end surfaces

- [x] 4.1 Split the bias fixture in `test/cli.board.test.ts`: one workspace below the threshold for the correction and `--json` bias assertions, one at or above it for the warning and the aggregated human Warnings row
- [x] 4.2 Confirm the human Warnings row still aggregates several drifted pairs into one row and `--json` still carries one entry per pair

## 5. Docs and verification

- [x] 5.1 Update the bias section of `docs/estimation.md` — the reference is the declared seed, the warning waits for the sample threshold — and CHANGELOG `[Unreleased]`
- [x] 5.2 Full verification: `npm run lint`, `npm run typecheck`, `npm test`
