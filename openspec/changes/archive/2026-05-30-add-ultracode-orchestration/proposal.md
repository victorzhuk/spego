## Why

spego plans and reviews work as artifacts and exposes OpenSpec changes as read-only delivery epics/tasks, but it cannot *execute* a change. Today that requires a separate Python tool (`ultracode/`) that drives the OpenCode REST API to decompose, implement, and verify work. Folding that orchestrator into spego as a first-class TypeScript capability gives agents one tool that goes from a planned change's tasks to a verified diff, while keeping OpenSpec's lifecycle state authoritative.

## What Changes

- Add a new `ultracode-orchestration` capability: a manager → swarm → verifier pipeline that takes a change's requirement and tasks and produces a structured verdict.
- Add a `spego orchestrate --change <name>` command (dual human/JSON output, registered in `COMMAND_REGISTRY`) that runs the pipeline for a named OpenSpec change.
- Port the reference orchestrator (`ultracode/ultracode.py`) to TypeScript under `src/orchestration/`: an OpenCode REST client (Node global `fetch`), a `TaskBreakdown` model with schema validation, a dependency-tier scheduler (`sequential` | `parallel` | `adaptive`), a worker runner, and a verifier.
- Port the three agent definitions (`ultramanager`, `ultraworker`, `ultraverifier`) and the `/workflow` command into spego's generator so `spego init` / `spego skills` emit them for configured agents.
- Add an `orchestration` block to `.spego/config.yaml` (server URL, model tiers, max parallelism, work dir) with environment-variable overrides.
- Enforce the per-task file gate inside the orchestrator (not only in the slash command), reverting out-of-scope edits.
- Use real, configurable provider/model identifiers — no fictional defaults baked into code.
- Persist run artifacts (breakdown, per-sub-task results, swarm log, verdict) under a configurable work dir.

No breaking changes: every addition is additive. The OpenSpec delivery adapter stays read-only; orchestration consumes a change's tasks but never mutates OpenSpec lifecycle state.

## Capabilities

### New Capabilities
- `ultracode-orchestration`: multi-agent execution of a planned change — decomposition, dependency-aware sub-task execution, file-gating, and test-backed verification, driven through the OpenCode REST API and exposed via `spego orchestrate`.

### Modified Capabilities
None. Delivery remains read-only, and the dual-output command contract is satisfied by the new command without changing existing requirements.

## Impact

- New source: `src/orchestration/` (client, models, scheduler, manager/worker/verifier, file-gate, artifacts) and `src/cli/commands/orchestrate.ts`.
- Modified source: `src/commands/registry.ts` (new `orchestrate` entry, both output modes), `src/cli.ts` (register the command), `src/workspace/config.ts` and the config schema (new `orchestration` block), `src/generator/` (emit ultracode agents and the `/workflow` command).
- Dependencies: none new at runtime — uses Node 22 global `fetch`. OpenCode (`opencode serve`) is an external runtime requirement, not an npm dependency.
- Tests: new unit tests (scheduler tiers, breakdown parsing, file-gate) and CLI tests (`orchestrate` dual-output plus the registry/program parity entry).
- Docs: README gains an "Orchestration" section and config docs; CHANGELOG entry. The `ultracode/` reference implementation remains as the source of the ported behavior.
