## 1. Workflow content

- [ ] 1.1 Registry entry for `spego-groom`: description, personas/phases, persistence checkpoints, sole-writer contract
- [ ] 1.2 Skill body: orient → sync → analyze → plan → summarize, with user-confirmation points for orphan disposition and sprint closes, and `--expected-revision` on every update

## 2. Generation

- [ ] 2.1 Claude generator emits `.claude/skills/spego-groom/SKILL.md` on `spego init` and `spego skills`
- [ ] 2.2 Regeneration idempotent; stale generated files cleaned per marker rules

## 3. Tests (tests-after)

- [ ] 3.1 `test/workflows.registry.test.ts`: groom registered with required metadata
- [ ] 3.2 `test/generator.workflows.test.ts`: generated SKILL.md content — phases, sole-writer rule, no OpenSpec mutation instructions
- [ ] 3.3 `spawnCli` e2e: `spego workflows --json` lists groom; `spego skills` regenerates it

## 4. Docs

- [ ] 4.1 README workflow skills section + authoring loop; CHANGELOG `[Unreleased]` Added entry
