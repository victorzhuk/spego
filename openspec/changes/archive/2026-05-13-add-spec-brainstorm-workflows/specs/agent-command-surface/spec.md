## ADDED Requirements

### Requirement: Expose workflow metadata command
The system SHALL expose a `workflows` command that returns machine-readable metadata for every workflow skill.

#### Scenario: List workflow metadata as JSON
- **WHEN** an agent invokes `spego workflows --json`
- **THEN** the command returns a JSON array
- **AND** each entry contains `name`, `description`, `personas`, `phases`, `inputs`, and `outputs`
- **AND** the array contains both built-in workflows (`brainstorm-party` and `review-adversarial`)

#### Scenario: Workflows command requires no inputs
- **WHEN** an agent invokes `spego workflows`
- **THEN** the command succeeds without any required CLI flags
- **AND** it does not prompt interactively

## MODIFIED Requirements

### Requirement: Provide command metadata
The system SHALL provide machine-readable metadata for generated skills and external agents. The metadata SHALL describe both command skills (CLI wrappers) and workflow skills (multi-step processes).

#### Scenario: List command metadata
- **WHEN** an agent requests spego command metadata via `spego commands`
- **THEN** the system returns command names, descriptions, input schemas, output formats, and artifact types
- **AND** the list includes the `workflows` command introduced for workflow-skill metadata

#### Scenario: List workflow metadata
- **WHEN** an agent requests spego workflow metadata via `spego workflows`
- **THEN** the system returns workflow names, descriptions, ordered personas, ordered phases, declared inputs, and declared output artifact types
