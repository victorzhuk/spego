## 1. Specification

- [x] 1.1 Create the proposal, design, delta spec, and task list for the executable-mode fix.
- [x] 1.2 Run `openspec validate fix-cli-bin-executable-mode --strict --no-interactive` and resolve structural errors.

## 2. Build Fix

- [x] 2.1 Add a build helper that sets executable mode on `dist/cli.js` after `tsc`.
- [x] 2.2 Update `package.json` build script to run the helper after TypeScript compilation.

## 3. Verification

- [x] 3.1 Verify `npm run build` produces an executable `dist/cli.js` on this workspace.
- [x] 3.2 Run the focused package test for the installed-bin symlink path.
- [x] 3.3 Run `npm run typecheck`.
- [x] 3.4 Run `npm run lint`.
- [x] 3.5 Run `npm test`.

## 4. Follow-up

- [x] 4.1 Commit and push the fix, then rerun failed GitHub Actions workflows or push corrected release tags as needed.
