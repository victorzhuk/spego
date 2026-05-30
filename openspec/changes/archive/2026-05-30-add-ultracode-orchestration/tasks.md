## 1. Specification

- [x] 1.1 Author the `ultracode-orchestration` capability spec delta with requirements and scenarios.
- [x] 1.2 Run `openspec validate add-ultracode-orchestration --strict --no-interactive` and resolve any structural errors before any code lands.

## 2. Orchestration core (`src/orchestration/`)

- [x] 2.1 Add an OpenCode REST client using Node global `fetch` and `AbortController`, with exponential backoff and jitter on 429/503.
- [x] 2.2 Add `TaskBreakdown` and `SubTask` models plus a `zod` schema and a parser that strips JSON fences.
- [x] 2.3 Add a dependency-tier builder (Kahn's algorithm) with cycle-detection fallback to sequential.
- [x] 2.4 Add a scheduler supporting `sequential`, `parallel`, and `adaptive` modes with bounded concurrency.
- [x] 2.5 Add the manager step: send the requirement, validate the breakdown, persist `breakdown.json`.
- [x] 2.6 Add the worker step: run a sub-task session, parse the status marker, and collect the session diff.
- [x] 2.7 Add the in-process file gate: diff touched paths against the allow-list, revert out-of-scope edits, mark the sub-task failed.
- [x] 2.8 Add the verifier step: run `testCommand`, check acceptance criteria, emit the verdict.
- [x] 2.9 Add artifact persistence for breakdown, per-sub-task results, swarm log, and verdict under the work dir.

## 3. Configuration

- [x] 3.1 Add an `orchestration` block to the workspace config schema and `.spego/config.yaml` defaults (server URL, model tiers, max parallelism, work dir).
- [x] 3.2 Apply environment-variable overrides; keep model identifiers configurable with no fictional defaults; emit clear errors when settings are missing or the server is unreachable.

## 4. CLI command

- [x] 4.1 Add `src/cli/commands/orchestrate.ts` routed through `runCommand`, emitting the verdict in human and `--json` modes.
- [x] 4.2 Register the command in `src/cli.ts` and add an `orchestrate` entry to `COMMAND_REGISTRY` declaring both output modes.
- [x] 4.3 Return the standard error envelope for unknown change and unreachable-server paths.

## 5. Agent and skill generation

- [x] 5.1 Port the `ultramanager`, `ultraworker`, and `ultraverifier` prompts into generator templates.
- [x] 5.2 Emit a `/workflow`-equivalent command and ensure `spego init` and `spego skills` produce these files for configured agents.
- [x] 5.3 Preserve the worker bash allow-list (test and lint runners only) and deny git and network access for workers.

## 6. Tests

- [x] 6.1 Unit test the dependency-tier builder, including the cycle fallback.
- [x] 6.2 Unit test breakdown schema validation for valid and invalid manager output.
- [x] 6.3 Unit test the file gate reverting an out-of-scope edit.
- [x] 6.4 Add a CLI test for `orchestrate` dual output and the error path using a mocked client.
- [x] 6.5 Extend the registry/program parity test to cover `orchestrate` in both output modes.

## 7. Documentation

- [x] 7.1 Add an "Orchestration" section and config documentation to `README.md`.
- [x] 7.2 Add a `CHANGELOG.md` entry.

## 8. Validation gates

- [x] 8.1 `openspec validate add-ultracode-orchestration --strict --no-interactive` passes.
- [x] 8.2 `npm run typecheck` passes.
- [x] 8.3 `npm run lint` passes.
- [x] 8.4 `npm test` passes.
- [x] 8.5 `npm run build` passes.
