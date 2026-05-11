## Context

The current generator writes flat markdown files (`.claude/skills/spego-create.md`) with an HTML comment marker before YAML frontmatter. Claude Code expects skills as directories containing `SKILL.md` with YAML frontmatter at line 1. The comment-before-frontmatter pattern breaks Claude's skill discovery.

## Goals / Non-Goals

**Goals:**

- Generate skills in the official `.claude/skills/<name>/SKILL.md` directory format.
- Ensure YAML frontmatter starts at line 1 for valid Claude skill discovery.
- Move the spego-generated marker into YAML frontmatter metadata.
- Write description values that follow Claude best practices.
- Clean up legacy flat generated files during regeneration.

**Non-Goals:**

- No changes to the slash command generation (`.claude/commands/spego/`).
- No new target adapters (Cursor, etc.).
- No changes to the artifact engine or CLI beyond metadata fixes.

## Decisions

### Directory-based skill layout

Generate `SKILL.md` inside per-command directories. This matches Claude Code's documented format and allows future addition of `references/` or `scripts/` within each skill directory.

Alternative considered: keep flat files. Rejected because Claude Code does not discover flat files as skills.

### Marker inside frontmatter

Use a `spego_generated: true` YAML field plus a `spego_version: N` field in the frontmatter. This preserves the overwrite-protection logic without breaking YAML parsing.

Alternative considered: comment after frontmatter. Rejected because it adds complexity to the marker detection logic without clear benefit.

### Description enrichment

Each generated skill description includes the command purpose and trigger terms. This follows Claude's official best practice: "Include both what the Skill does and when to use it."

### Kebab-case flags

Render CLI flags in kebab-case (e.g. `--body-file` not `--bodyFile`) to match actual CLI behavior.

## Risks / Trade-offs

- Path change breaks existing `.gitignore` patterns that reference flat skill files.
- Legacy flat files remain until regeneration runs. Users must re-run `spego regenerate` or `spego init`.
- Moving the marker into frontmatter means the marker format changes. Old markers (HTML comment) are no longer emitted, but old files with HTML markers are still detected for cleanup.

## Migration Plan

On regeneration, the generator detects and removes old flat files (`spego-<command>.md`) that contain the spego-generated marker, then creates new directory-based skills. No manual migration needed.

## Open Questions

None.
