# Changelog

## [0.6.2] - 2026-05-14

### Fixed
- Replaced hardcoded local path in authoring workflow test with repo-relative root so tests pass on CI.
- Use lightweight git tag for npm trusted publishing (OIDC) compatibility.

## [0.6.0] - 2026-05-13

### Added
- `help` workflow: read-only orientation skill that inspects workspace state and recommends next steps via in-chat recommendations.
- `brainstorm-deep` workflow: single-persona, high-volume ideation targeting 50-100 ideas with clustering and ranking. Outputs `brainstorm` artifact.
- `elicit` workflow: iterative refinement using named methods (clarify, sharpen, generalize, specialize, stress-test, contextualize, simplify, formalize) with optimistic concurrency. Maximum 5 cycles per session.
- `kind` field on `WorkflowOutput` to distinguish `create`, `update`, and `none` output types.
- "Authoring loop" guidance and "brainstorm-deep vs brainstorm-party" matrix in README.
- Authoring workflow registry and content tests.

## [0.5.0] - 2026-05-13

### Added
- `review-edge-cases` workflow: method-driven edge-case enumeration (Path-tracer, Boundary-checker, Concurrency-skeptic personas). Outputs `qa` artifact with JSON findings array.
- `editorial-prose` workflow: clinical copy-edit pass (Copy-editor persona). Applies confirmed edits in place via `spego update --expected-revision`. Outputs `qa` summary artifact.
- `editorial-structure` workflow: structural review without mutation (Structural editor persona). Outputs `qa` artifact with prioritized restructuring recommendations.
- Review suite registry and content tests.
- "Complementary reviews" guidance in README.

## [0.4.0] - 2026-05-12

### Added
- Workflow skills as a first-class concept alongside command skills.
- `WORKFLOW_REGISTRY` with two reference workflows: `brainstorm-party` and `review-adversarial`.
- `spego workflows` command listing workflow metadata as JSON.
- Generator emits workflow skill files at `.claude/skills/spego-<workflow>/SKILL.md`.
- Legacy flat-file cleanup covers workflow skill names.
- Workflow and command skill coexistence tests, CLI tests, and legacy cleanup tests.

## [0.3.0] - 2026-05-11

### Changed
- Claude skills now generate as `.claude/skills/spego-<command>/SKILL.md` directories (was flat `.claude/skills/spego-<command>.md` files).
- Spego-generated marker moved into YAML frontmatter (`spego_generated: true`, `spego_version: N`) instead of HTML comment prefix.
- Skill descriptions now include "when to use" wording.
- CLI flags in generated skill docs use kebab-case (e.g., `--body-file` instead of `--bodyFile`).

### Added
- `spego tasks` command now requires `--change` input in its metadata.
- Legacy flat-file cleanup: regeneration removes old flat `spego-<command>.md` files.
- Marker functions (`wrapWithMarker`, `isSpegoGenerated`, `isLegacySpegoGenerated`) exported from public API.

### Fixed
- Legacy HTML-comment-marked files are now recognized as spego-generated during regeneration (was silently skipped).
- `wrapWithMarker` now throws if content lacks YAML frontmatter instead of silently returning unmarked content.
- `isSpegoGenerated` now only matches the marker inside YAML frontmatter, not anywhere in the file body.
- User file protection now checks both new (YAML) and legacy (HTML comment) markers.

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
