# Changelog

## [0.2.4] - 2026-05-10

### Fixed
- Test expectation updated to match `dist/cli.js` bin path (no `./` prefix).
- CLI `--version` now reads from `package.json` instead of hardcoded string.
- Regenerated `package-lock.json` metadata.

## [0.2.3] - 2026-05-10

### Fixed
- Removed `./` prefix from `bin` entry so npm publishes the CLI correctly.

## [0.2.2] - 2026-05-09

### Fixed
- Corrected `package.json` license from MIT to Apache-2.0 to match LICENSE file.

## [0.2.1] - 2026-05-09

### Fixed
- `npm test` now builds before running tests (self-contained on clean checkout).
- `defaultConfig()` now passes `deliveryAdapter` overrides through to the schema.
- `initWorkspace()` now re-throws config errors that are not `WORKSPACE_NOT_FOUND`.
- Generator now prints a warning to stderr for unsupported agent targets instead of silently skipping.
- `fetchCliStatus()` now runs `openspec` in the project root directory.
- `readConfig()` now wraps YAML parse errors as `VALIDATION_FAILED` SpegoError.
- Merged duplicate import in `revisions.ts`.
- Fixed all 17 ESLint warnings (unused imports, `prefer-const`, useless assignments).

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
