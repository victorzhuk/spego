## ADDED Requirements

### Requirement: Orchestrate a change end to end
The system SHALL provide a `spego orchestrate --change <name>` command that runs a manager → swarm → verifier pipeline over a named OpenSpec change and emits a structured verdict. The command SHALL support both human and `--json` output and SHALL appear in `COMMAND_REGISTRY` declaring both `markdown` and `json` output modes.

#### Scenario: Successful run emits a verdict in JSON mode
- **WHEN** an agent invokes `spego --json orchestrate --change <name>` for a change that exists
- **THEN** the pipeline runs decomposition, execution, and verification
- **AND** stdout contains a JSON payload with `passed`, `verdict`, and per-sub-task results

#### Scenario: Unknown change is rejected
- **WHEN** a user invokes `spego orchestrate --change <name>` for a change that does not exist
- **THEN** the command emits the standard error envelope `{ error: { code, message, details } }`
- **AND** the process exits non-zero

#### Scenario: Command is registered with both output modes
- **WHEN** the registry is inspected
- **THEN** an `orchestrate` entry exists
- **AND** its `outputModes` include both `markdown` and `json`

### Requirement: Decompose the requirement into a validated task breakdown
The manager SHALL produce a `TaskBreakdown` containing `goal`, `contextSummary`, `executionMode`, `testCommand`, and a list of sub-tasks (each with `id`, `files`, `acceptanceCriteria`, and `dependsOn`). The breakdown SHALL be validated against a schema before any sub-task executes, and invalid output SHALL abort the run with a structured error.

#### Scenario: Valid breakdown is persisted
- **WHEN** the manager returns a schema-valid breakdown
- **THEN** the breakdown is written to the work dir as `breakdown.json`
- **AND** execution proceeds to the swarm phase

#### Scenario: Invalid manager output aborts the run
- **WHEN** the manager returns output that fails schema validation
- **THEN** the run aborts before any worker executes
- **AND** the command emits a structured error identifying the validation failure

### Requirement: Schedule sub-tasks with dependency awareness
The system SHALL execute sub-tasks in one of `sequential`, `parallel`, or `adaptive` mode, honoring each sub-task's `dependsOn` edges. In `adaptive` mode the system SHALL compute dependency tiers and run the tasks within a tier concurrently, bounded by the configured maximum parallelism.

#### Scenario: Adaptive mode runs an independent tier in parallel
- **WHEN** a tier contains sub-tasks with no dependency on one another
- **THEN** those sub-tasks run concurrently
- **AND** the next tier starts only after every task in the current tier completes

#### Scenario: Dependency cycle falls back to sequential
- **WHEN** the dependency graph contains a cycle
- **THEN** the remaining cyclic sub-tasks run sequentially
- **AND** a warning is recorded

#### Scenario: Concurrency is bounded by configuration
- **WHEN** a tier has more runnable sub-tasks than the configured maximum parallelism
- **THEN** no more than the configured maximum run concurrently

### Requirement: Enforce a per-task file gate
Each worker SHALL persist edits only to files listed in its sub-task `files` allow-list. The orchestrator SHALL revert any out-of-scope edits and mark the affected sub-task as failed.

#### Scenario: Out-of-scope edit is reverted
- **WHEN** a worker modifies a file not in its sub-task allow-list
- **THEN** the orchestrator reverts that file
- **AND** marks the sub-task as failed with the violating path recorded in its result

#### Scenario: In-scope edits are retained
- **WHEN** a worker modifies only files in its sub-task allow-list
- **THEN** the edits are retained
- **AND** the sub-task is not failed by the file gate

### Requirement: Verify with the test suite and emit a verdict
The verifier SHALL run the breakdown `testCommand`, check each sub-task's acceptance criteria, and emit a verdict object containing `passed`, `testOutput`, and `failingCriteria`. The `passed` field SHALL be true only when the test command succeeds AND every acceptance criterion is satisfied.

#### Scenario: Verdict passes only when tests and criteria pass
- **WHEN** the test command succeeds and all acceptance criteria are satisfied
- **THEN** the verdict has `passed` equal to true

#### Scenario: Failing tests produce a failing verdict
- **WHEN** the test command fails
- **THEN** the verdict has `passed` equal to false
- **AND** `failingCriteria` or `testOutput` explains the failure

#### Scenario: Missing test command marks the verdict failed
- **WHEN** the breakdown provides no usable test command
- **THEN** the verdict has `passed` equal to false
- **AND** the reason is reported in the verdict notes

### Requirement: Configure the orchestration backend
The system SHALL read orchestration settings — OpenCode server URL, manager / worker / verifier / fallback model identifiers, maximum parallelism, and work dir — from the `orchestration` block of `.spego/config.yaml`, with environment-variable overrides. Model identifiers SHALL be configurable, and no fictional model identifier SHALL be committed as a code default.

#### Scenario: Settings are read from workspace config
- **WHEN** `.spego/config.yaml` defines an `orchestration` block
- **THEN** the orchestrator uses those values for the server URL, model tiers, parallelism, and work dir

#### Scenario: Environment variables override config
- **WHEN** an orchestration environment variable is set
- **THEN** its value overrides the corresponding `.spego/config.yaml` value

#### Scenario: Unreachable server yields a structured error
- **WHEN** the configured OpenCode server is not reachable
- **THEN** the command emits the standard error envelope
- **AND** the message identifies the unreachable server URL

### Requirement: Keep OpenSpec lifecycle state external
Orchestration SHALL consume a change's requirement and tasks read-only and SHALL NOT mutate OpenSpec lifecycle state (apply, verify, sync, or archive). Orchestration MAY modify the working tree as part of executing sub-tasks.

#### Scenario: Orchestration does not change OpenSpec lifecycle state
- **WHEN** an orchestration run completes for a change
- **THEN** the change's OpenSpec lifecycle state is unchanged
- **AND** no apply, verify, sync, or archive action is invoked by orchestration

#### Scenario: Working-tree edits are permitted
- **WHEN** a worker implements a sub-task
- **THEN** it may create or modify files in the working tree within its file-gate allow-list

### Requirement: Persist run artifacts
The system SHALL persist the task breakdown, per-sub-task results, the swarm log, and the final verdict under the configured work dir so a run can be inspected after completion.

#### Scenario: Artifacts are written after a run
- **WHEN** an orchestration run completes
- **THEN** the work dir contains the breakdown, a result file per sub-task, the swarm log, and the verdict
