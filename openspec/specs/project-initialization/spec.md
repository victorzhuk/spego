## ADDED Requirements

### Requirement: Initialize spego workspace
The system SHALL initialize a local `.spego/` workspace in the current project without requiring interactive prompts when arguments are provided.

#### Scenario: Initialize with explicit options
- **WHEN** an agent runs `spego init --agents claude --demo false`
- **THEN** the system creates the spego config, artifact directories, revision directory, and SQLite index
- **AND** the command returns a structured summary of created paths

#### Scenario: Re-run initialization
- **WHEN** an agent runs `spego init` in an already initialized project
- **THEN** the system validates the workspace layout
- **AND** it does not overwrite existing artifacts unless a force option is provided

### Requirement: Report workspace status
The system SHALL report whether the current project has a valid spego workspace.

#### Scenario: Valid workspace
- **WHEN** an agent requests workspace status
- **THEN** the system reports initialized status, config path, artifact root, index path, and configured agents

#### Scenario: Missing workspace
- **WHEN** an agent requests workspace status outside a spego project
- **THEN** the system reports that initialization is required
- **AND** it includes the command needed to initialize the project
