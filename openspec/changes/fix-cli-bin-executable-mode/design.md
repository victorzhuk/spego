## Context

`package.json` exposes the CLI as `dist/cli.js`. The source file has a shebang, but TypeScript does not preserve executable file mode when writing `dist/cli.js` on a clean checkout. GitHub Actions builds from scratch, so `test/package.test.ts` fails with `EACCES` when it executes a symlink to `dist/cli.js`.

## Goals / Non-Goals

**Goals:**
- Make `npm run build` produce an executable `dist/cli.js` on POSIX systems.
- Keep the direct symlink execution test unchanged.
- Keep the build portable enough for local development.

**Non-Goals:**
- Changing `bin.spego` away from `dist/cli.js`.
- Replacing the package smoke test with a weaker `node dist/cli.js` check.
- Adding a build tool dependency.

## Decisions

1. **Add a post-build chmod helper.** A small Node script runs after `tsc` and calls `chmod(0o755)` on `dist/cli.js`. This makes the artifact executable without changing TypeScript output behavior.
2. **Keep the helper tolerant of missing output.** If `dist/cli.js` is missing, the helper fails clearly so build failures surface before tests or publish.
3. **Do not rely on git file mode.** `dist/` is ignored and generated in CI, so committed file mode cannot fix the clean-build artifact.

## Risks / Trade-offs

- Windows does not use POSIX executable bits. The helper can no-op or tolerate unsupported chmod behavior if needed, but CI runs on Ubuntu.
- The build script gains one extra command. This is preferable to weakening the package test.

## Migration Plan

Additive build-script change only. No data migration or user-facing behavior change.

## Open Questions

None.
