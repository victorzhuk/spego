## Why

`add-spec-brainstorm-workflows` introduces the workflow-skill machinery and ships one adversarial review (`spego-review-adversarial`). That review is *attitude-driven* — it assumes problems exist and hunts for what's missing. BMad pairs it with two *method-driven* counterparts that catch a different class of defect:

- `bmad-review-edge-case-hunter` — pure branching-path enumeration. Catches off-by-ones, unguarded inputs, missing else/default, race conditions. Reports only unhandled paths.
- `bmad-editorial-review-prose` and `bmad-editorial-review-structure` — clinical copy-edit and structural-edit reviewers. Catch confusion, ambiguity, length bloat, and mis-ordered sections that adversarial reviewers don't flag.

spego today has the artifact types to receive these outputs (`qa` for technical reviews; in-place update for editorial passes), but no skills teach an agent how to run them. Without these, every spego review is a single attitude-driven pass — agents miss the orthogonal coverage that makes BMad's review stack reliable.

This change ships the three reviewers as workflow skills on top of the `WORKFLOW_REGISTRY` introduced by the brainstorm-workflows change.

## What Changes

- Add three workflow skills (registered in the existing `WORKFLOW_REGISTRY`):
  - `spego-review-edge-cases` — branching-path edge-case enumerator → writes a `qa` artifact with one finding per unhandled path.
  - `spego-editorial-prose` — clinical copy-edit pass → updates the source artifact in place via `spego update` (and writes a `qa` summary listing the edits).
  - `spego-editorial-structure` — structural review (cuts, merges, reorders) → produces a `qa` artifact with prioritized restructuring recommendations; does not mutate the source automatically.
- No new CLI commands. All three workflows use the existing `spego read`, `spego create --type qa`, and `spego update` surface. They appear in `spego workflows --json` automatically once registered.
- Add `target_audience` and `reader_type` (humans|llm) optional inputs to the editorial workflows, mirroring BMad's editorial review inputs.
- Add a "complementary reviews" note to the README explaining when to combine adversarial + edge-case + editorial passes.

## Capabilities

### New Capabilities

- `spec-review-suite`: A trio of method-driven reviewers (edge-case enumeration, prose copy-edit, structural restructuring) complementing the attitude-driven `spego-review-adversarial`.

### Modified Capabilities

None. The `agent-skill-generation` and `agent-command-surface` capabilities already cover any number of `WORKFLOW_REGISTRY` entries.

## Impact

- Adds three generated files for the Claude target:
  - `.claude/skills/spego-review-edge-cases/SKILL.md`
  - `.claude/skills/spego-editorial-prose/SKILL.md`
  - `.claude/skills/spego-editorial-structure/SKILL.md`
- No CLI surface changes. No artifact schema changes.
- One workflow (`spego-editorial-prose`) instructs the agent to call `spego update` against the source artifact's id; this is a documented mutation through the existing engine, subject to existing optimistic-concurrency checks.
- Depends on the `WORKFLOW_REGISTRY` and workflow generator added by `add-spec-brainstorm-workflows`. **Must merge after that change.**
