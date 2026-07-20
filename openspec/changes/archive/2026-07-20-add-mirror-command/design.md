# Design — mirror derivation

## Derivation rules

- **Sprint order**: ascending `startDate`; sprints without a date sort last; ties by slug. Within a sprint, the `changes` list order is authoritative — it is the human-controlled priority.
- **Blocker** (per CONTEXT.md): change X is blocked by dep D when D is not completed AND D is not scheduled in the same or an earlier sprint than X. An unscheduled, uncompleted dep always blocks.
- **Dep cycle**: cycle members are reported via a `dep-cycle` warning and treated as blocked; derivation must not loop.
- **Missing artifacts**: `requires` minus the types of resolvable `links` on the epic. A link whose artifact id no longer resolves counts as missing and is noted.
- **Next change**: first change in the active sprint's list order that is pending and unblocked. No active sprint → first planned sprint in sprint order. Nothing eligible → no suggestion plus a hint to run groom.

## Drift warnings

| Warning | Condition |
|---------|-----------|
| `dangling-dep` | epic dep names no known change (active or archived) |
| `dep-cycle` | dependency graph contains a cycle |
| `ungroomed-change` | active change has no epic artifact |
| `orphan-epic` | epic's change is not active (archived or deleted; archived noted as such) |
| `archived-in-sprint` | non-closed sprint lists a change that is no longer active |
| `closable-sprint` | non-closed sprint whose changes are all completed or archived |

The CLI only reports; repair belongs to `spego-groom` (sole-writer decision).

## JSON shape

Top level: `sprints` (ordered, each with ordered `changes` entries carrying status/blockers/gaps/missing), `ungrouped` (changes in no sprint), `warnings`, `next`. Exact field naming follows existing `--json` conventions; shape is asserted by e2e tests.

## Testing

Derivation module TDD (table-driven blocker matrix, warning taxonomy, next-change tie-breaks); CLI render and `--json` contract via `spawnCli` after stabilization. Empty workspace (no epics, no sprints) must degrade to adapter-only view plus `ungroomed-change` warnings, not error.
