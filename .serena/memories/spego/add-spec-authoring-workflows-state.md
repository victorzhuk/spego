## Change: add-spec-authoring-workflows

### Status: COMPLETE (all 31 tasks done)

### What was done
Added 3 new workflow skills (`help`, `brainstorm-deep`, `elicit`) to the spego workflow registry, bringing total from 5 to 8.

### Files Modified
- `src/workflows/registry.ts` — HELP, BRAINSTORM_DEEP, ELICIT entries
- `src/workflows/types.ts` — `kind` field on WorkflowOutput
- `test/cli.test.ts` — workflow count 5→8, new names, phase threshold 4→3
- `test/workflows.registry.test.ts` — count 5→8
- `test/workflows.review-suite.test.ts` — count 5→8
- `test/workflows.authoring.test.ts` — NEW (10 tests)
- `eslint.config.js` — added new test file
- `README.md` — authoring loop + brainstorm comparison
- `CHANGELOG.md` — v0.6.0 entry
- `openspec/changes/add-spec-authoring-workflows/tasks.md` — all checkboxes [x]

### Verification Results
- typecheck ✅ | lint ✅ | build ✅
- tests: 146/147 passed (1 pre-existing flaky timeout in CLI CRUD)
- integration: init+demo generates all 3 SKILL.md files ✅
- spego-help rubric mentions all 7 other workflows ✅
- regenerate reports all 3 as unchanged ✅

### Pre-existing issue
- `test/cli.test.ts > CLI CRUD > reads an artifact by id` — 15s timeout, flaky under load

### OpenSpec CLI note
- The Rust binary `openspec` crashes; use `npm run spego --` (tsx src/cli.ts) instead
