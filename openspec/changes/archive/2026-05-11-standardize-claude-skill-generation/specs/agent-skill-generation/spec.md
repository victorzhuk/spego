## MODIFIED Requirements

### Requirement: Generate configured agent skills
The system SHALL generate skill files for each configured agent target during initialization or regeneration.

#### Scenario: Generate Claude skills as directories
- **WHEN** an agent runs `spego init --agents claude`
- **THEN** the system writes each skill as `.claude/skills/spego-<command>/SKILL.md`
- **AND** each `SKILL.md` has YAML frontmatter starting at line 1 with `---`
- **AND** the frontmatter contains valid `name` and `description` fields
- **AND** the `description` describes what the skill does and when to use it

#### Scenario: Regenerate skills
- **WHEN** an agent runs skill regeneration after command metadata changes
- **THEN** the system updates generated files deterministically
- **AND** it reports created, updated, and unchanged files

#### Scenario: Clean up legacy flat files
- **WHEN** regeneration finds a spego-generated flat file at `.claude/skills/spego-<command>.md`
- **THEN** the system removes it and reports the cleanup

### Requirement: Preserve user-owned files
The system SHALL not overwrite user-owned files unless they are marked as spego-generated or force is requested.

#### Scenario: Existing generated file
- **WHEN** a generated spego skill file already exists
- **THEN** the system may replace it with the new deterministic output

#### Scenario: Existing custom file
- **WHEN** a target path exists without a spego-generated marker
- **THEN** the system refuses to overwrite it
- **AND** it reports the conflicting path

### Requirement: Generate target-specific paths
The system SHALL write generated skills and commands to the path conventions for the target agent.

#### Scenario: Claude target paths
- **WHEN** the target agent is `claude`
- **THEN** skills are written under `.claude/skills/spego-<command>/SKILL.md`
- **AND** commands are written under `.claude/commands/spego/`
