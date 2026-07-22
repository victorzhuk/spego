# Changelog

## [Unreleased]

### Changed
- Uniform human output: every command renders an emoji section header, one blank line, then content; empty states ("No epics.", "No artifacts.", …) keep their section header.
- Delivery board header emoji is now `📋` (the mirror emoji `🪞` renders poorly in common terminal fonts).

## [0.14.0] - 2026-07-22

### Added
- `spego sprints` lists sprint plans in board order (start date, undated last).
- `spego status` reports advisory delivery drift (ungroomed changes, orphan epics, closable sprints) with a pointer to the groom workflow.

### Changed
- **Breaking:** renamed `spego mirror` to `spego board` (`/spego:board`); the delivery board name matches what the command renders. The Mirror stays the internal derivation concept.
- **Breaking:** `spego epics` and `spego tasks` take positional arguments: `spego epics [name]`, `spego tasks <change> [task]`. The `--change` and `--task` flags are gone; mutation verbs in the name position still fail with `DELIVERY_READ_ONLY`.

### Removed
- **Breaking:** removed the deprecated `spego view --format` flag; use the global `--json` flag.

## [0.13.1] - 2026-07-21

### Changed
- `spego mirror` / `spego epics` resolve epic status from `tasks.md` on disk instead of spawning `openspec status` per change (~114x faster on multi-change workspaces) and discover changes once per render with parallelized filesystem reads.

### Removed
- Removed the per-change `openspec status` subprocess call and the "OpenSpec CLI status unavailable" fallback warning; mirror and epics no longer require the `openspec` binary on PATH.

## [0.13.0] - 2026-07-21

### Added
- `epic` artifact type for mirroring OpenSpec changes with deps, links, requires, and gaps metadata.
- `sprint-plan` metadata can list ordered OpenSpec changes, enforced to one non-closed sprint at a time.
- `spego mirror` command deriving the delivery mirror (sprint board, blockers, gaps, drift warnings, next-change suggestion) from OpenSpec changes and `epic`/`sprint-plan` artifacts, with `--graph`, `--gaps`, and deterministic `--json` output.
- `spego-groom` workflow skill for syncing delivery-mirror epics with active OpenSpec changes, analyzing deps/requires/gaps, and maintaining sprint plans.

## [0.12.0] - 2026-07-12

### Security
- Reject symlinked workspace paths and artifact files so Spego cannot read or write outside `.spego`.

### Changed
- Renamed `src/commands/` to `src/command-meta/` for clarity — only the metadata registry lives there, not command implementations.
- Lint script now enforces zero warnings (`eslint src test --max-warnings 0`).

### Removed
- Removed `main` and `types` entry points and deleted `src/index.ts` — spego is CLI-only, not a library package.
- Removed legacy `orchestration` config block acceptance from `readConfig()`; workspaces with stale `orchestration:` in `.spego/config.yaml` now get a `VALIDATION_FAILED` error telling them to delete the property.

## [0.11.0] - 2026-05-31

### Changed
- OpenCode is now a first-class generated target. Workspaces can list `opencode` in `.spego/config.yaml` to emit `/spego-apply`, `/spego-verify`, and `/spego-explore` command files under `.opencode/commands/`.
- Spego no longer exposes daemon-backed `spego orchestrate`; apply/verify/explore workflows now run inside the active OpenCode instance.
- `/spego-apply` now defines explicit current-session phases (select, load context, plan tasks, execute work, verify results, update task checkboxes, summarize status) and allows OpenCode-native subagents only inside the active instance.
- `/spego-verify` and `/spego-explore` now state they run entirely inside the active OpenCode instance.
- Build now cleans `dist/` before TypeScript compilation to prevent stale daemon-backed files from being packaged.
- Generated OpenCode commands now clean up stale `opsx-*` commands and `openspec-*` skills when they carry the `spego_generated: true` marker.

### Removed
- Removed Spego-owned OpenCode REST orchestration code and stopped writing new `orchestration` server/model config blocks.
- Removed `ultracode/` sample directory (daemon-backed multi-agent orchestrator that no longer aligns with Spego's local CLI architecture).

## [0.10.1] - 2026-05-30

### Fixed
- `npm run build` now sets executable mode (`chmod 0o755`) on `dist/cli.js` after TypeScript compilation, fixing `EACCES` failures when CI executes the installed `spego` bin symlink on clean checkouts.

## [0.10.0] - 2026-05-30

### Added
- **Multi-agent orchestration** (`spego orchestrate --change <name>`): a manager → swarm → verifier pipeline that executes a planned OpenSpec change through the OpenCode REST API, ported to TypeScript under `src/orchestration/`. Supports `sequential`/`parallel`/`adaptive` scheduling, an in-process per-task file gate, a test-backed verdict, and run-artifact persistence under a configurable work dir.
- `orchestration` block in `.spego/config.yaml` (server URL, model tiers, max parallelism, work dir) with `SPEGO_ORCHESTRATION_*` and `OPENCODE_*` environment overrides. Model identifiers are fully configurable with no fictional defaults.
- `spego init` / `spego skills` now emit the OpenCode agent prompts (`ultramanager`, `ultraworker`, `ultraverifier`) and the `orchestrate` command under `.opencode/`.
- OpenSpec change `add-ultracode-orchestration` documenting and validating the capability.

### Changed
- Archived the completed OpenSpec changes `2026-05-29-clean-cli-command-surface` and `add-ultracode-orchestration`, syncing their delta specs into the main specs tree.

## [0.9.1] - 2026-05-30

Maintenance release: cleaned up the v0.9.0 commit history. No functional changes.

## [0.9.0] - 2026-05-29

### Changed
- Refactored the CLI into shared runtime helpers and per-command registrars, reducing duplicated JSON/output/error/engine lifecycle code while preserving public command names and flags.
- `spego update --json` now returns the artifact `frontmatter`, `body`, and `path` in addition to the existing `id` and `revision` fields, matching `spego read --json` for agent parsing.
- Human output is more consistent across commands: `create`, `delete`, and `index rebuild` now use the same section-header style as the rest of the CLI.
- JSON validation errors now always include `details: {}` and exit with code 2, matching other structured CLI failures.

### Added
- Shared body input handling for `spego create` and `spego update`, including stdin support through `--body-file -`.
- End-to-end CLI coverage for `epics`, `tasks`, read selectors, revision reads, optimistic concurrency, view filters, body-file/stdin input, uninitialized status JSON, registry parity, and validation error envelopes.
- OpenSpec change `2026-05-29-clean-cli-command-surface` documenting and validating the CLI cleanup.

### Fixed
- `npm run lint` now includes `test/cli-help-exit.test.ts` and the new CLI test files in ESLint project-service configuration.
- Installed package `spego` bin symlinks now execute the CLI entrypoint correctly.

## [0.8.0] - 2026-05-22

### Added
- Combined OpenSpec + spego workflow skills: `change-brainstorm`, `change-review`, `change-verify-report`, and `change-retro`.
- README guidance for before/during/after OpenSpec change lanes with spego persistence checkpoints.

## [0.7.0] - 2026-05-14

### Changed
- **CLI output modes**: every command now emits pretty human-friendly output by default and JSON when the global `--json` flag is supplied. Human output uses bordered boxes (`╭─ ─╮`), aligned tables, single-emoji section headers (`📦 📄 🛠️ 🧭 📚 ✅`), and `────` dividers. Errors render as `⚠️  [CODE] message` in human mode and as the existing `{ error: { code, message, details } }` envelope in JSON mode.
- **`spego commands` and `spego workflows` default-mode flip**: these commands used to print JSON unconditionally; they now print human output by default. Agents and scripts that pipe their stdout MUST pass `--json` to keep getting JSON.
- **`spego regenerate` → `spego skills`**: renamed for clarity. `spego regenerate` remains as a hidden alias for one minor release with a deprecation warning. Running `spego skills` also cleans up any legacy `spego-regenerate` generated paths.

### Deprecated
- **`spego view --format <fmt>`**: superseded by the global `--json` flag. Continues to work for one minor release; emits a single `deprecated:` warning line to stderr in human mode. Will be removed in the next minor release.
- **`spego regenerate`**: renamed to `spego skills`. The hidden alias continues to work for one minor release and emits a deprecation warning in human mode. Will be removed in the next minor release.

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
