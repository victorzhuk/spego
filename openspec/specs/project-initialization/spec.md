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

### Requirement: Configure flow profiles
Workspace config SHALL support an optional `flows` block declaring how Size Tiers are priced: `default` naming the Flow that prices changes with no per-epic override, `profiles` mapping each declared Flow name to a seed table of Flow Hours per Size Tier, and `human` mapping each Size Tier to Human Hours once, shared across every Flow. The Size Tier scale SHALL be fixed at `xs`, `s`, `m`, `l`, `xl` and SHALL NOT be configurable. Config parsing SHALL reject a `default` that names no declared profile, a profile or human table missing a tier or declaring an unknown one, and any hours value that is negative or not finite. A workspace with no `flows` block SHALL remain valid and SHALL price nothing.

#### Scenario: Valid flows block
- **WHEN** `.spego/config.yaml` declares `flows.default: zapply`, a `zapply` profile covering all five tiers, and a `human` table covering all five tiers
- **THEN** config parsing succeeds
- **AND** the resolved configuration exposes the default Flow, the profile, and the human table

#### Scenario: Default names no profile
- **WHEN** `flows.default` names a Flow absent from `flows.profiles`
- **THEN** config parsing fails with a validation error naming the missing profile

#### Scenario: Incomplete tier table
- **WHEN** a declared profile omits a tier of the fixed scale, or declares a tier outside it
- **THEN** config parsing fails with a validation error naming the offending tier

#### Scenario: Invalid hours value
- **WHEN** a profile or the human table declares a negative or non-finite hours value
- **THEN** config parsing fails with a validation error naming the offending entry

#### Scenario: Workspace without flows
- **WHEN** `.spego/config.yaml` declares no `flows` block
- **THEN** config parsing succeeds
- **AND** no change carries a Flow Estimate or a Human Estimate

