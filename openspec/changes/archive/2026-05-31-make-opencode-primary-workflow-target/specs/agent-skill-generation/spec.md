## MODIFIED Requirements

### Requirement: Generate configured agent skills
The system SHALL generate toolchain files for each configured agent target during initialization or regeneration. For Claude targets this includes both *command skills* (one per entry in `COMMAND_REGISTRY`) and *workflow skills* (one per entry in `WORKFLOW_REGISTRY`) using Claude path and frontmatter conventions. For OpenCode targets this includes OpenCode command files for supported OpenCode workflows using OpenCode path and frontmatter conventions.

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

#### Scenario: Generate OpenCode workflow commands
- **WHEN** an agent runs `spego init --agents opencode`
- **THEN** the system writes OpenCode command files under `.opencode/commands/`
- **AND** the generated OpenCode command files carry the `spego_generated: true` and `spego_version` markers in frontmatter

#### Scenario: Regenerate skills
- **WHEN** an agent runs skill regeneration after command or workflow metadata changes
- **THEN** the system updates generated files deterministically
- **AND** it reports created, updated, and unchanged files for command skills, workflow skills, and OpenCode command files that belong to configured targets

#### Scenario: Clean up legacy flat files
- **WHEN** regeneration finds a spego-generated flat file at `.claude/skills/spego-<command>.md` or `.claude/skills/spego-<workflow>.md`
- **THEN** the system removes it and reports the cleanup

#### Scenario: Idempotent regeneration
- **WHEN** regeneration runs twice in a row with no source changes
- **THEN** every command, workflow, and OpenCode command file for configured targets is reported as `unchanged` on the second run

### Requirement: Generate target-specific paths
The system SHALL write generated skills and commands to the path conventions for the target agent and SHALL only generate target-specific files for configured targets.

#### Scenario: Claude target paths
- **WHEN** the target agent is `claude`
- **THEN** skills are written under `.claude/skills/spego-<command>/SKILL.md`
- **AND** commands are written under `.claude/commands/spego/`

#### Scenario: OpenCode target paths
- **WHEN** the target agent is `opencode`
- **THEN** OpenCode workflow commands are written under `.opencode/commands/`
- **AND** OpenCode generated command names use the `spego-` prefix
- **AND** no `.claude/` files are written solely because `opencode` is configured

## ADDED Requirements

### Requirement: Clean up legacy generated orchestrate wrappers
The system SHALL remove stale generated Claude wrappers for the removed `orchestrate` command during regeneration. Cleanup SHALL only remove files that carry the `spego_generated: true` marker.

#### Scenario: Legacy Claude orchestrate wrappers removed when present
- **WHEN** an agent runs `spego skills` and `.claude/skills/spego-orchestrate/SKILL.md` exists with the `spego_generated: true` marker
- **THEN** the system removes the legacy skill file
- **AND** the system removes `.claude/commands/spego/orchestrate.md` if it exists with the same marker
- **AND** the generation report includes removed actions for those paths

#### Scenario: User-owned orchestrate wrappers are preserved
- **WHEN** an agent runs `spego skills` and a legacy Claude orchestrate wrapper exists without the `spego_generated: true` marker
- **THEN** the system does not remove the file
- **AND** the generation report marks that path as skipped
