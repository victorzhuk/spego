## 1. Command Registry

- [x] 1.1 Define command metadata for `/spego:init`, artifact commands, `/spego:view`, `/spego:epics`, and `/spego:tasks`.
- [x] 1.2 Define input schemas and output modes for command metadata.
- [x] 1.3 Add a CLI command that prints command metadata as JSON.

## 2. Generator Core

- [x] 2.1 Implement target-agent generator interface.
- [x] 2.2 Implement deterministic generated-file markers and overwrite checks.
- [x] 2.3 Implement generation report with created, updated, unchanged, and skipped files.
- [x] 2.4 Add regeneration command for existing spego workspaces.

## 3. Claude Target

- [x] 3.1 Add Claude Code skill templates for spego commands.
- [x] 3.2 Add Claude Code slash command templates under `.claude/commands/spego/`.
- [x] 3.3 Generate target-specific paths for `.claude/skills/` and `.claude/commands/spego/`.
- [x] 3.4 Ensure generated skills delegate persistence and rendering to spego CLI/API commands.

## 4. Command Behavior

- [x] 4.1 Implement non-interactive error responses for missing required inputs.
- [x] 4.2 Implement markdown default output and `--format json` output.
- [x] 4.3 Add prompt-injection guardrails to generated skill instructions.
- [x] 4.4 Add generator version metadata to generated files.

## 5. Tests

- [x] 5.1 Add snapshot tests for generated Claude skill and command files.
- [x] 5.2 Add tests for preserving user-owned files.
- [x] 5.3 Add tests for deterministic regeneration.
- [x] 5.4 Add command metadata tests for required schemas and output formats.
