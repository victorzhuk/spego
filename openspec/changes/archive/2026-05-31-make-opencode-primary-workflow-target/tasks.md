## 1. OpenSpec and Workspace Configuration

- [x] 1.1 Add `opencode` to this repository's `.spego/config.yaml` agents list.
- [x] 1.2 Update workspace config defaults/schema so new configs omit daemon orchestration settings but legacy configs with `orchestration` still parse.

## 2. OpenCode Generator

- [x] 2.1 Add and register an `opencode` target generator.
- [x] 2.2 Generate `.opencode/commands/spego-apply.md`, `.opencode/commands/spego-verify.md`, and `.opencode/commands/spego-explore.md` with static OpenCode workflow instructions.
- [x] 2.3 Ensure OpenCode command frontmatter omits Spego-owned model and agent selection.
- [x] 2.4 Stop unconditional OpenCode orchestration asset emission from `spego init` and `spego skills`.
- [x] 2.5 Clean up stale generated OpenCode orchestration assets only when they carry `spego_generated: true`.

## 3. Remove Spego Orchestration Surface

- [x] 3.1 Remove `spego orchestrate` registration from the CLI and command registry.
- [x] 3.2 Remove daemon-backed orchestration exports and unused REST orchestration source from the public package surface.
- [x] 3.3 Clean up stale generated Claude `spego-orchestrate` skill and command wrappers only when they carry `spego_generated: true`.

## 4. Documentation and Tests

- [x] 4.1 Update README to describe OpenCode-first generated workflows and remove `opencode serve` orchestration docs.
- [x] 4.2 Update or replace tests for config defaults, generator output, target-scoped generation, stale cleanup, and command registry parity.
- [x] 4.3 Run strict OpenSpec validation and project verification commands.
