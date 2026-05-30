## MODIFIED Requirements

### Requirement: Run every command through a single runtime helper
The system SHALL implement every public command via a shared runtime helper that resolves the global `--json` flag, optionally opens an `ArtifactEngine`, runs the command body, emits the success payload, formats errors, and closes engine resources. No command-specific code SHALL repeat the engine-open / try-catch-finally / output / error-mapping boilerplate. Clean builds SHALL emit an executable CLI entrypoint at `dist/cli.js` so package bin symlinks can execute it directly.

#### Scenario: Engine commands always close the index
- **WHEN** a command that requires the artifact engine succeeds or fails
- **THEN** the runtime helper closes the engine before the process exits
- **AND** no command body is responsible for calling `engine.close()` directly

#### Scenario: Errors route through one helper
- **WHEN** any command throws a `SpegoError`, a generic `Error`, or a non-`Error` throwable
- **THEN** the runtime helper emits the human or JSON error envelope according to `--json`
- **AND** the same helper handles commander validation errors via `program.exitOverride`

#### Scenario: Installed package bin executes through npm symlink
- **WHEN** spego is built from a clean checkout
- **AND** a user invokes the generated `node_modules/.bin/spego --version` bin symlink
- **THEN** the CLI entrypoint executes
- **AND** stdout contains the package version
