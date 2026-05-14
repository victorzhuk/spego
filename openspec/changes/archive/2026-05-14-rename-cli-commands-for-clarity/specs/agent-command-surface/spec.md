## ADDED Requirements

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
