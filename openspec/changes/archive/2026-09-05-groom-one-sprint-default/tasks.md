## 1. Pin the default in the registry

- [x] 1.1 Extend the `groom has expected shape` case in `test/workflows.registry.test.ts` so the `plan` phase instruction is asserted to state that one sprint is scheduled by default and the remaining changes stay in the backlog — red against the current text
- [x] 1.2 Rewrite the `plan` phase instruction of the `groom` entry in `src/workflows/registry.ts`: schedule one sprint (the first releasable, testable unit), leave every other pending change in the backlog as an epic without a `sprint-plan`, form the next sprint at the groom after that sprint closes, and offer more than one sprint only on the user's explicit request — the test from 1.1 goes green

## 2. Say it in the docs

- [x] 2.1 Update the groom section of `docs/workflows.md` (the `plan` line) to the same default and the explicit-request exception
- [x] 2.2 Add a `### Changed` entry under `[Unreleased]` in `CHANGELOG.md` describing the new plan-phase default
