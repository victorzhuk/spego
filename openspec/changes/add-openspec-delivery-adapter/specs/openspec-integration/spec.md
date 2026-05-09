## ADDED Requirements

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

### Requirement: Use OpenSpec status when available
The system SHALL prefer OpenSpec CLI status output when available and fall back to file parsing when needed.

#### Scenario: CLI status succeeds
- **WHEN** `openspec status --json` succeeds for a change
- **THEN** the adapter uses that status to classify planning readiness

#### Scenario: CLI status unavailable
- **WHEN** the OpenSpec CLI is unavailable or status fails
- **THEN** the adapter falls back to filesystem inspection
- **AND** it includes a warning in the response
