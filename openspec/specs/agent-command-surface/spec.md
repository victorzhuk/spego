## Purpose

Define the CLI command contract for agent-facing spego operations, including output modes, error envelopes, metadata, and command runtime behavior.
## Requirements
### Requirement: Expose artifact commands
The system SHALL expose agent-callable commands for each supported artifact type.

#### Scenario: Update PRD through command surface
- **WHEN** an agent invokes `spego update --id <id> --body <content>`
- **THEN** the command updates the artifact through the artifact engine
- **AND** it returns the updated artifact in markdown by default

#### Scenario: Get architecture as JSON
- **WHEN** an agent invokes `spego read --type architecture --slug <slug> --json`
- **THEN** the command returns structured JSON with metadata and content

### Requirement: Expose project view command
The system SHALL expose a view command that exports all or filtered artifacts.

#### Scenario: View all artifacts
- **WHEN** an agent invokes `/spego:view`
- **THEN** the command returns a markdown bundle of current artifacts

#### Scenario: View filtered artifacts
- **WHEN** an agent invokes `spego --json view --type risk`
- **THEN** the command returns JSON for current risk artifacts only

### Requirement: Avoid post-init prompts
The system SHALL avoid human CLI prompts after project initialization.

#### Scenario: Missing required argument
- **WHEN** an agent invokes a command without required input
- **THEN** the command returns a structured error describing the missing argument
- **AND** it does not prompt interactively

### Requirement: Keep public CLI command surface local-only
The public spego CLI command surface SHALL expose local artifact, workspace, delivery-view, metadata, and regeneration commands only. It SHALL NOT expose commands that start or control OpenCode execution through a daemon.

#### Scenario: Orchestrate command is not registered
- **WHEN** an agent invokes `spego commands --json`
- **THEN** the command metadata does not contain an entry named `orchestrate`

#### Scenario: Help excludes orchestrate
- **WHEN** a user invokes `spego --help`
- **THEN** the help output does not list `orchestrate`

#### Scenario: OpenCode workflows are generated commands, not spego CLI commands
- **WHEN** an agent invokes `spego commands --json`
- **THEN** the command metadata does not contain entries named `apply`, `verify`, or `explore`
- **AND** OpenCode apply, verify, and explore behavior is provided through generated `.opencode/commands/spego-*.md` files instead

### Requirement: Keep model selection outside spego command metadata
Spego command metadata and workspace config SHALL NOT define OpenCode model, variant, or reasoning-effort settings for workflow execution. Those runtime choices SHALL remain in OpenCode configuration or the active OpenCode session.

#### Scenario: Workspace config omits OpenCode runtime model tiers
- **WHEN** a new workspace config is written
- **THEN** it does not contain OpenCode orchestration model tier fields such as `manager`, `worker`, `verifier`, or `fallback`

#### Scenario: Generated OpenCode command frontmatter omits model selection
- **WHEN** OpenCode workflow commands are generated
- **THEN** their generated frontmatter does not set `model`
- **AND** their generated frontmatter does not set `agent`

### Requirement: Provide command metadata
The system SHALL provide machine-readable metadata for generated skills and external agents. The metadata SHALL describe both command skills (CLI wrappers) and workflow skills (multi-step processes).

#### Scenario: List command metadata
- **WHEN** an agent requests spego command metadata via `spego commands`
- **THEN** the system returns command names, descriptions, input schemas, output formats, and artifact types
- **AND** the list includes the `workflows` command introduced for workflow-skill metadata

#### Scenario: List workflow metadata
- **WHEN** an agent requests spego workflow metadata via `spego workflows`
- **THEN** the system returns workflow names, descriptions, ordered personas, ordered phases, declared inputs, and declared output artifact types

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

### Requirement: Provide dual output modes for every command
The system SHALL emit human-friendly output by default and machine-parseable JSON when the global `--json` flag is supplied. Every command exposed by the CLI — including `commands`, `workflows`, `index rebuild`, and any future command — SHALL implement both modes.

#### Scenario: Default human output for metadata commands
- **WHEN** an agent invokes `spego commands` without `--json`
- **THEN** the command writes a human-readable section to stdout
- **AND** the output is not valid JSON
- **AND** the output contains a header line that includes the label `Commands`

#### Scenario: JSON output for metadata commands
- **WHEN** an agent invokes `spego commands --json`
- **THEN** the command writes valid JSON to stdout
- **AND** the JSON is the existing `COMMAND_REGISTRY` array shape

#### Scenario: Default human output for workflows
- **WHEN** an agent invokes `spego workflows` without `--json`
- **THEN** the command writes a human-readable section to stdout
- **AND** the output is not valid JSON
- **AND** the output contains a header line that includes the label `Workflows`

#### Scenario: JSON output for workflows
- **WHEN** an agent invokes `spego workflows --json`
- **THEN** the command writes a valid JSON array to stdout
- **AND** each entry contains `name`, `description`, `personas`, `phases`, `inputs`, and `outputs`

### Requirement: Human output uses pretty rendering primitives
The system SHALL render human output using a small fixed set of visual primitives so the surface stays scannable, copy-pasteable, and stable across commands. Every command SHALL render a section: an emoji header line, one blank line, then content blocks separated by blank lines; empty states keep the section header above the message.

#### Scenario: Workspace status uses a bordered summary box
- **WHEN** an agent invokes `spego status` without `--json` against an initialized workspace
- **THEN** the output contains a bordered summary box drawn with rounded box-drawing characters (`╭`, `╮`, `╰`, `╯`, `─`, `│`)
- **AND** the box rows include the workspace root, configured agents, artifacts root, and index path

#### Scenario: List uses an aligned table
- **WHEN** an agent invokes `spego list` without `--json`
- **THEN** the output begins with a section header line prefixed by a single emoji
- **AND** when at least one artifact exists, the rows are formatted as an aligned table with a header row separated from data rows by `─` characters
- **AND** values longer than the column width are truncated with a trailing `…`

#### Scenario: Read uses a header-and-divider format
- **WHEN** an agent invokes `spego read --id <id>` without `--json`
- **THEN** the first line of output is `<emoji> <type>/<slug>  rev <n>  (<id>)`
- **AND** the next line is a `────` divider
- **AND** the remaining lines are the artifact body

#### Scenario: View bundle separates artifacts with a divider
- **WHEN** an agent invokes `spego view` without `--json` against a workspace with multiple artifacts
- **THEN** the output begins with a section header line
- **AND** consecutive artifacts in the bundle are separated by a single `────` divider line

#### Scenario: Empty list prints a plain message
- **WHEN** an agent invokes `spego list` without `--json` against a workspace with no artifacts
- **THEN** the output is a single line `No artifacts.` with no emoji and no table

### Requirement: JSON mode is deterministic and decoration-free
The system SHALL produce JSON output that is free of decoration, emoji, and human-only formatting, so agents can parse it without preprocessing.

#### Scenario: JSON output contains no emoji or box-drawing characters
- **WHEN** an agent invokes any spego command with `--json`
- **THEN** the stdout output parses as JSON
- **AND** the output contains no emoji codepoints
- **AND** the output contains no box-drawing characters

#### Scenario: JSON error envelope on failure
- **WHEN** a spego command fails with `--json`
- **THEN** stderr contains a JSON object with an `error` field
- **AND** the `error` object contains a `code` string and a `message` string

#### Scenario: Human error format on failure
- **WHEN** a spego command fails without `--json`
- **THEN** stderr starts with a single line of the form `⚠️  [<code>] <message>`
- **AND** stdout is empty

### Requirement: The global flag is the only JSON switch
The system SHALL treat the global `--json` flag as the only way to request JSON output. The previous `view --format <fmt>` flag SHALL be rejected as an unknown option.

#### Scenario: View accepts the global JSON flag
- **WHEN** an agent invokes `spego view --json`
- **THEN** the command writes the artifact bundle as JSON to stdout

#### Scenario: View rejects the removed --format flag
- **WHEN** an agent invokes `spego view --format json`
- **THEN** the command fails with a nonzero exit code and an unknown-option error

### Requirement: Expose the skills regeneration command
The system SHALL expose a top-level `skills` command that regenerates agent toolchain files (skill files and command files) for every configured agent target. The command SHALL replace the previous `regenerate` command and SHALL appear in `spego --help` and `spego commands` output.

#### Scenario: Skills command runs end-to-end
- **WHEN** an agent invokes `spego skills`
- **THEN** the command regenerates skill and command files for every configured agent target
- **AND** the command exits with code 0 on success
- **AND** the command output (human or JSON) reports the per-file actions: created, updated, unchanged, removed

#### Scenario: Skills command appears in metadata
- **WHEN** an agent invokes `spego commands`
- **THEN** the output contains an entry with `name: "skills"`, `slashName: "/spego:skills"`, `category: "workspace"`
- **AND** the output does not contain an entry named `regenerate`

#### Scenario: Skills command appears in help
- **WHEN** an agent invokes `spego --help`
- **THEN** the output lists `skills` as an available command
- **AND** the output does not list `regenerate`

### Requirement: Retain regenerate as a hidden alias for one release
The system SHALL retain `spego regenerate` as a hidden alias that delegates to the same action handler as `spego skills`. The alias SHALL emit a deprecation warning in human mode and SHALL be removed in the next minor release.

#### Scenario: Hidden alias still functions
- **WHEN** an agent invokes `spego regenerate`
- **THEN** the command performs the same regeneration as `spego skills`
- **AND** the command exits with code 0 on success

#### Scenario: Deprecation warning in human mode
- **WHEN** an agent invokes `spego regenerate` without `--json`
- **THEN** the command writes a single deprecation warning line to stderr that mentions both `regenerate` and `skills`

#### Scenario: No deprecation warning in JSON mode
- **WHEN** an agent invokes `spego regenerate --json`
- **THEN** the command writes the regeneration report to stdout as JSON
- **AND** the command writes no deprecation warning to stderr

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

### Requirement: Expose board command
The system SHALL expose `spego board` on the CLI surface with the same conventions as every other command: pretty human output by default, deterministic JSON under the global `--json` flag, entry in the command metadata registry, and no interactive prompts.

#### Scenario: Board as JSON
- **WHEN** an agent runs `spego board --json`
- **THEN** stdout carries only the deterministic JSON document
- **AND** errors follow the standard `{ "error": { "code", "message", "details" } }` contract on stderr

#### Scenario: Board in command metadata
- **WHEN** an agent runs `spego commands --json`
- **THEN** the listing includes `board` with its flags and description

### Requirement: Expose sprints command
The system SHALL expose `spego sprints` as a read-only listing of `sprint-plan` artifacts in board order (start date ascending, undated last, then slug), with human table output and deterministic JSON under the global `--json` flag.

#### Scenario: Sprints as JSON
- **WHEN** an agent runs `spego sprints --json`
- **THEN** stdout carries a JSON array where each entry has `id`, `slug`, `title`, `status`, `startDate`, `endDate`, and `changes`

### Requirement: Status reports delivery drift
The system SHALL include an advisory drift summary in `spego status` when the workspace has an OpenSpec delivery source: counts of board drift warnings (`dangling-dep`, `dep-cycle`, `ungroomed-change`, `orphan-epic`, `archived-in-sprint`, `closable-sprint`) and a pointer to the groom workflow. Drift derivation failures SHALL NOT fail the status command.

#### Scenario: Drift present
- **WHEN** an agent runs `spego status --json` in a workspace with ungroomed changes
- **THEN** the payload includes a `drift` object with `warnings` and per-code counts

#### Scenario: No delivery source
- **WHEN** an agent runs `spego status --json` in a workspace without OpenSpec
- **THEN** the payload has no `drift` field

