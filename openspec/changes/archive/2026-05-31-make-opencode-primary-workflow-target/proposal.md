## Why

Spego's current orchestration path makes the CLI drive OpenCode through a REST daemon, which conflicts with the desired ownership boundary: OpenCode should orchestrate work inside the active agent instance, while spego remains a local artifact and OpenSpec context compiler. OpenCode also needs to be a first-class generated agent target so `/spego-apply`, `/spego-verify`, and `/spego-explore` become the primary workflow surface.

## What Changes

- Add `opencode` to this workspace's configured `agents` list and make OpenCode the primary generated workflow target.
- Generate OpenCode slash commands `/spego-apply`, `/spego-verify`, and `/spego-explore` from spego's generator when `opencode` is configured.
- Stop emitting daemon-oriented OpenCode orchestration assets (`orchestrate`, `ultramanager`, `ultraworker`, `ultraverifier`).
- **BREAKING**: Remove the public `spego orchestrate` command and command-registry entry.
- Remove the OpenCode REST orchestration implementation from spego's public surface; OpenCode owns task execution through generated commands in the current instance.
- Stop writing `orchestration` server/model config into new `.spego/config.yaml` files while continuing to tolerate legacy config files that still contain it.
- Update docs/specs/tests to describe the new boundary: spego is pure local CLI/context, OpenCode is the workflow executor.

## Capabilities

### New Capabilities
- `opencode-workflow-generation`: OpenCode-specific generated command assets for applying, verifying, and exploring OpenSpec changes through the active OpenCode instance.

### Modified Capabilities
- `agent-skill-generation`: add OpenCode as a supported generation target and constrain target-specific outputs.
- `project-initialization`: default or repository workspace agent configuration includes OpenCode without adding daemon orchestration config.
- `agent-command-surface`: remove `orchestrate` from the public command surface and keep Spego's public CLI local-only.
- `ultracode-orchestration`: retire the daemon-backed orchestration contract in favor of OpenCode-owned generated workflows.

## Impact

- Source: `src/generator/`, `src/workspace/config.ts`, `src/workspace/init.ts`, `src/cli/commands/skills.ts`, `src/commands/registry.ts`, `src/cli.ts`, `src/index.ts`, and removal/quarantine of `src/orchestration/` consumers.
- Generated assets: `.opencode/commands/spego-apply.md`, `.opencode/commands/spego-verify.md`, `.opencode/commands/spego-explore.md`, plus cleanup of stale generated orchestration assets.
- Tests: generator tests, init/config tests, command registry parity, skills command tests, and removal/replacement of orchestration tests.
- Docs/specs: README and OpenSpec capability specs updated to reflect OpenCode-first workflows and local-only spego behavior.
