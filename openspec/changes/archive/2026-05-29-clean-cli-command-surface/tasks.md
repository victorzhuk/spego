## 1. Specification

- [x] 1.1 Update the `agent-command-surface` capability with the consistent-runtime, symmetric-JSON, and validation-error-shape requirements introduced by this change.
- [x] 1.2 Run `openspec validate 2026-05-29-clean-cli-command-surface --strict --no-interactive` and resolve any structural errors before any code lands.

## 2. CLI runtime helpers

- [x] 2.1 Add `src/cli/output.ts` exporting `emitJson`, `emitHuman`, `output(json, payload, human)`, and `deprecate(json, message)` (move existing helpers out of `src/cli.ts`).
- [x] 2.2 Add `src/cli/errors.ts` exporting `fail(err, json)` and `failValidation(err, json)`. Validation errors include `details: {}` so agents can branch on `error.details` without checking presence.
- [x] 2.3 Add `src/cli/body-input.ts` exporting `resolveBody(opts)` that accepts `{ body?, bodyFile? }`, reads from `--body`, `--body-file <path>`, or stdin when `--body-file -`, and returns `string | undefined`. Unified across `create` and `update`.
- [x] 2.4 Add `src/cli/runtime.ts` exporting `runCommand(ctx, fn)` and `runEngineCommand(ctx, fn)` that resolve `--json`, optionally open `ArtifactEngine`, invoke `fn(...)`, emit the result via `output`, and route errors through `fail`. The engine variant guarantees `engine.close()` runs on every path.
- [x] 2.5 Move `intersperseBundleDividers` from `src/cli.ts` into `src/cli/render.ts` and add a unit test in `test/cli.render.test.ts`.

## 3. Per-command refactor

- [x] 3.1 Split `src/cli.ts` so each command group lives under `src/cli/commands/` (`meta.ts`, `workspace.ts`, `artifact.ts`, `view.ts`, `index-rebuild.ts`, `skills.ts`, `delivery.ts`). `src/cli.ts` is now a thin orchestrator that wires `buildProgram` to the per-command registrars and the runtime.
- [x] 3.2 `init`, `status`, `create`, `read`, `update`, `delete`, `list`, `index rebuild`, `skills`, `regenerate`, `epics`, `tasks`, `commands`, and `workflows` all use `runCommand`/`runEngineCommand`. `view` keeps a bespoke runtime path because it streams markdown directly to stdout.
- [x] 3.3 `create`'s human output uses `renderHeader('✨', 'Created <type>/<slug> rev <n>')` followed by a key/value summary line with `path`. `delete`'s human output uses `renderHeader('🗑', 'Deleted <id>')` followed by `at: <ts>`. `index rebuild` adds `renderHeader('📦', 'Index rebuild')` above its summary box.
- [x] 3.4 `update` JSON returns `{ id, revision, path, frontmatter, body }` (additive — existing keys remain).
- [x] 3.5 `read` and `update` route their human output through a shared `renderRecordHuman(record)` helper.
- [x] 3.6 `epics` and `tasks` use `runCommand` and a single shared `assertReadOnlyAction(action)` helper for their `DELIVERY_READ_ONLY` rejection.
- [x] 3.7 `commands` and `workflows` route through `runCommand` for symmetry with the other commands.

## 4. Validation error envelope

- [x] 4.1 Commander validation errors emit `{ error: { code: 'VALIDATION_FAILED', message, details: {} } }` in `--json` mode and exit with code 2.
- [x] 4.2 `SpegoError`-backed errors emit `{ error: { code, message, details } }` with their original `details`.
- [x] 4.3 Non-`Error` and non-`SpegoError` throwables emit `{ error: { code: 'INTERNAL', message, details: {} } }` in `--json` mode and exit code 1.

## 5. Test refactor and gap-fill

- [x] 5.1 Add `test/_cli-helpers.ts` exporting `spawnCli(args, cwd?, opts?)`, `setupInitialized()`, and `expectCliFailure(args, cwd)`.
- [x] 5.2 Add `test/cli.parity.test.ts` asserting that every `COMMAND_REGISTRY` entry maps to a registered Commander command on `buildProgram()` and that every entry declares both `markdown` and `json` output modes.
- [x] 5.3 Add `test/cli.epics-tasks.test.ts` covering: empty `epics` list (human + JSON), `epics --change <name>` get path, `epics <bad>` rejection (`DELIVERY_READ_ONLY`), `tasks` empty list, `tasks --task <id>` get, `tasks <bad>` rejection, missing `--change` validation error.
- [x] 5.4 Add CLI tests for `read --path <abs>`, `read --revision <n>`, and `read` with no selectors → `VALIDATION_FAILED`.
- [x] 5.5 Add CLI tests for `update --expected-revision` success and conflict (`REVISION_CONFLICT`).
- [x] 5.6 Add CLI tests for `create --body-file <path>` and `update --body-file -` (stdin).
- [x] 5.7 Add CLI tests for `view --id <id> --revision <n>` and `view --include-deleted`.
- [x] 5.8 Add a CLI test asserting `status --json` for an uninitialized workspace returns `{ initialized: false, initCommand: 'spego init' }`.
- [x] 5.9 Add CLI tests asserting validation errors and SpegoErrors in `--json` mode include `error.details` (object, possibly empty).
- [x] 5.10 Replace the literal `expect(result.length).toBe(12)` workflow count with a set-membership assertion against the canonical workflow names.
- [x] 5.11 Remove the duplicated skills dual-mode block from `test/cli.test.ts`. Skills coverage now lives only in `test/cli.skills-command.test.ts`.
- [x] 5.12 Replace fragile table regexes with intent-level assertions checking that the table contains the expected column names.
- [x] 5.13 Add regression coverage for installed package bin symlink execution (`node_modules/.bin/spego --version`).

## 6. Lint config fix

- [x] 6.1 Add `'test/cli-help-exit.test.ts'` to `allowDefaultProject` in `eslint.config.js`.
- [x] 6.2 Add new test files (`_cli-helpers.ts`, `cli.parity.test.ts`, `cli.epics-tasks.test.ts`, `cli.gap-fill.test.ts`) to the same list.

## 7. Validation gates

- [x] 7.1 `openspec validate 2026-05-29-clean-cli-command-surface --strict --no-interactive` passes.
- [x] 7.2 `npm run typecheck` passes.
- [x] 7.3 `npm run lint` passes (zero errors, zero warnings).
- [x] 7.4 `npm test -- --run` passes (238 / 238).
- [x] 7.5 `npm run build` passes.
- [x] 7.6 Smoke test the built CLI: `node dist/cli.js --help`, `--version`, `commands --json`, `workflows --json`, plus a temp-workspace CRUD round-trip in both human and `--json` modes.
