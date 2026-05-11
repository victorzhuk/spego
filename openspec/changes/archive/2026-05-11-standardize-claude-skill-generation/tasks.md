## 1. Specification

- [x] 1.1 Update `agent-skill-generation` spec to require `.claude/skills/<skill-name>/SKILL.md`.
- [x] 1.2 Add scenario for valid Claude Skill frontmatter starting at line 1.
- [x] 1.3 Add scenario for legacy flat-file cleanup.

## 2. Generator

- [x] 2.1 Change Claude skill paths to `.claude/skills/spego-<command>/SKILL.md`.
- [x] 2.2 Move spego-generated marker into YAML frontmatter (`spego_generated: true`, `spego_version: N`).
- [x] 2.3 Remove nonstandard `triggers` frontmatter field.
- [x] 2.4 Generate richer `description` values with what/when wording.
- [x] 2.5 Render CLI flags in kebab-case.

## 3. Command Metadata

- [x] 3.1 Fix `spego tasks` metadata to include required `--change` input.

## 4. Legacy Cleanup

- [x] 4.1 Add cleanup logic to remove old flat `spego-<command>.md` files that are spego-generated.
- [x] 4.2 Report cleanup actions in generation report.

## 5. Tests

- [x] 5.1 Update generator tests for directory-based `SKILL.md` paths.
- [x] 5.2 Add test for YAML-frontmatter-first generated files.
- [x] 5.3 Add legacy flat-file cleanup tests.
- [x] 5.4 Verify command metadata for `tasks` includes `--change`.

## 6. Documentation

- [x] 6.1 Update README generated-files section.

## 7. Verification

- [x] 7.1 `npm run typecheck` passes.
- [x] 7.2 `npm run lint` passes.
- [x] 7.3 `npm test` passes.
- [x] 7.4 `npm run build` passes.
