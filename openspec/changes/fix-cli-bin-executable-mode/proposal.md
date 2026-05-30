## Why

CI fails on clean Ubuntu runners because `npm test` executes a symlink to `dist/cli.js`, but `tsc` emits `dist/cli.js` without executable mode. Local runs can pass when an older executable `dist/cli.js` remains in place, hiding the clean-build failure.

## What Changes

- Make the build step set executable mode on `dist/cli.js` after TypeScript compilation.
- Keep package metadata unchanged: `bin.spego` still points to `dist/cli.js`.
- Keep the installed-bin smoke test meaningful by executing the symlink directly.
- Add no runtime dependencies.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `agent-command-surface`: require clean builds to emit an executable CLI entrypoint so installed bin symlinks run on CI and in packed installs.

## Impact

- Affected files: `package.json`, package lockfile if script metadata changes, and a small build helper under `scripts/` if needed.
- CI and publish workflows continue to run `npm test`; the package smoke test should pass on clean runners.
- No CLI flags or public API change.
