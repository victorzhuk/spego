# Tasks

## 1. Resolve open decisions

- [x] 1.1 Confirm the sample threshold value with the user; update `specs/delivery-mirror/spec.md` in this change if it differs from three

## 2. Profile resolution

- [x] 2.1 Write failing table-driven cases in `test/delivery-mirror.test.ts` with hand-computed expected values: a pair with runs below the threshold prices from the seed, a pair at exactly the threshold prices from observation, a pair above it prices from the median, an even run count takes the midpoint, and runs recorded under another Flow do not count
- [x] 2.2 Write failing cases for independence: one tier priced from observation while another on the same board falls back to the seed, and a Flow with no seed and no runs reports unpriced
- [x] 2.3 Implement resolution in `src/delivery/mirror.ts` — aggregate recorded runs per Flow and Tier, apply the threshold, take the median, fall back to the seed — with the sample threshold as a named constant

## 3. Rung reporting

- [x] 3.1 Write failing cases asserting the rung value on every priced change: observed where the threshold is met, seed where it is not
- [x] 3.2 Carry the rung through to `--json` and render it in the human board alongside the hours column, fitting the existing panel geometry
- [x] 3.3 Write e2e specs in `test/cli.board.test.ts` once rendering settles: `--json` rung values, and human output for a board mixing both rungs

## 4. Docs

- [x] 4.1 Update the README board section explaining what a rung means and CHANGELOG `[Unreleased]`
- [x] 4.2 Full verification: `npm run lint`, `npm run typecheck`, `npm test`
