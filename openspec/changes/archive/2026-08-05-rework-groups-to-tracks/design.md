# Design

## Context

See proposal.md — Why. Mechanics that shape the approach:

- `deriveMirror` (src/delivery/mirror.ts) computes `group` via `computeWave` (longest dependency path, memoized) and `renderGroup` (`gNNN`/`!`/`—`); `deliveryGroupLabel` (src/cli/status.ts) maps waves to letters for human output.
- Sprint changes come out in `sprint-plan` stored `meta.changes` order; `chooseNext` scans that order.
- Epic meta schema (src/artifacts/schemas.ts) is zod-validated per type; `META_SHAPES` one-liners feed generated agent skill docs.
- This change lands after `refine-board-signal-density`; spec deltas are written against that change's archived text and the implementation builds on its board layout (`id, change, status, group, signals`).

## Goals / Non-Goals

Goals:
- `group` answers the only scheduling question agents actually ask: "can I run these two changes in parallel worktrees?" — grounded in groom-judged conflicts.
- Board order = execution order, so `next`, human reading order, and agent scheduling agree.

Non-Goals:
- No automatic conflict detection from file footprints — judgment stays in groom; the CLI stays deterministic.
- No cross-sprint reordering (sprint sequence is planning intent); sorting is intra-sprint only.
- No `!` unresolved marker resurrection — dangling deps already surface as blockers and warnings.
- zapply skill changes ship separately (user-global asset, outside this repo).

## Decisions

1. **`track` is free-form epic metadata, not an enum or registry.** Groom invents lane names per project (`api-contract`, `storage`, `tma`). Alternative — a workspace-level track registry artifact — rejected: a second source of truth to drift; the set of tracks is just the set of values in use.

2. **`group` value = track string verbatim; `?` and `—` markers.** Human and JSON render identically — the wave/letter split (`g001` vs `A`) existed only because waves were unreadable; track names are already readable. `deliveryGroupLabel` is deleted, `computeWave`/`renderGroup`/`Wave` go with it. Pending without track → `?` (visible grooming debt without a new warning code — warning noise was just removed by the previous change). Satisfied → `—` as today.

3. **Execution order via Kahn's algorithm restricted to sprint members.** Edges: declared deps where both ends are in the sprint. Ready set ordered by stored list index (stable, deterministic). Cycle members (Kahn leftovers) append in stored order — `dep-cycle` warning already flags them. Cross-sprint deps don't reorder anything (blockers/`out-of-order-dep` already cover those). Applies once in `deriveMirror` so human, `--json`, and `chooseNext` all see one order. Alternative — sorting only at render — rejected: `--json` consumers (zapply) are the ones that need it most.

4. **`chooseNext` untouched in logic.** It already takes the first pending unblocked change in sprint order; feeding it sorted lists fixes the inconsistency by construction.

5. **Epic schema: `track: z.string().min(1).optional()`.** Empty string rejected (same convention as `requires` entries). `META_SHAPES.epic` line gains `track (conflict lane; same track = do not run in parallel)` so regenerated skills teach agents the semantics.

## Risks / Trade-offs

- [JSON `group` consumers parsing `gNNN`] → BREAKING note in CHANGELOG; the field keeps its name and stays a string, so shape-level parsers survive.
- [Ungroomed boards show `?` everywhere] → accurate: parallel-safety is unknown until groomed; README states `?` means "run groom".
- [Stored-order ties may hide a better parallel schedule] → out of scope; deps and tracks carry the real constraints, ties are aesthetic.
- [Existing epics have no `track`] → optional field, no migration; next groom pass fills them.

## Migration Plan

Apply after `refine-board-signal-density` is archived (same rendering surface; deltas assume its text). Single release: implementation, schema addition, README + CONTEXT.md glossary update (Group → conflict track), CHANGELOG BREAKING notes (group value semantics, sprint execution order in JSON), `spego skills` regeneration. Existing workspaces need one groom pass to assign tracks; until then `?` renders.
