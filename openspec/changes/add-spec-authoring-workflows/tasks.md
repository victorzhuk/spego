## 1. Specification

- [ ] 1.1 Add new capability spec `spec-authoring-workflows` covering `help`, `brainstorm-deep`, and `elicit` — their personas, phases, inputs, output behavior, and the safety/concurrency requirements.
- [ ] 1.2 Run `openspec validate add-spec-authoring-workflows --strict` and resolve any structural errors before implementation begins.
- [ ] 1.3 Confirm that `add-spec-brainstorm-workflows` is merged (this change depends on `WORKFLOW_REGISTRY`).

## 2. Workflow registry entries

- [ ] 2.1 In `src/workflows/registry.ts`, add `help` entry with persona `Guide`; phases `inspect-state` → `synthesize` → `recommend`; optional input `query`; no output artifact (recommendation is in-chat only).
- [ ] 2.2 Add `brainstorm-deep` entry with persona `Ideator`; phases `frame` → `expand` → `prune` → `record`; required input `topic`; optional inputs `target_count` (default 50) and `seedArtifactId`; output `brainstorm`.
- [ ] 2.3 Add `elicit` entry with persona `Refiner`; phases `read` → `select-method` → `propose` → `confirm` → `apply` → `summarize`; required input `artifactRef`; optional inputs `methods` (subset of clarify|sharpen|generalize|specialize|stress-test|contextualize|simplify|formalize) and `target_audience`; outputs `qa` (summary) and `update` (in-place mutation of source).
- [ ] 2.4 Mark all three entries with the standard `safety` block.
- [ ] 2.5 Allow `outputs` entries to declare a `kind: 'create' | 'update' | 'none'` field so registry consumers can distinguish read-only, create-only, and mutating workflows; default `create`.

## 3. Workflow skill content

- [ ] 3.1 Author the `spego-help` skill body. It SHALL instruct the agent to: (a) call `spego status --json`; (b) call `spego list --json`; (c) call `spego epics --json`; (d) apply a documented recommendation rubric mapping observed state to the next recommended workflow or CLI command; (e) present recommendations as an ordered list with the skill/command and a one-line rationale.
- [ ] 3.2 Embed the recommendation rubric inline. Cover at minimum: no `prd` exists → recommend `spego-brainstorm-party` then `spego create --type prd`; `prd` exists but no `architecture` → recommend `spego-elicit` on the `prd` then `spego create --type architecture`; any artifact in `draft` status → recommend `spego-elicit`; any artifact untouched by reviewers → recommend `spego-review-adversarial` and `spego-review-edge-cases`; user supplied a free-form `query` → answer it before listing recommendations.
- [ ] 3.3 Author the `spego-brainstorm-deep` skill body. Include: explicit single-persona instruction (one voice, no debate), `target_count` enforcement (continue until reached), pruning phase (cluster, deduplicate, rank), and the `record` phase that calls `spego create --type brainstorm`.
- [ ] 3.4 Author the `spego-elicit` skill body. Include: enumerated method list with one-line definitions, mandatory optimistic-concurrency instruction (always pass `--expected-revision`), confirmation step before each apply, and a fixed maximum of 5 refinement cycles per session before forcing the `summarize` phase.
- [ ] 3.5 Each skill ends with the standard spego safety block.
- [ ] 3.6 Each skill includes "When to use" and "When NOT to use" paragraphs. For `brainstorm-deep`, explicitly contrast with `brainstorm-party`.

## 4. Generator integration

- [ ] 4.1 Verify the existing Claude generator emits the three new workflow skills without code changes — they should be picked up automatically from `WORKFLOW_REGISTRY`.
- [ ] 4.2 Verify `spego workflows --json` lists all eight workflows (2 from brainstorm-workflows + 3 from review-suite + 3 from this change).
- [ ] 4.3 Confirm the generation report includes the three new skill paths under `created` on first run and `unchanged` on subsequent runs.

## 5. Tests

- [ ] 5.1 Add `test/workflows.authoring.test.ts` asserting all three new entries exist with the documented personas, phases, inputs, and output kinds.
- [ ] 5.2 Add a test asserting `help` declares no output artifact (`outputs` either empty or all `kind: 'none'`).
- [ ] 5.3 Add a test asserting `elicit` declares an `update`-kind output and the `methods` enumeration is non-empty.
- [ ] 5.4 Add a generator test asserting the three new `SKILL.md` files exist with valid frontmatter and the `spego_generated: true` marker.
- [ ] 5.5 Add a content test for `spego-help` asserting its body references `spego status`, `spego list`, and `spego epics`, and that it mentions every workflow currently in `WORKFLOW_REGISTRY` at least once in the rubric.
- [ ] 5.6 Add a content test for `spego-elicit` asserting its body mandates `--expected-revision` whenever `spego update` is invoked, and asserts the documented 5-cycle cap.
- [ ] 5.7 Add a content test for `spego-brainstorm-deep` asserting it explicitly contrasts itself with `spego-brainstorm-party` in a "When NOT to use" paragraph.
- [ ] 5.8 Add a regression test on `spego workflows --json` confirming the array length is at least 8.

## 6. Documentation

- [ ] 6.1 Add an "Authoring loop" subsection to the README's "Workflow Skills" section that describes the typical sequence: `spego-help` → `spego-brainstorm-party` or `spego-brainstorm-deep` → `spego create` → `spego-elicit` → `spego-review-*`.
- [ ] 6.2 Add a "When to use brainstorm-deep vs brainstorm-party" matrix to the README.
- [ ] 6.3 Add a CHANGELOG entry under the next version describing the three new workflow skills.

## 7. Verification

- [ ] 7.1 `npm run typecheck` passes.
- [ ] 7.2 `npm run lint` passes.
- [ ] 7.3 `npm test` passes (including the new tests in section 5).
- [ ] 7.4 `npm run build` passes.
- [ ] 7.5 In a scratch directory: run `npm run build && node dist/cli.js init --agents claude --demo true`, then verify `.claude/skills/spego-help/SKILL.md`, `.claude/skills/spego-brainstorm-deep/SKILL.md`, and `.claude/skills/spego-elicit/SKILL.md` exist with valid frontmatter.
- [ ] 7.6 In the same scratch directory: open `.claude/skills/spego-help/SKILL.md` and confirm the rubric mentions every other workflow currently registered.
- [ ] 7.7 Re-run `node dist/cli.js regenerate` and confirm all three new skills are reported as `unchanged`.
