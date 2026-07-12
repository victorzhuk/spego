## ADDED Requirements

### Requirement: CLI option input errors are validation errors
The system SHALL report malformed CLI option values and unreadable option-referenced files as validation errors: the structured error envelope MUST carry code `VALIDATION_FAILED` and the process MUST exit with code 2, never the internal-error code and exit 1.

#### Scenario: Malformed --meta JSON
- **WHEN** `spego create` or `spego update` receives `--meta` that is not valid JSON
- **THEN** the command exits with code 2 and a `VALIDATION_FAILED` error naming the `--meta` option

#### Scenario: Unreadable --body-file
- **WHEN** a command receives `--body-file` pointing to a path that cannot be read
- **THEN** the command exits with code 2 and a `VALIDATION_FAILED` error naming the path

#### Scenario: Non-integer --revision
- **WHEN** `spego read` or `spego view` receives `--revision` that is not a positive integer
- **THEN** the command exits with code 2 and a `VALIDATION_FAILED` error, without attempting a revision-file lookup
