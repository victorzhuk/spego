# delivery-adapters Specification (Delta)

## ADDED Requirements

### Requirement: Derive epic status from the filesystem
The adapter SHALL resolve epic status, task counts, and task summaries by parsing the change's `tasks.md` on disk, and SHALL NOT spawn per-change CLI subprocesses while listing epics or tasks.

#### Scenario: Status derived without subprocess
- **WHEN** the adapter lists epics for a workspace with N active changes
- **THEN** it reads `proposal.md` and `tasks.md` per change directly
- **AND** it makes zero child-process calls

#### Scenario: Status values match checkbox state
- **WHEN** a change's `tasks.md` has all tasks checked
- **THEN** the epic status is `completed`
- **AND** when no tasks exist the status is `planning-incomplete`
- **AND** otherwise the status is `active`

#### Scenario: Works without the openspec CLI installed
- **WHEN** the `openspec` binary is not on PATH
- **THEN** `spego mirror` and `spego epics list` still return correct statuses
- **AND** no fallback warning is emitted

### Requirement: Discover changes once per render
The system SHALL reuse a single change discovery result across one mirror or epics invocation, and SHALL parallelize per-entry filesystem reads during discovery.

#### Scenario: Single scan per mirror render
- **WHEN** an agent runs `spego mirror`
- **THEN** the changes directory is enumerated once
- **AND** the same discovery result feeds both the adapter epics and the change list
