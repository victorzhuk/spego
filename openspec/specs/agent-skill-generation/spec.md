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

## ADDED Requirements

### Requirement: Generate skills regeneration command at the new path
The system SHALL emit the regenerated agent toolchain files for the skills regeneration command at paths that match its new name (`skills`) for every configured agent target.

#### Scenario: Claude target writes the new path
- **WHEN** an agent runs `spego skills` with the Claude target configured
- **THEN** the system writes the skill file at `.claude/skills/spego-skills/SKILL.md`
- **AND** the system writes the slash-command file at `.claude/commands/spego/skills.md`
- **AND** both files carry the `spego_generated: true` marker

### Requirement: Clean up legacy regenerate paths on regeneration
The system SHALL remove the legacy generated paths produced by the previous command name (`regenerate`) so that workspaces upgraded across the rename do not retain stale toolchain files. Cleanup SHALL only remove files that carry the `spego_generated: true` marker.

#### Scenario: Legacy Claude paths removed when present
- **WHEN** an agent runs `spego skills` and a legacy `.claude/skills/spego-regenerate/SKILL.md` exists with the `spego_generated: true` marker
- **THEN** the system removes the legacy file
- **AND** the system removes the legacy slash-command file at `.claude/commands/spego/regenerate.md` if it exists with the same marker
- **AND** the generation report includes both removed paths under a `removed` action

#### Scenario: User-owned legacy paths are preserved
- **WHEN** an agent runs `spego skills` and a legacy `.claude/skills/spego-regenerate/SKILL.md` exists without the `spego_generated: true` marker
- **THEN** the system does not remove the file
- **AND** the system reports the conflicting path

#### Scenario: Idempotent cleanup
- **WHEN** an agent runs `spego skills` twice in a row and the legacy paths existed before the first run
- **THEN** the first run reports the legacy paths under the `removed` action
- **AND** the second run does not report any `removed` actions for the legacy paths
