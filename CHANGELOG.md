# Changelog

## [0.2.0] - 2026-05-09

### Added
- Generated Claude skills and slash commands from spego command metadata.
- `spego commands` for machine-readable command metadata.
- `spego regenerate` for deterministic generated-file updates.
- Read-oriented delivery adapter contract.
- OpenSpec delivery adapter for epics and tasks.
- `spego epics` and `spego tasks` commands.
- GitHub Actions CI and npm publish workflow.
- Package metadata tests and npm pack checks.

## [0.1.0] - 2026-05-09

### Added
- Initial TypeScript CLI package for agent-first product orchestration.
- `.spego/` workspace initialization and status reporting.
- Markdown-first artifact storage with YAML frontmatter.
- Artifact CRUD with validation, soft delete, stale revision checks, and revision snapshots.
- SQLite index for artifact metadata, revisions, listing, and rebuilds.
- Markdown and JSON artifact export/view support.
- Per-type metadata schemas for all built-in artifact types.
