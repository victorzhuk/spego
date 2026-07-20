## ADDED Requirements

### Requirement: Expose mirror command
The system SHALL expose `spego mirror` on the CLI surface with the same conventions as every other command: pretty human output by default, deterministic JSON under the global `--json` flag, entry in the command metadata registry, and no interactive prompts.

#### Scenario: Mirror as JSON
- **WHEN** an agent runs `spego mirror --json`
- **THEN** stdout carries only the deterministic JSON document
- **AND** errors follow the standard `{ "error": { "code", "message", "details" } }` contract on stderr

#### Scenario: Mirror in command metadata
- **WHEN** an agent runs `spego commands --json`
- **THEN** the listing includes `mirror` with its flags and description
