## Why

spego today only generates *CLI-wrapper skills* — every skill in `.claude/skills/spego-*/SKILL.md` is a thin shell around a single `spego <command>` invocation (see `src/generator/claude.ts` and `COMMAND_REGISTRY`). This is enough to *persist* artifacts, but not enough to *produce* good ones.

BMAD demonstrates a higher-leverage pattern: **workflow skills** that orchestrate a multi-step process inside the agent's chat. Two of its most useful are:

- **bmad-party-mode** — multi-persona collaborative brainstorming. Several role personas (PM, Architect, UX, Dev, QA, …) take turns expanding and challenging an idea, surfacing diverse angles before convergence.
- **bmad-review-adversarial-general** — devil's-advocate review that stress-tests an existing spec for gaps, contradictions, weak assumptions, and missing edge cases.

spego already has the *artifact types* required for the outputs of these processes (`brainstorm`, `qa`, `risk`, `decision`, `prd`, `design`), but no skills teach an agent how to drive the *process* and capture its results as spego artifacts. The result is that spec authoring inside spego is mechanical (you create what you already know) rather than generative (you discover what you should specify).

This change introduces workflow skills as a first-class concept in spego's generator, and ships two of them — `spego-brainstorm-party` and `spego-review-adversarial` — wired to the existing artifact engine.

## What Changes

- Introduce a **workflow skill** concept distinct from CLI-wrapper skills.
- Add a `WORKFLOW_REGISTRY` (parallel to `COMMAND_REGISTRY`) describing each workflow: name, description, personas/phases, expected inputs, target artifact type(s), safety rules.
- Extend the Claude target generator to emit a `SKILL.md` per workflow at `.claude/skills/spego-<workflow>/SKILL.md` using the same marker/frontmatter conventions as command skills.
- Ship two workflow skills:
  - `spego-brainstorm-party` — multi-persona ideation → writes a `brainstorm` artifact and optionally drafts a follow-up `prd` or `design`.
  - `spego-review-adversarial` — adversarial critique of any existing artifact → writes a `qa` or `risk` artifact and optionally a `decision` or `retro` follow-up.
- Add `spego workflows` CLI (analogous to `spego commands`) that prints the workflow registry as JSON for tooling and skill regeneration.
- Update `spego regenerate` so workflow skills participate in the same create/update/cleanup report as command skills.
- Update `agent-skill-generation` and `agent-command-surface` specs to cover workflow skills.
- Add tests, README docs, and CHANGELOG entry.

## Capabilities

### New Capabilities

- `spec-brainstorm-workflows`: Workflow-style skills that orchestrate multi-persona brainstorming and adversarial review, capturing outputs as spego artifacts.

### Modified Capabilities

- `agent-skill-generation`: Generator emits workflow skills in addition to command skills, using the same path/frontmatter rules.
- `agent-command-surface`: Adds the `spego workflows` command for listing workflow metadata.

## Impact

- Adds two new generated files per init/regenerate for the Claude target:
  - `.claude/skills/spego-brainstorm-party/SKILL.md`
  - `.claude/skills/spego-review-adversarial/SKILL.md`
- Adds one new CLI command (`spego workflows`); no existing CLI surface changes.
- No changes to the artifact storage format, schemas, or revision semantics — workflow skills consume the existing `spego create`/`update` surface.
- No breaking changes. Projects without the new workflow skills installed are unaffected; running `spego regenerate` adds the new files and lists them in the generation report.
- Workflow skills are documentation/orchestration — they do not execute autonomously. They guide an agent through a chat-side process whose only side effect is writing artifacts via the existing engine.
