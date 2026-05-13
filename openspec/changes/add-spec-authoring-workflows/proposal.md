## Why

The brainstorm-workflows change ships *generative* skills (party-mode, adversarial review). It does not yet help agents:
1. **Decide what to do next.** spego has `spego status`, `spego list`, and `spego epics` as raw CLI surfaces, but no skill that synthesizes those into "you should run *X* now". BMad solves this with `bmad-help`, which is the entry point of every BMad session and the most-used skill in the toolkit.
2. **Brainstorm solo.** `spego-brainstorm-party` orchestrates multiple personas — high signal, but high cost. BMad's `bmad-brainstorming` is a *single-agent* guided ideation that targets 50–100 ideas in one voice. It's the right tool when you have a focused problem and don't need persona diversity.
3. **Refine a draft iteratively.** Once a `prd`/`design`/`usecases` draft exists, agents today either accept it as-is or rewrite it from scratch. BMad's `bmad-advanced-elicitation` runs the draft through iterative refinement methods (clarify, sharpen, generalize, specialize, stress-test) and applies improvements in place. spego has the in-place update surface (`spego update --expected-revision`); it just lacks the workflow that drives it.

These three skills cover the "before brainstorm" (help), "instead of party" (brainstorm-deep), and "after first draft" (elicit) phases of authoring an artifact. Together with the brainstorm-workflows change, they form a complete authoring loop.

## What Changes

- Add three workflow skills to the existing `WORKFLOW_REGISTRY`:
  - `spego-help` — reads workspace state via `spego status`/`list`/`epics` and recommends the next required and optional steps.
  - `spego-brainstorm-deep` — single-agent guided ideation targeting 50–100 ideas → writes a `brainstorm` artifact.
  - `spego-elicit` — iterative refinement of a draft artifact (`prd`, `design`, `usecases`, `architecture`, `decision`) → updates the source in place via `spego update --expected-revision`.
- No new CLI commands. All three workflows use the existing CLI surface and appear in `spego workflows --json` automatically.
- `spego-help` reads (not writes) the workspace; it produces no artifact, only a textual recommendation.

## Capabilities

### New Capabilities

- `spec-authoring-workflows`: Three workflow skills that complete spego's authoring loop — orientation (`help`), focused ideation (`brainstorm-deep`), and iterative refinement (`elicit`).

### Modified Capabilities

None. The `agent-skill-generation` and `agent-command-surface` capabilities already cover any number of `WORKFLOW_REGISTRY` entries.

## Impact

- Adds three generated files for the Claude target:
  - `.claude/skills/spego-help/SKILL.md`
  - `.claude/skills/spego-brainstorm-deep/SKILL.md`
  - `.claude/skills/spego-elicit/SKILL.md`
- `spego-help` is read-only and produces no artifact. `spego-brainstorm-deep` writes a `brainstorm` artifact. `spego-elicit` mutates an existing artifact in place via the documented optimistic-concurrency CLI.
- Depends on the `WORKFLOW_REGISTRY` and workflow generator added by `add-spec-brainstorm-workflows`. **Must merge after that change.**
- No artifact schema changes. No CLI surface changes.
