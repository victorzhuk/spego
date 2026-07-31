## ADDED Requirements

### Requirement: Expose sync command
The system SHALL expose `spego sync` on the CLI surface with the same conventions as every other command: pretty human output by default, deterministic JSON under the global `--json` flag, entry in the command metadata registry, and no interactive prompts. It SHALL accept a `--dry-run` flag that derives and reports the reconciliation plan without writing.

#### Scenario: Sync as JSON
- **WHEN** an agent runs `spego sync --json`
- **THEN** stdout carries a deterministic JSON document with the applied actions and the remaining judgment-only warnings
- **AND** errors follow the standard `{ "error": { "code", "message", "details" } }` contract on stderr

#### Scenario: Sync in command metadata
- **WHEN** an agent runs `spego commands --json`
- **THEN** the listing includes `sync` with its flags and description

#### Scenario: Sync requires no interactive input
- **WHEN** an agent runs `spego sync` in a workspace with pending reconciliation actions
- **THEN** the command applies them and exits without prompting interactively
