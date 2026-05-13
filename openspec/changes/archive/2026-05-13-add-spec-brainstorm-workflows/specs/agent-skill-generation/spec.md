## MODIFIED Requirements

### Requirement: Generate configured agent skills
The system SHALL generate skill files for each configured agent target during initialization or regeneration. Both *command skills* (one per entry in `COMMAND_REGISTRY`) and *workflow skills* (one per entry in `WORKFLOW_REGISTRY`) SHALL be generated using the same path and frontmatter conventions.

#### Scenario: Generate Claude command skills as directories
- **WHEN** an agent runs `spego init --agents claude`
- **THEN** the system writes each command skill as `.claude/skills/spego-<command>/SKILL.md`
- **AND** each `SKILL.md` has YAML frontmatter starting at line 1 with `---`
- **AND** the frontmatter contains valid `name` and `description` fields
- **AND** the `description` describes what the skill does and when to use it

#### Scenario: Generate Claude workflow skills as directories
- **WHEN** an agent runs `spego init --agents claude`
- **THEN** the system writes each workflow skill as `.claude/skills/spego-<workflow>/SKILL.md`
- **AND** each `SKILL.md` has YAML frontmatter starting at line 1 with `---`
- **AND** the frontmatter contains valid `name` and `description` fields
- **AND** the body contains a personas section, a phased walkthrough, an explicit persistence checkpoint naming the `spego` CLI command(s) to call, and a safety section
- **AND** the workflow skill carries the `spego_generated: true` and `spego_version` markers in frontmatter

#### Scenario: Regenerate skills
- **WHEN** an agent runs skill regeneration after command or workflow metadata changes
- **THEN** the system updates generated files deterministically
- **AND** it reports created, updated, and unchanged files for both command and workflow skills

#### Scenario: Clean up legacy flat files
- **WHEN** regeneration finds a spego-generated flat file at `.claude/skills/spego-<command>.md` or `.claude/skills/spego-<workflow>.md`
- **THEN** the system removes it and reports the cleanup

#### Scenario: Idempotent regeneration
- **WHEN** regeneration runs twice in a row with no source changes
- **THEN** every command and workflow skill is reported as `unchanged` on the second run
