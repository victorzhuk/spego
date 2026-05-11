## Why

spego generates Claude Code skills as flat files (`.claude/skills/spego-create.md`), but the official Claude Code skill format requires `.claude/skills/<skill-name>/SKILL.md` with YAML frontmatter starting at line 1. The current output violates both the path convention and frontmatter format, preventing Claude from discovering spego skills automatically.

## What Changes

- Generate each spego command skill as `.claude/skills/spego-<command>/SKILL.md` (directory-based).
- Ensure YAML frontmatter (`---` open) starts at line 1 — move the spego-generated marker inside frontmatter metadata.
- Remove the nonstandard `triggers` frontmatter field.
- Write richer `description` values following Claude best practices (what + when).
- Render CLI flags in kebab-case to match actual CLI behavior.
- Clean up legacy flat generated files on regeneration.
- Fix `spego tasks` command metadata to include the required `--change` input.

## Capabilities

### Modified Capabilities

- `agent-skill-generation`: Skill path, frontmatter, and description format updated to match Claude Code standards.

### New Capabilities

None.

## Impact

- Changes generated file paths from flat files to directories.
- Existing spego-generated flat files are cleaned up on regeneration.
- Command metadata fix for `tasks` ensures generated skill content matches CLI reality.
- No breaking changes to the spego CLI or artifact engine.
