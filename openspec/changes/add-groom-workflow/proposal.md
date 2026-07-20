## Why

`spego mirror` derives and reports, but nothing writes Mirror state with judgment: which change depends on which, what a change requires (design for UI work, decision for architectural calls), where the spec is weak. Per the accepted decision artifact, that judgment belongs to a single agent workflow — the sole writer of Mirror state — so drift repairs and analysis persist through spego artifacts instead of chat.

## What Changes

- New `spego-groom` workflow skill in the workflow registry, generated for Claude targets like the existing workflow skills. Phased session:
  1. **Orient** — read `spego mirror --json` and `spego epics --json` for current state and drift warnings.
  2. **Sync** — create epics for ungroomed changes; propose disposition for orphan epics (default keep, archived changes noted); confirm with the user before destructive choices.
  3. **Analyze** — per epic: declare `deps`, judge `requires`, link supporting artifacts, flag gaps (`weak-spec`, `research-thin`, ...) with notes.
  4. **Plan** — propose sprint grouping as releasable, testable units; create/update `sprint-plan` artifacts; surface `closable-sprint` warnings for confirmation.
  5. **Summarize** — report what changed and the resulting next-change suggestion.
- Sole-writer contract: groom persists exclusively via `spego create`/`spego update --expected-revision`; it never writes under `openspec/` and never mutates OpenSpec lifecycle state.
- Re-running grooms incrementally: existing epics are updated, revisions accumulate.

Non-goal: an OpenCode groom command — OpenCode keeps its current apply/verify/explore command set; groom lands there in a later change if dogfooding warrants it.

## Capabilities

### New Capabilities

- `grooming-workflow`: the groom session contract — phases, sole-writer rule, incremental re-groom.

### Modified Capabilities

- `combined-openspec-spego-workflows`: ownership boundary extended — spego owns delivery-mirror state (`epic`, `sprint-plan`) through groom; OpenSpec ownership unchanged.

`agent-skill-generation` needs no delta: workflow skills are generated one per `WORKFLOW_REGISTRY` entry, so registering groom is covered by the existing requirement.

## Impact

- `src/workflows/registry.ts`, Claude generator, README workflow section, `test/workflows.registry.test.ts` / `test/generator.workflows.test.ts` / skills-command e2e.
- Depends on `add-mirror-command` (groom orients from mirror output).
- Changelog: Added entry for the workflow.
