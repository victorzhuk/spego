## 1. Epic schema (TDD)

- [x] 1.1 Failing table-driven tests: epic meta accepts valid `deps`/`links`/`requires`/`gaps`, rejects wrong shapes (non-array deps, gap without flag, empty requires entry)
- [x] 1.2 Add `epic` to `ARTIFACT_META_SCHEMAS`; tests green
- [x] 1.3 Failing tests: sprint-plan accepts ordered `changes` list, rejects non-string entries and duplicates within one sprint
- [x] 1.4 Extend sprint-plan schema; tests green

## 2. Cross-artifact rules (TDD)

- [x] 2.1 Failing tests: creating/updating a sprint-plan listing a change already owned by another non-closed sprint fails validation; closed sprints don't block
- [x] 2.2 Implement index-backed membership check in the engine; tests green
- [x] 2.3 Failing tests: epic create/update with slug not matching an active change fails when adapter resolves; proceeds with stderr warning when `openspec/` is absent
- [x] 2.4 Implement CLI-layer slug check; tests green

## 3. CLI contract (tests-after)

- [x] 3.1 `spawnCli` e2e: `spego --json create --type epic` happy path, slug mismatch error shape, sprint membership error shape, adapter-absent warning path

## 4. Docs

- [x] 4.1 README artifact types + sprint-plan structure; CHANGELOG `[Unreleased]` Added entries
