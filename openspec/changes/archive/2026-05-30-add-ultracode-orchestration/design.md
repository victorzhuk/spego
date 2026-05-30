## Context

spego is a TypeScript/ESM project (Node >= 22) with a Commander-based CLI, a markdown-first artifact engine, SQLite indexing, and read-only delivery adapters under `src/delivery/`. The reference orchestrator lives in `ultracode/` (Python + OpenCode agent definitions). It drives `opencode serve` over REST to decompose a requirement, run a worker swarm, and verify the result.

The reference implementation has known gaps this change resolves while porting:
- Fictional provider/model identifiers (`openai/gpt-5.5`, `zhipuai/glm-5.1`, `gpt-5.5-mini`) baked into code.
- A `--model` flag referenced in `README.md` and `.opencode/commands/workflow.md` but never defined in the CLI.
- Manager re-run duplication: `workflow.md` Phase 3 produces a breakdown, then Phase 5 calls `ultracode.py --file spec.md`, which re-decomposes and ignores it.
- The file gate is enforced only in the slash command, not in the orchestrator itself.

Constraints: keep OpenSpec lifecycle state authoritative, keep the delivery adapter read-only, and keep the CLI agent-first (every command pretty in human mode, deterministic in `--json`).

## Goals / Non-Goals

**Goals:**
- One tool path from a planned change to a verified diff, exposed via `spego orchestrate`.
- Faithful TypeScript port of the manager/swarm/verifier pipeline with typed, testable units.
- Real, fully configurable model and server identifiers; no fictional defaults committed.
- In-process per-task file gate.
- Deterministic JSON verdict output for agents.

**Non-Goals:**
- Reimplementing OpenCode agents (we drive OpenCode, not replace it).
- Mutating OpenSpec lifecycle state (apply/verify/sync/archive) from orchestration.
- Auto-commit on success (left to the user or a follow-up change).
- Supporting agent runtimes other than OpenCode in this change.

## Decisions

1. **Port to TypeScript instead of shelling out to `ultracode.py`.** Keeps a single toolchain, enables unit tests, and avoids a Python runtime dependency. Alternative (spawn `python3 ultracode.py`) rejected as fragile, untyped, and config-splitting.
2. **OpenCode REST client uses Node global `fetch` + `AbortController`** for timeouts, with exponential backoff and jitter on 429/503. Alternative (add `undici`/`axios`) rejected because Node 22 ships `fetch` and we keep dependencies minimal.
3. **One orchestration entrypoint.** `spego orchestrate` reads the change's requirement (proposal/specs) and tasks read-only, the manager produces the executable `TaskBreakdown`, and the planned tasks inform but do not replace it. This removes the `workflow.md` ↔ script duplication.
4. **File gate enforced in-process.** After each worker session, diff touched paths against the sub-task `files` allow-list; revert out-of-scope changes and mark the sub-task failed. Alternative (git-only post-hoc check) rejected as too late and git-coupled.
5. **Fully configurable backend.** Server URL and manager/worker/verifier/fallback model ids, max parallelism, and work dir come from `.spego/config.yaml` `orchestration` with env overrides. No fictional defaults; fail clearly when unset or unreachable.
6. **Register through the shared runtime.** `orchestrate` routes through `runCommand` and is added to `COMMAND_REGISTRY` with both output modes so the existing parity test enforces the dual-output contract.

## Risks / Trade-offs

- [OpenCode API drift] → Isolate all HTTP behind the client module; pin to documented endpoints; cover with fixture-based contract tests.
- [Long-running or costly sessions] → Per-session timeout, max-parallel cap, and abort; surface progress through persisted artifacts.
- [File-gate false reverts] → Only revert paths outside the allow-list; record every revert in the sub-task result artifact.
- [Executing model-written code] → Workers may run only allow-listed test/lint commands (ported permissions); no network or git for workers.
- [Tension with the read-only delivery principle] → Orchestration mutates the working tree (code) but never OpenSpec lifecycle state; this boundary is documented and asserted in specs.

## Migration Plan

Additive; no data migration. `orchestrate` is opt-in and requires a reachable `opencode serve` plus configured models. Rollback is removing the command and config block; nothing else depends on it.

## Open Questions

- Should a successful verdict optionally persist a spego `qa`/`retro` artifact? (Deferred.)
- Auto-commit on PASS — include now or as a follow-up change? (Proposed: follow-up.)
- Should additional agent-runtime backends beyond OpenCode be pluggable? (Out of scope here.)
