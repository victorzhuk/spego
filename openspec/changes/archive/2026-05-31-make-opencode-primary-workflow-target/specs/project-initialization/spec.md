## MODIFIED Requirements

### Requirement: Initialize spego workspace
The system SHALL initialize a local `.spego/` workspace in the current project without requiring interactive prompts when arguments are provided. Newly written workspace config SHALL include local spego settings and configured agent targets, and SHALL NOT include daemon-backed OpenCode orchestration server/model settings.

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

#### Scenario: Legacy orchestration config remains readable
- **WHEN** an existing `.spego/config.yaml` contains an `orchestration` block from an older version
- **THEN** workspace config parsing succeeds
- **AND** the parsed local spego behavior does not require OpenCode server URL or model identifiers
