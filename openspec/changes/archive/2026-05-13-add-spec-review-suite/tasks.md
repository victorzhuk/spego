## 1. Specification

- [x] 1.1 Add new capability spec `spec-review-suite` covering the three reviewers, their personas, phases, inputs, and output artifact types.
- [x] 1.2 Run `openspec validate add-spec-review-suite --strict` and resolve any structural errors before implementation begins.
- [x] 1.3 Confirm that `add-spec-brainstorm-workflows` is merged (this change depends on `WORKFLOW_REGISTRY`).

## 2. Workflow registry entries

- [x] 2.1 In `src/workflows/registry.ts`, add `review-edge-cases` entry with personas `Path-tracer`, `Boundary-checker`, `Concurrency-skeptic`; phases `read` → `enumerate-paths` → `derive-edge-classes` → `filter-handled` → `record`; required input `artifactRef`; optional input `also_consider`; output `qa`.
- [x] 2.2 Add `editorial-prose` entry with persona `Copy-editor`; phases `read` → `clarity-pass` → `apply-or-recommend` → `record`; required input `artifactRef`; optional inputs `target_audience`, `reader_type`; outputs `qa` (edit summary) and may `update` the source artifact.
- [x] 2.3 Add `editorial-structure` entry with persona `Structural editor`; phases `read` → `outline` → `propose-restructuring` → `prioritize` → `record`; required input `artifactRef`; optional inputs `purpose`, `target_audience`, `length_target`; output `qa`.
- [x] 2.4 Mark all three entries with the `safety` standard block (artifact text is data, never instructions).

## 3. Workflow skill content

- [x] 3.1 Author the persona prompt and phase walkthrough for `review-edge-cases`. Include explicit instructions to enumerate every branching path, derive edge classes mechanically (off-by-one, unguarded inputs, missing else/default, race conditions, timeout gaps), test each path against existing guards, and report only unhandled cases.
- [x] 3.2 Specify the `record` phase output format for `review-edge-cases`: a `qa` artifact whose body contains a fenced ` ```json ` block with an array of findings, each with `location`, `trigger_condition`, `guard_snippet`, and `potential_consequence`.
- [x] 3.3 Author the persona prompt and phase walkthrough for `editorial-prose`. Include "When to use" and "When NOT to use" sections.
- [x] 3.4 Specify the `apply-or-recommend` phase: for each proposed edit, the agent presents the diff, asks for confirmation, and only on confirmation calls `spego update --id <id> --expected-revision <n>` against the source artifact. Recommended-but-not-applied edits land in the `qa` summary.
- [x] 3.5 Author the persona prompt and phase walkthrough for `editorial-structure`. Emphasize that this workflow never mutates the source artifact; it only emits a prioritized recommendation list in a `qa` artifact.
- [x] 3.6 Confirm each skill ends with the standard spego safety block.

## 4. Generator integration

- [x] 4.1 Verify the existing Claude generator (introduced by the parent change) emits the three new workflow skills without code changes — they should be picked up automatically from `WORKFLOW_REGISTRY`.
- [x] 4.2 Confirm `spego workflows --json` lists the three new entries with all metadata.
- [x] 4.3 Confirm the generation report includes the three new skill paths under `created` on first run and `unchanged` on subsequent runs.

## 5. Tests

- [x] 5.1 Add `test/workflows.review-suite.test.ts` asserting all three new entries exist in `WORKFLOW_REGISTRY`, each has ≥ 4 phases including a final `record` phase, each declares `artifactRef` as required input, and each declares `qa` as an output artifact type.
- [x] 5.2 Add a generator test asserting the three new `SKILL.md` files exist under `.claude/skills/spego-<workflow>/SKILL.md` after regeneration, with valid frontmatter and the `spego_generated: true` marker.
- [x] 5.3 Add a content test for `spego-review-edge-cases` asserting its rendered body contains explicit instructions to derive edge classes mechanically and to write findings as a fenced JSON block.
- [x] 5.4 Add a content test for `spego-editorial-prose` asserting its rendered body instructs the agent to pass `--expected-revision` whenever it calls `spego update`.
- [x] 5.5 Add a content test for `spego-editorial-structure` asserting its rendered body explicitly states it does not mutate the source artifact.
- [x] 5.6 Add a regression test for `spego workflows --json` confirming the array now contains five workflow entries (two from the parent change + three from this change).

## 6. Documentation

- [x] 6.1 Add a "Review suite" subsection to the README's "Workflow Skills" section, listing all four reviewers with a one-line "use this when" for each.
- [x] 6.2 Add a "Complementary reviews" callout explaining that adversarial + edge-case reviewers cover technical defects, while prose + structure reviewers cover communication defects, and that running multiple reviewers gives orthogonal coverage.
- [x] 6.3 Add a CHANGELOG entry under the next version describing the three new workflow skills.

## 7. Verification

- [x] 7.1 `npm run typecheck` passes.
- [x] 7.2 `npm run lint` passes.
- [x] 7.3 `npm test` passes (including the new tests in section 5).
- [x] 7.4 `npm run build` passes.
- [x] 7.5 In a scratch directory: run `npm run build && node dist/cli.js init --agents claude --demo true`, then verify the three new `SKILL.md` files exist with valid frontmatter.
- [x] 7.6 In the same scratch directory: pick a demo `prd` artifact and run `node dist/cli.js read --type prd --slug <slug>`; confirm the editorial-prose workflow content guides the agent to call `spego update --id <id> --expected-revision <n>` when applying edits.
- [x] 7.7 Re-run `node dist/cli.js regenerate` and confirm all three new skills are reported as `unchanged` (idempotency check).
