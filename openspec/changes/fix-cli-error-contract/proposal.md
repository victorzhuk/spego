## Why

`src/cli/errors.ts` documents that validation errors always exit with code 2 and a structured `error.details` object, but three CLI input paths break the contract: malformed `--meta` JSON and an unreadable `--body-file` surface as `{code: 'INTERNAL'}` with exit 1, and a non-integer `--revision` becomes `NaN` → `...rNaN.md` → a misleading `REVISION_NOT_FOUND`. Found in the 0.11.0 code review; agents parsing the JSON envelope get the wrong error class for plain input mistakes.

## What Changes

- `--meta` JSON parse failures and `--body-file` read failures are wrapped as `VALIDATION_FAILED` (exit 2) at the CLI boundary before reaching the engine.
- `--revision` on `read`/`view` is validated as a positive integer before use; bad values fail as `VALIDATION_FAILED` instead of `REVISION_NOT_FOUND`.
- `runEngineCommand` gains a json-resolution override so `view` routes through the shared runtime helper instead of hand-rolling the open/try/catch/finally lifecycle.
- `create` stops importing `renderArtifactFile` from storage internals; the JSON payload is produced via the `ArtifactEngine` facade like every other command.

## Capabilities

### Modified Capabilities

- `agent-command-surface`: CLI input errors (malformed option values, unreadable option-referenced files) are guaranteed to surface as validation errors with exit code 2.

## Impact

- `src/cli/commands/artifact.ts`, `src/cli/commands/view.ts`, `src/cli/body-input.ts`, `src/cli/runtime.ts`, `src/artifacts/engine.ts` (facade accessor only if needed).
- No new dependencies; error envelope shape unchanged, only correct codes/exit statuses for existing failure modes.
- Tests: new cases asserting `VALIDATION_FAILED` + exit 2 for bad `--meta`, missing `--body-file`, non-integer `--revision`.
