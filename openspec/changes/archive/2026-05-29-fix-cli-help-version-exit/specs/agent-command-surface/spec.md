## ADDED Requirements

### Requirement: Help and version output are non-error exits
The CLI SHALL treat help and version output as successful exits in both human and JSON output modes. Help or version invocations SHALL NOT emit a `VALIDATION_FAILED` line on stderr, SHALL NOT emit a JSON error envelope on stderr, and SHALL exit with code `0`.

#### Scenario: Top-level help has no error noise
- **WHEN** an agent invokes `spego --help`
- **THEN** stdout contains the program help text
- **AND** stderr does not contain `VALIDATION_FAILED`
- **AND** stderr does not contain the `⚠️` prefix
- **AND** the process exits with code `0`

#### Scenario: No-arg invocation prints help cleanly
- **WHEN** an agent invokes `spego` with no arguments
- **THEN** stdout contains the program help text
- **AND** stderr does not contain `VALIDATION_FAILED`
- **AND** the process exits with code `0`

#### Scenario: Subcommand help has no error noise
- **WHEN** an agent invokes `spego create --help`
- **THEN** stdout contains the subcommand help text
- **AND** stderr does not contain `VALIDATION_FAILED`
- **AND** the process exits with code `0`

#### Scenario: Version flag has no error noise
- **WHEN** an agent invokes `spego --version`
- **THEN** stdout contains the version string from `package.json`
- **AND** stderr does not contain `VALIDATION_FAILED`
- **AND** the process exits with code `0`

#### Scenario: Help in JSON mode emits no error envelope
- **WHEN** an agent invokes `spego --json --help`
- **THEN** stderr does not contain a JSON object with `error.code = "VALIDATION_FAILED"`
- **AND** the process exits with code `0`

#### Scenario: Real validation errors still surface
- **WHEN** an agent invokes `spego` with an unknown option such as `--nope`
- **THEN** stderr contains `[VALIDATION_FAILED]` in human mode (or a JSON envelope with `error.code = "VALIDATION_FAILED"` in `--json` mode)
- **AND** the process exits with a non-zero code
