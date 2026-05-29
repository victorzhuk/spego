## Why

Running `spego`, `spego --help`, `spego <subcommand> --help`, or `spego --version` always prints a spurious diagnostic line to stderr and exits with code `2`:

```
⚠️  [VALIDATION_FAILED] (outputHelp)
```

The CLI uses Commander's [`exitOverride`](file:///home/zhuk/Projects/own/spego/src/cli.ts#L154-L164) hook so it can format validation errors itself instead of letting Commander call `process.exit`. The current implementation treats *every* override invocation as a `VALIDATION_FAILED` error — but Commander also invokes `exitOverride` for normal help/version display, with codes `commander.helpDisplayed`, `commander.help`, and `commander.version` and exit code `0`. The result is misleading noise (success looks like a failure), a wrong exit code (`2` instead of `0`), and broken expectations for any script or CI step that pipes `spego --help` or `spego --version`.

The agent-command-surface spec is silent on how help and version output should behave, so this change both fixes the bug and codifies the contract.

## What Changes

- Update `buildProgram()` in `src/cli.ts` so `exitOverride` distinguishes Commander's help/version codes (`commander.help`, `commander.helpDisplayed`, `commander.version`) from real CLI argument errors:
  - For help/version: do nothing extra — let the help/version text already written to stdout stand, and exit with code `0` (or the code Commander supplies, which is `0` for these cases).
  - For genuine Commander errors (unknown option, missing argument, etc.): keep the current `[VALIDATION_FAILED]` (human) / structured-JSON (machine) emission, but use a real exit code (`err.exitCode ?? 2`).
- Keep the existing `configureOutput` behavior that suppresses non-JSON stderr noise when `--json` is active. In JSON mode, help and version invocations SHALL NOT emit a stderr error envelope.
- Add a requirement to the `agent-command-surface` capability that pins this behavior so it cannot regress.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agent-command-surface`: Add a requirement that help and version output are non-error exits and do not emit error envelopes in either human or JSON mode.

## Impact

- Affected code: [src/cli.ts](file:///home/zhuk/Projects/own/spego/src/cli.ts) (the `exitOverride` callback inside `buildProgram`).
- Affected tests: a new test in `test/` that runs the built CLI (or invokes `buildProgram().exitOverride` behavior) and asserts that `--help` and `--version` exit `0` with empty stderr in both human and JSON modes.
- Affected specs: `openspec/specs/agent-command-surface/spec.md` gains one requirement.
- No artifact schema changes. No generated-skill changes. No public CLI surface changes beyond the bug fix.
- Backward compatible — only removes noise and corrects the exit code on success paths.
