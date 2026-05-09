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
