## Context

spego's existing CLI gives agents the building blocks to author artifacts (`create`, `update`, `read`, `list`, `view`), and the brainstorm-workflows change adds a multi-persona ideation skill plus an adversarial reviewer. What's still missing is the *authoring loop itself*:

1. **Where am I?** — Agents currently have to compose an answer from `spego status`, `spego list`, and `spego epics` outputs themselves. This is repetitive and inconsistent across sessions.
2. **How do I generate options when I'm focused?** — Party-mode is heavyweight; sometimes you want one voice generating volume, not five voices debating depth.
3. **How do I improve a draft?** — Today's agents tend to either accept a first draft or rewrite it from scratch. There is no skill that systematically refines.

BMad solves these three with `bmad-help`, `bmad-brainstorming`, and `bmad-advanced-elicitation`. This change ports the same three.

## Goals / Non-goals

**Goals**
- Make `spego-help` the de-facto entry point of every agent session — read-only, fast, deterministic.
- Make solo brainstorming (`brainstorm-deep`) cheap to invoke when persona diversity is not needed.
- Make iterative refinement (`elicit`) safe by routing every mutation through `spego update --expected-revision`.
- Keep all three workflows non-autonomous: they are agent-facing prompts that produce side effects only via documented `spego` CLI commands.

**Non-goals**
- Do **not** turn `spego-help` into an interactive CLI command. It is a *workflow skill*: the agent invokes the existing read-only CLI and synthesizes the recommendation in chat.
- Do **not** introduce new artifact types. `brainstorm-deep` writes `brainstorm`; `elicit` updates the source artifact in place.
- Do **not** ship Distillator/Sharder/Indexer skills (rejected in the prior research turn).
- Do **not** modify the artifact engine or revision semantics. `elicit` uses the existing optimistic-concurrency surface as-is.

## Decisions

### Decision: `spego-help` is a workflow skill, not a CLI command

**Why:** A CLI implementation would have to duplicate logic across every agent target (Claude, OpenCode, Serena) and reinvent state-aware recommendations. As a workflow skill, the same prompt drives any agent — they each call the existing read-only CLI (`spego status`, `spego list --json`, `spego epics`) and apply a small recommendation rubric defined in the skill.

**Alternative considered:** Add a `spego help` CLI command that emits structured recommendations. Rejected: the recommendation rubric (e.g. "if no PRD exists, recommend `spego-brainstorm-party` then `spego create --type prd`") is prompt-shaped reasoning, not deterministic command output. Encoding it as a workflow skill keeps the rubric editable as a markdown template instead of TypeScript.

### Decision: `brainstorm-deep` is single-persona

**Why:** Party-mode covers the "many voices, breadth" use case. Brainstorm-deep covers the orthogonal "one voice, volume" use case (BMad's 50–100 ideas target). Forcing multi-persona structure on a focused brainstorm dilutes throughput and breaks the agent's flow.

### Decision: `elicit` always uses optimistic concurrency

**Why:** The whole point of an iterative refinement workflow is repeated mutation of the same artifact. Without `--expected-revision`, two concurrent elicit runs could clobber each other silently. Mandating the flag in the workflow skill turns the engine's existing safety into a workflow-level guarantee.

### Decision: `elicit` enumerates a fixed set of refinement methods

**Why:** "Iterate to make it better" is too vague to produce repeatable results. BMad's elicitation lists named methods (clarify, sharpen, generalize, specialize, stress-test, contextualize, simplify, formalize). spego adopts the same list. Each elicit cycle picks one method, applies it, asks for confirmation, then commits via `spego update`.

## Workflow definitions

| Workflow | Persona(s) | Inputs | Outputs |
|---|---|---|---|
| `help` | Guide | optional `query` (natural-language question) | none — emits chat recommendation only |
| `brainstorm-deep` | Ideator | required `topic`, optional `target_count` (default 50), optional `seedArtifactId` | `brainstorm` |
| `elicit` | Refiner | required `artifactRef`, optional `methods` subset, optional `target_audience` | in-place `update` of source artifact + `qa` summary of applied refinements |

All three workflows follow the standard phase shape: `inspect/read` → `analyze` → `propose` → (`apply` for elicit; `record` for brainstorm-deep; nothing for help).

## Risks / Trade-offs

- **`spego-help` drift:** As more workflows are added, the recommendation rubric in `spego-help` must be updated. Mitigation: keep the rubric as a single ordered list in the skill body, and add a test asserting every workflow in `WORKFLOW_REGISTRY` appears at least once in the rubric.
- **Elicit can over-apply:** Iterative refinement converges, but only if the agent stops. Mitigation: the skill mandates explicit "stop" criteria — a max number of cycles per session and an explicit "I am done" checkpoint before the final `spego update`.
- **Brainstorm-deep vs party-mode confusion:** Two brainstorming skills risk decision paralysis. Mitigation: the README "When to use" matrix names `brainstorm-deep` for focused volume and `brainstorm-party` for multi-perspective breadth, and `spego-help` recommends one or the other based on the user's stated need.

## Migration

None. Adding three entries to `WORKFLOW_REGISTRY` and running `spego regenerate` writes the three new `SKILL.md` files. Existing skills are unaffected.
