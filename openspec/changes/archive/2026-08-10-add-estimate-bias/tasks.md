# Tasks

## 1. Resolve open decisions

- [x] 1.1 Confirm with the user that bias corrects the seed rung only and leaves observed prices alone; update `specs/delivery-mirror/spec.md` in this change if the scope differs

## 2. Bias derivation

- [x] 2.1 Write failing table-driven cases in `test/delivery-mirror.test.ts` with hand-computed expected values: bias for a pair whose runs came in over their price, under it, and exactly on it; a pair with no runs reporting no bias; and an even run count taking the midpoint
- [x] 2.2 Implement bias per Flow and Tier in `src/delivery/mirror.ts`, recomputing the price each recorded run carried rather than reading a stored one

## 3. Correction

- [x] 3.1 Write failing cases: a seeded price is corrected by its pair's bias, an observed price is not, and a corrected price is clamped when bias exceeds the bound
- [x] 3.2 Apply the correction inside profile resolution with the clamp as a named constant beside the sample threshold

## 4. Warning

- [x] 4.1 Write failing cases for the warning boundary: bias inside the band raises nothing, bias outside it raises the warning naming the Flow and tier, and the warning appears in `MirrorChange.warnings` for affected changes
- [x] 4.2 Add the warning code, its place in `WARNING_ORDER`, and its aggregated human rendering in the warnings table
- [x] 4.3 Write e2e specs in `test/cli.board.test.ts`: `--json` carries bias per priced change and one warning entry per fact, human output aggregates them into one row

## 5. Docs

- [x] 5.1 Update the README board section on what the warning means and CHANGELOG `[Unreleased]`
- [x] 5.2 Full verification: `npm run lint`, `npm run typecheck`, `npm test`
