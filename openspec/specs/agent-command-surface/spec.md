## ADDED Requirements

### Requirement: Expose artifact commands
The system SHALL expose agent-callable commands for each supported artifact type.

#### Scenario: Update PRD through command surface
- **WHEN** an agent invokes `spego update --id <id> --body <content>`
- **THEN** the command updates the artifact through the artifact engine
- **AND** it returns the updated artifact in markdown by default

#### Scenario: Get architecture as JSON
- **WHEN** an agent invokes `spego read --type architecture --slug <slug> --json`
- **THEN** the command returns structured JSON with metadata and content

### Requirement: Expose project view command
The system SHALL expose a view command that exports all or filtered artifacts.

#### Scenario: View all artifacts
- **WHEN** an agent invokes `/spego:view`
- **THEN** the command returns a markdown bundle of current artifacts

#### Scenario: View filtered artifacts
- **WHEN** an agent invokes `/spego:view --type risk --format json`
- **THEN** the command returns JSON for current risk artifacts only

### Requirement: Avoid post-init prompts
The system SHALL avoid human CLI prompts after project initialization.

#### Scenario: Missing required argument
- **WHEN** an agent invokes a command without required input
- **THEN** the command returns a structured error describing the missing argument
- **AND** it does not prompt interactively

### Requirement: Provide command metadata
The system SHALL provide machine-readable metadata for generated skills and external agents.

#### Scenario: List command metadata
- **WHEN** an agent requests spego command metadata
- **THEN** the system returns command names, descriptions, input schemas, output formats, and artifact types
