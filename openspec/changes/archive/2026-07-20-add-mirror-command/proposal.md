## Why

With epic and sprint-plan state in place (`add-mirror-state-model`), the delivery picture still has to be assembled by hand. The Mirror — dependency graph, blockers, gaps, sprint board, next change — must be derived on demand so it can never rot as a document; staleness has to surface as explicit drift warnings. This is the deterministic half of the delivery-mirror PRD: judgment stays with the groom skill, computation and rendering land here.

## What Changes

- New pure derivation module composing three read-only inputs — OpenSpec adapter state, epic artifacts, sprint-plan artifacts — into the Mirror: per-change status, dependency graph, blockers, missing artifacts (`requires` − `links`), gap flags, drift warnings, and a suggested next change.
- New CLI command `spego mirror`: default human board (sprints → changes with status, blockers, gaps, suggestion), focus flags `--graph` (dependency edges) and `--gaps` (gap and missing-artifact report), global `--json` honored with a deterministic shape. Warnings always attached in both modes.
- Warning taxonomy: `dangling-dep`, `dep-cycle`, `ungroomed-change`, `orphan-epic`, `archived-in-sprint`, `closable-sprint`.
- Command registered in the command metadata registry; human/JSON parity like every other command.
- `spego mirror` never mutates artifacts or OpenSpec state.

Non-goal: `spego epics` output is unchanged — it stays the plain adapter view; merging epic-artifact state into it is deferred until after dogfooding.

## Capabilities

### New Capabilities

- `delivery-mirror`: derive the Mirror, report drift, suggest next change, render board/graph/gaps views.

### Modified Capabilities

- `agent-command-surface`: expose the `mirror` command with human and `--json` output modes.

## Impact

- New derivation module beside `src/delivery/`, new CLI command file, `src/command-meta/registry.ts`, render helpers, tests (`test/delivery.test.ts` prior art for module seam, `spawnCli` for e2e).
- Depends on `add-mirror-state-model`.
- Changelog: Added entry for the command.
