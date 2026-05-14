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
