## 1. Specification

- [ ] 1.1 Add a `Help and version output are non-error exits` requirement to the `agent-command-surface` capability in the delta spec at `openspec/changes/2026-05-29-fix-cli-help-version-exit/specs/agent-command-surface/spec.md`.
- [ ] 1.2 Run `openspec validate fix-cli-help-version-exit --strict` and resolve any structural errors before implementation begins.

## 2. Fix `exitOverride` in `src/cli.ts`

- [ ] 2.1 In `buildProgram()` (around lines 154–164 of [src/cli.ts](file:///home/zhuk/Projects/own/spego/src/cli.ts#L154-L164)), branch on `err.code` inside the `exitOverride` callback.
- [ ] 2.2 Treat `commander.help`, `commander.helpDisplayed`, and `commander.version` as success: do not write any stderr line in human mode, do not write any JSON error envelope in JSON mode, and exit with `err.exitCode ?? 0`.
- [ ] 2.3 Keep the existing `[VALIDATION_FAILED]` / JSON error envelope behavior for all other Commander error codes, but use `err.exitCode ?? 2` instead of a hard-coded `2`.
- [ ] 2.4 Leave the `configureOutput` writer untouched — it already suppresses Commander's own stderr in JSON mode.

## 3. Tests

- [ ] 3.1 Add `test/cli-help-exit.test.ts` that spawns `node dist/cli.js` (after a build, or use `tsx src/cli.ts`) with each of: `--help`, `--version`, no args, and `<subcommand> --help`, and asserts that:
  - exit code is `0`
  - stderr is empty (no `⚠️` prefix, no `VALIDATION_FAILED`, no JSON error envelope)
  - stdout contains the expected help/version text
- [ ] 3.2 Add the same four cases with the global `--json` flag and assert stderr is empty and stdout still contains help/version text (Commander writes help to stdout, not JSON, and that is acceptable — the requirement is "no error envelope").
- [ ] 3.3 Add a regression case for a real validation error (e.g. `spego create` with no args, or an unknown flag like `--nope`) and assert exit code is non-zero and the human-mode stderr still starts with `⚠️  [VALIDATION_FAILED]`.

## 4. Verification

- [ ] 4.1 Run `npm test` (or the project's test script) and confirm all new and existing tests pass.
- [ ] 4.2 Run `npm run build` then manually exercise `node dist/cli.js`, `node dist/cli.js --help`, `node dist/cli.js --version`, and `node dist/cli.js create --help`; confirm none print the `⚠️  [VALIDATION_FAILED] (outputHelp)` line and all exit with code `0`.
- [ ] 4.3 Run `openspec validate fix-cli-help-version-exit --strict` once more to confirm the change is still structurally valid after spec edits.
