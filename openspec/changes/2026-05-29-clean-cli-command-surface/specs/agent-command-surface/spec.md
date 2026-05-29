## ADDED Requirements

### Requirement: Run every command through a single runtime helper
The system SHALL implement every public command via a shared runtime helper that resolves the global `--json` flag, optionally opens an `ArtifactEngine`, runs the command body, emits the success payload, formats errors, and closes engine resources. No command-specific code SHALL repeat the engine-open / try-catch-finally / output / error-mapping boilerplate.

#### Scenario: Engine commands always close the index
- **WHEN** a command that requires the artifact engine succeeds or fails
- **THEN** the runtime helper closes the engine before the process exits
- **AND** no command body is responsible for calling `engine.close()` directly

#### Scenario: Errors route through one helper
- **WHEN** any command throws a `SpegoError`, a generic `Error`, or a non-`Error` throwable
- **THEN** the runtime helper emits the human or JSON error envelope according to `--json`
- **AND** the same helper handles commander validation errors via `program.exitOverride`

#### Scenario: Installed package bin executes through npm symlink
- **WHEN** spego is installed from an npm package tarball
- **AND** a user invokes the generated `node_modules/.bin/spego --version` bin symlink
- **THEN** the CLI entrypoint executes
- **AND** stdout contains the package version

### Requirement: Symmetric success payload for read and update
The system SHALL return the same artifact record shape from `spego read` and `spego update` JSON output so agents can read and write through identical parsing code.

#### Scenario: Update returns frontmatter and body
- **WHEN** an agent invokes `spego --json update --id <id> --body <text>`
- **THEN** the JSON payload contains `id`, `revision`, `path`
- **AND** the JSON payload also contains `frontmatter` and `body`
- **AND** `frontmatter.id` equals the `id` field

#### Scenario: Read shape unchanged
- **WHEN** an agent invokes `spego --json read --id <id>`
- **THEN** the JSON payload contains `frontmatter`, `body`, and `path`

### Requirement: Stable validation error envelope
The system SHALL emit a stable error envelope for every failure mode in `--json` mode: `{ error: { code, message, details } }`. The `details` field SHALL always be an object, even when empty.

#### Scenario: Commander validation errors include details
- **WHEN** a user invokes `spego --json --bogus`
- **THEN** stderr contains a parseable JSON object
- **AND** `error.code` equals `VALIDATION_FAILED`
- **AND** `error.details` is an object (possibly empty)

#### Scenario: Domain errors preserve their details
- **WHEN** a `SpegoError` is raised with `details: { foo: 'bar' }`
- **THEN** the JSON envelope has `error.details.foo === 'bar'`

#### Scenario: Internal errors include details
- **WHEN** a non-`SpegoError`, non-validation error is raised in `--json` mode
- **THEN** `error.code` equals `INTERNAL`
- **AND** `error.details` is an object (possibly empty)

### Requirement: Consistent human headers across commands
The system SHALL prefix every command's primary human output with a `renderHeader(emoji, label)` line drawn from a small fixed emoji set. Commands without tabular results MAY follow the header with a single summary line; commands with tabular results MUST follow the header with the table or the empty-state hint.

#### Scenario: Create has a header
- **WHEN** an agent invokes `spego create --type prd --title T --body b`
- **THEN** the first line of stdout contains an emoji header that begins with `✨`

#### Scenario: Delete has a header
- **WHEN** an agent invokes `spego delete --id <id>`
- **THEN** the first line of stdout contains an emoji header that begins with `🗑`

#### Scenario: Index rebuild has a header
- **WHEN** an agent invokes `spego index rebuild`
- **THEN** the first line of stdout contains an emoji header that begins with `📦`

### Requirement: Body input is unified across create and update
The system SHALL accept artifact body input from either the `--body` flag, a `--body-file <path>` flag, or stdin when `--body-file -` is supplied. The same resolution rules SHALL apply to `spego create` and `spego update`.

#### Scenario: Create reads body from file
- **WHEN** an agent invokes `spego create --type prd --title T --body-file ./body.md`
- **THEN** the created artifact's body equals the contents of `./body.md`

#### Scenario: Update reads body from stdin
- **WHEN** an agent invokes `spego update --id <id> --body-file -` and pipes content into stdin
- **THEN** the artifact body is replaced with the piped content
