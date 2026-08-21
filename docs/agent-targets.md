# Agent targets and generated files

`spego init` generates agent-facing files for every target listed under `agents` in `.spego/config.yaml`. Run `spego skills` to regenerate them without reinitializing the workspace.

## Claude

- `.claude/skills/spego-<command>/SKILL.md` — skill definitions following Claude Code conventions
- `.claude/commands/spego/` — slash command wrappers

Workflow skills land at `.claude/skills/spego-<workflow>/SKILL.md`; the agent picks them up from the skill description.

## OpenCode

- `.opencode/commands/spego-apply.md` — implements pending tasks from an OpenSpec change in the active OpenCode instance
- `.opencode/commands/spego-verify.md` — checks completeness, correctness, coherence, and tests before archive
- `.opencode/commands/spego-explore.md` — a read-only exploration stance for ideas, problems, or OpenSpec changes

`/spego-apply` runs as a phased current-session workflow: select the change, load context, plan tasks, execute work, verify results, update task checkboxes, summarize status. It may use OpenCode-native subagents only inside the active OpenCode instance, for independent investigation, implementation review, or verification.

### Scope

spego does not start or control OpenCode through `opencode serve`, does not call the OpenCode REST API, does not create external OpenCode sessions, and does not own model selection. Configure models, variants, agents, and permissions in OpenCode itself.

There are no `spego apply`, `spego verify`, `spego explore`, or `spego orchestrate` CLI commands. Apply, verify, and explore are generated OpenCode workflows; spego remains the local artifact engine and read-only OpenSpec delivery view.

## Regeneration and stale files

During regeneration spego removes stale generated OpenCode compatibility files — old `opsx-*` commands, `openspec-*` skills, retired orchestration assets — only when they carry the `spego_generated: true` marker. User-owned files without that marker are preserved and reported as skipped.

## Related

- [Workflows](workflows.md) — what the generated workflow skills do
