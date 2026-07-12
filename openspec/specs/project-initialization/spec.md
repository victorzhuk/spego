## Purpose

Define initialization and status behavior for local `.spego/` workspaces.
## Requirements
### Requirement: Initialize spego workspace
The system SHALL initialize a local `.spego/` workspace in the current project without requiring interactive prompts when arguments are provided. Newly written workspace config SHALL include local spego settings and configured agent targets, and SHALL NOT include daemon-backed OpenCode orchestration server/model settings. Workspace config containing a legacy `orchestration` block SHALL be rejected with an error that names the obsolete block and instructs the user to delete it.

#### Scenario: Initialize with explicit options
- **WHEN** an agent runs `spego init --agents claude --demo false`
- **THEN** the system creates the spego config, artifact directories, revision directory, and SQLite index
- **AND** the command returns a structured summary of created paths

#### Scenario: Initialize with OpenCode target
- **WHEN** an agent runs `spego init --agents opencode --demo false`
- **THEN** the generated `.spego/config.yaml` agents list contains `opencode`
- **AND** the system generates OpenCode command files for the configured target
- **AND** the generated `.spego/config.yaml` does not contain an `orchestration` block

#### Scenario: Re-run initialization
- **WHEN** an agent runs `spego init` in an already initialized project
- **THEN** the system validates the workspace layout
- **AND** it does not overwrite existing artifacts unless a force option is provided

#### Scenario: Legacy orchestration config rejected
- **WHEN** an existing `.spego/config.yaml` contains an `orchestration` block from an older version
- **THEN** workspace config parsing fails with a validation error naming the `orchestration` block
- **AND** the error instructs the user to delete the block from the config file

### Requirement: Report workspace status
The system SHALL report whether the current project has a valid spego workspace.

#### Scenario: Valid workspace
- **WHEN** an agent requests workspace status
- **THEN** the system reports initialized status, config path, artifact root, index path, and configured agents

#### Scenario: Missing workspace
- **WHEN** an agent requests workspace status outside a spego project
- **THEN** the system reports that initialization is required
- **AND** it includes the command needed to initialize the project

