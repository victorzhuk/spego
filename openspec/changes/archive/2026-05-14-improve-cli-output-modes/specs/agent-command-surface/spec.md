## ADDED Requirements

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
The system SHALL render human output using a small fixed set of visual primitives so the surface stays scannable, copy-pasteable, and stable across commands.

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

### Requirement: Deprecate per-command format flags in favor of the global flag
The system SHALL treat the global `--json` flag as the only way to request JSON output. The previous `view --format <fmt>` flag SHALL be deprecated and removed in a subsequent release.

#### Scenario: View accepts the global JSON flag
- **WHEN** an agent invokes `spego view --json`
- **THEN** the command writes the artifact bundle as JSON to stdout

#### Scenario: View emits a deprecation warning for --format
- **WHEN** an agent invokes `spego view --format json`
- **THEN** the command writes the JSON bundle to stdout with exit code 0
- **AND** the command writes a single deprecation warning line to stderr that mentions `--format` and recommends `--json`

#### Scenario: View --format markdown remains supported during deprecation window
- **WHEN** an agent invokes `spego view --format markdown`
- **THEN** the command writes the markdown bundle to stdout with exit code 0
- **AND** the command writes a deprecation warning line to stderr
