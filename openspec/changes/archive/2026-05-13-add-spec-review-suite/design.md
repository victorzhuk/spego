## Context

This change rides on top of `add-spec-brainstorm-workflows`, which introduces:
- `WORKFLOW_REGISTRY` and the workflow-skill generator
- `spego-review-adversarial` — the *attitude-driven* reviewer (cynical, hunts for missing things)

Adversarial review is excellent at catching weak assumptions, missing scenarios, and sloppy reasoning, but it is not optimized for two adjacent failure modes:
1. **Code/logic edge cases** — off-by-ones, unguarded inputs, race conditions. Catching these reliably needs a *method* (path enumeration), not an *attitude*.
2. **Communication failure** — confusing prose, mis-ordered sections, length bloat. These need an editorial lens, not a critical one.

BMad solves this with three complementary reviewers; this change ports the same three.

## Goals / Non-goals

**Goals**
- Provide orthogonal review coverage so that running adversarial + edge-case + editorial passes catches almost all defects an artifact will have.
- Make each reviewer single-purpose. No reviewer should "improve" *and* "critique" in the same pass.
- Reuse the existing artifact engine for all persistence. No new mutation surface.

**Non-goals**
- Do **not** auto-apply edits. Even `spego-editorial-prose` (which *does* call `spego update`) does so only when the agent explicitly chooses to apply a recommended edit; it does not silently rewrite artifacts.
- Do **not** introduce a new artifact type. Findings land in `qa`; in-place edits land back on the source artifact via `update`.
- Do **not** ship a Distillator or Sharder analogue (rejected in the prior research turn).

## Decisions

### Decision: Three separate workflows, not one "review" workflow with modes

**Why:** Each reviewer has a distinct method and a distinct output shape. Collapsing them into one workflow with a `mode: edge-case|prose|structure` flag forces the agent to mentally context-switch mid-skill and dilutes each method. The BMad model proves that single-purpose reviewers produce more findings than multi-purpose ones.

### Decision: Edge-case hunter outputs JSON-shaped findings inside a `qa` markdown artifact

**Why:** BMad's edge-case hunter outputs JSON so its findings are machine-actionable (later workflows can mechanically generate tests from them). spego artifacts are markdown-first, so we wrap the JSON in a fenced ` ```json ` block inside the `qa` body. This keeps spego's storage model intact while preserving downstream tool-friendliness.

### Decision: Prose review may mutate the source artifact; structure review never does

**Why:** Prose edits are local and low-risk (a clearer sentence is rarely wrong). Structural edits (cuts, merges, reorders) are high-impact and warrant explicit human review before any mutation — so the structure reviewer only emits a recommendation list. This matches the safety profile of the underlying changes: low-risk passes can be one-shot; high-risk passes require a second human gate.

### Decision: Editorial reviewers accept `target_audience` and `reader_type` inputs

**Why:** Editorial quality is meaningless without an audience. BMad's editorial reviewers require this, and the alternative — letting the agent guess — produces inconsistent edits across runs. Both inputs are optional with sensible defaults (`humans`, no specific audience), so the workflows remain easy to invoke for casual use.

## Workflow definitions

| Workflow | Personas | Inputs | Outputs |
|---|---|---|---|
| `review-edge-cases` | Path-tracer, Boundary-checker, Concurrency-skeptic | `artifactRef` (required), `also_consider` (optional) | `qa` (always) — JSON findings array embedded in markdown |
| `editorial-prose` | Copy-editor | `artifactRef` (required), `target_audience` (optional), `reader_type` (optional) | `qa` (always) — edit summary; *and* in-place `update` of source artifact for accepted edits |
| `editorial-structure` | Structural editor | `artifactRef` (required), `purpose` (optional), `target_audience` (optional), `length_target` (optional) | `qa` (always) — prioritized restructuring recommendations |

All three workflows follow the standard phase shape inherited from the parent change: `read` → `analyze (per persona)` → `prioritize` → `record`.

## Risks / Trade-offs

- **Reviewer fatigue:** Five reviewers in total (`adversarial`, `edge-cases`, `prose`, `structure`, plus future `accessibility`/`security` if added) is a lot to know about. Mitigated by the planned `spego-help` skill, which will recommend which reviewer suits the artifact under inspection.
- **Mutation in prose review:** Any in-place update is a footgun. We require the prose workflow to (a) name the artifact id explicitly, (b) pass `--expected-revision` so concurrent edits are caught, (c) record the edit summary as a separate `qa` artifact for traceability.
- **JSON-in-markdown:** Embedding JSON in a markdown body is a small ergonomic cost; the alternative (a new artifact type) is much worse. Trivially parseable by downstream tools.

## Migration

None. Adding entries to `WORKFLOW_REGISTRY` and running `spego regenerate` writes the three new `SKILL.md` files; existing skills are untouched.
