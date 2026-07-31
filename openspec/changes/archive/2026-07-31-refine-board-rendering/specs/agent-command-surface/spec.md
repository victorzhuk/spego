## MODIFIED Requirements

### Requirement: Human output uses pretty rendering primitives
The system SHALL render human output using a small fixed set of visual primitives so the surface stays scannable, copy-pasteable, and stable across commands. Every command SHALL render a section: an emoji header line, one blank line, then content blocks separated by blank lines; empty states keep the section header above the message. A left-railed, right-bordered panel — a title embedded in a top rule, each body line prefixed by a left rail and suffixed by a right border, and a bottom rule — is one of these primitives; it SHALL render identically regardless of `--plain`, `NO_COLOR`, or TTY detection, since it is structural rather than a color or text decoration.

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

#### Scenario: View overview renders a totals box and per-type tables
- **WHEN** an agent invokes `spego view` without `--json` against a workspace with multiple artifacts, and without `--detail`
- **THEN** the output begins with a section header line
- **AND** it contains a bordered summary box drawn with rounded box-drawing characters
- **AND** it contains one aligned table per artifact type, each with a header row separated from data rows by `─` characters

#### Scenario: View bundle separates artifacts with a divider
- **WHEN** an agent invokes `spego view --detail` without `--json` against a workspace with multiple artifacts
- **THEN** the output begins with a section header line
- **AND** consecutive artifacts in the bundle are separated by a single `────` divider line

#### Scenario: Empty list prints a plain message
- **WHEN** an agent invokes `spego list` without `--json` against a workspace with no artifacts
- **THEN** the output is a single line `No artifacts.` with no emoji and no table

#### Scenario: Board sections use a left-railed panel
- **WHEN** an agent invokes `spego board` without `--json` against a workspace with at least one sprint
- **THEN** the sprint section renders as a left-railed, right-bordered panel: a top rule carrying the title, a `│ `-prefixed and ` │`-suffixed body, and a bottom rule

#### Scenario: The rail is structural, not a color decoration
- **WHEN** an agent invokes `spego board --plain`, or when stdout is not a TTY
- **THEN** the left-railed, right-bordered panel still renders
- **AND** only the bold, underline, strikethrough, and dim decorations are suppressed
