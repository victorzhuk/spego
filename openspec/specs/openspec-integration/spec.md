## Purpose
Define the delivery adapter contract for reading OpenSpec workspace metadata, change discovery, task parsing, and status classification as structured delivery links.

## Requirements

### Requirement: Discover OpenSpec workspace
The system SHALL discover an OpenSpec workspace in the current project before reading OpenSpec delivery metadata.

#### Scenario: OpenSpec present
- **WHEN** `openspec/config.yaml` exists in the project
- **THEN** the adapter reports OpenSpec as available

#### Scenario: OpenSpec missing
- **WHEN** no OpenSpec workspace exists
- **THEN** the adapter returns an unavailable error with initialization guidance

### Requirement: Read OpenSpec changes as delivery links
The system SHALL expose active OpenSpec changes as delivery links.

#### Scenario: Active change with proposal
- **WHEN** an OpenSpec change contains `proposal.md`
- **THEN** the adapter returns a delivery link using the change folder name as external id
- **AND** it includes proposal title or inferred summary when available

### Requirement: Read OpenSpec tasks
The system SHALL parse OpenSpec `tasks.md` checklists into task summaries.

#### Scenario: Tasks file exists
- **WHEN** an OpenSpec change contains `tasks.md`
- **THEN** the adapter returns task summaries for each checklist item
- **AND** checked items are reported as done

#### Scenario: Tasks file missing
- **WHEN** an OpenSpec change has no `tasks.md`
- **THEN** the adapter reports the change with no tasks and a planning-incomplete status

### Requirement: Derive status from the filesystem
The system SHALL derive change status from `tasks.md` on disk and SHALL NOT spawn per-change CLI subprocesses.

#### Scenario: Status matches checkbox state
- **WHEN** a change's `tasks.md` has all tasks checked
- **THEN** the adapter reports the change as completed
- **AND** when no tasks exist it reports planning-incomplete
- **AND** otherwise it reports active

#### Scenario: OpenSpec CLI absent
- **WHEN** the `openspec` binary is not on PATH
- **THEN** the adapter still returns correct statuses
- **AND** no fallback warning is emitted
