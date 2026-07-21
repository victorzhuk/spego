## Purpose
Define read-only delivery adapter behavior for configuring, listing, and linking external epics and tasks.
## Requirements
### Requirement: Configure delivery adapter
The system SHALL allow a project to configure the delivery adapter used for epics and tasks views.

#### Scenario: Default adapter
- **WHEN** a project has no explicit delivery adapter config
- **THEN** the system uses the OpenSpec adapter by default

#### Scenario: Unknown adapter
- **WHEN** config names an adapter that is not installed
- **THEN** the system returns a configuration error with the adapter name

### Requirement: List delivery epics
The system SHALL list top-level delivery items from the configured adapter as epic links.

#### Scenario: List epics
- **WHEN** an agent invokes `/spego:epics list`
- **THEN** the system returns epic link summaries with adapter name, external id, title, status, and source path

### Requirement: List delivery tasks
The system SHALL list task summaries from the configured adapter.

#### Scenario: List tasks
- **WHEN** an agent invokes `/spego:tasks list`
- **THEN** the system returns task summaries with adapter name, external id, title, status, parent epic link, and source path

### Requirement: Keep delivery state external
The system SHALL not mutate detailed delivery task state through the adapter in the MVP.

#### Scenario: Attempt task update
- **WHEN** an agent attempts to update a delivery task through spego
- **THEN** the system rejects the request
- **AND** it identifies the owning delivery tool command to use instead

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

