## 1. Workflow content

- [x] 1.1 Registry entry for `spego-groom`: description, personas/phases, persistence checkpoints, sole-writer contract
- [x] 1.2 Skill body: orient → sync → analyze → plan → summarize, with user-confirmation points for orphan disposition and sprint closes, and `--expected-revision` on every update

## 2. Generation

- [x] 2.1 Claude generator emits `.claude/skills/spego-groom/SKILL.md` on `spego init` and `spego skills`
- [x] 2.2 Regeneration idempotent; stale generated files cleaned per marker rules

## 3. Tests (tests-after)

- [x] 3.1 `test/workflows.registry.test.ts`: groom registered with required metadata
- [x] 3.2 `test/generator.workflows.test.ts`: generated SKILL.md content — phases, sole-writer rule, no OpenSpec mutation instructions
- [x] 3.3 `spawnCli` e2e: `spego workflows --json` lists groom; `spego skills` regenerates it

## 4. Docs

- [x] 4.1 README workflow skills section + authoring loop; CHANGELOG `[Unreleased]` Added entry
