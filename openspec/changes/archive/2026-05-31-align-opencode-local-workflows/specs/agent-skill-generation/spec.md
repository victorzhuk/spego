## ADDED Requirements

### Requirement: Clean up stale OpenCode compatibility assets
The OpenCode generator SHALL remove stale generated OpenCode command, skill, and agent assets that conflict with the current Spego-local/OpenCode-current-session boundary. Cleanup SHALL preserve user-owned files that do not carry the Spego-generated marker.

#### Scenario: Stale generated OpenCode command assets are removed
- **WHEN** an agent runs `spego skills` with the `opencode` target configured
- **AND** a stale generated `.opencode/commands/opsx-*.md` file exists with the `spego_generated: true` marker
- **THEN** the system removes the stale generated command file
- **AND** the generation report includes the removed path

#### Scenario: Stale generated OpenCode skill assets are removed
- **WHEN** an agent runs `spego skills` with the `opencode` target configured
- **AND** a stale generated `.opencode/skills/openspec-*/SKILL.md` file exists with the `spego_generated: true` marker
- **THEN** the system removes the stale generated skill file
- **AND** the generation report includes the removed path

#### Scenario: User-owned OpenCode compatibility assets are preserved
- **WHEN** a stale OpenCode compatibility path exists without the `spego_generated: true` marker
- **THEN** the system does not remove the file
- **AND** the generation report marks that path as skipped

### Requirement: Repository-owned OpenCode compatibility assets follow the current boundary
Repository-owned OpenCode compatibility commands and skills SHALL NOT instruct users to run daemon-backed OpenCode orchestration or use Claude-specific tool names.

#### Scenario: Repository OpenCode assets avoid daemon orchestration
- **WHEN** repository OpenCode command or skill files are present
- **THEN** they do not instruct users to run `spego orchestrate`
- **AND** they do not instruct users to run `opencode serve`
- **AND** they do not describe OpenCode REST API configuration as required workflow setup

#### Scenario: Repository OpenCode assets use OpenCode-neutral tool wording
- **WHEN** repository OpenCode command or skill files are present
- **THEN** they do not contain `AskUserQuestion tool`
- **AND** they do not contain `TodoWrite tool`
- **AND** they do not contain `subagent_type: "general-purpose"`
- **AND** they do not contain `Skill tool`
