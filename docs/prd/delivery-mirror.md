# Delivery Mirror — PRD

## Problem statement

OpenSpec owns the change lifecycle — proposals, specs, tasks, archive — and deliberately stops there. A maintainer running several changes at once has no home for cross-change workflow state: which change depends on which, which supporting artifact (design, ADR, research) is still missing, and which group of changes forms the next releasable unit. That state ends up in throwaway notes that go stale immediately, so "what do I pick up next, and what is blocking it" has to be reconstructed by hand every session.

## Solution

spego becomes the workflow layer on top of OpenSpec. An agent grooming session (`spego-groom`) reads the current changes, records per-change delivery state as Epic artifacts — dependencies, links to supporting artifacts, required-artifact lists, gap flags — and groups changes into Sprints. A deterministic `spego mirror` command then derives the full picture on demand: the dependency graph, blockers, gaps, sprint board, and a suggested next change. OpenSpec files are never touched; the Mirror is only ever derived, never stored, so it cannot rot as a document — staleness surfaces as explicit drift warnings that the next groom run repairs.

## User stories

1. As a maintainer, I want each OpenSpec change mirrored by an Epic artifact holding its dependencies and artifact links, so that workflow state survives between sessions instead of living in temp notes.
2. As a maintainer, I want `spego mirror` to render sprints, change statuses, blockers, and gaps in one board, so that I see actual delivery state without reconstructing it.
3. As a maintainer, I want blockers derived from declared dependencies and change status, so that I never hand-maintain a "blocked" flag that can lie.
4. As a maintainer, I want the mirror to suggest the next change (unblocked, in the active sprint), so that "what do I pick up" is answered mechanically.
5. As a maintainer, I want gaps flagged per change — missing design, missing ADR, weak spec, thin research — so that I know which artifact to produce before implementation starts.
6. As a maintainer, I want changes grouped into Sprints as releasable, testable units, so that delivery has milestones instead of a flat change list.
7. As a maintainer, I want drift reported — orphan Epics, ungroomed changes, closable sprints — so that I know when the mirror lags OpenSpec reality.
8. As an agent, I want a `spego-groom` workflow that syncs Epics, analyzes dependencies, flags gaps, and proposes sprint grouping, so that judgment calls are persisted through spego instead of lost in chat.
9. As an agent, I want `spego mirror --json` to return the derived graph deterministically, so that downstream workflows consume delivery state without re-parsing OpenSpec.
10. As a maintainer, I want re-grooming to update existing Epics incrementally, so that history accumulates in revisions instead of being recreated.

## Implementation decisions

- New `epic` artifact type: mirrors exactly one OpenSpec change (slug = change name, 1:1 enforced). Frontmatter meta carries: deps on other changes, links to supporting spego artifacts, `requires:` artifact-type list, gap flags with notes. Recorded in decision artifact `decision/mirror-state-per-epic-markdown-derived-graph-groom-sole-writer`.
- `sprint-plan` meta schema extended with a structured `changes:` list — the single owner of sprint membership; a change belongs to at most one sprint. Existing `status: planned|active|closed` retained.
- The Mirror (graph, blockers, board) is always derived, never stored: composed from Epic + sprint-plan artifacts plus the existing read-only OpenSpec delivery adapter. Blocker = dependency not done and not scheduled in the same or an earlier Sprint. Missing artifact = `requires` − linked.
- One new CLI command, `spego mirror`: default human board (sprints → changes with status, blockers, gaps, suggested next change), focus flags `--graph` and `--gaps`, global `--json` honored. Validation warnings always attached: dangling dep, ungroomed change, orphan Epic, archived change in a sprint, closable sprint.
- The CLI never mutates on render. `spego-groom` — a new generated workflow skill — is the only writer of Mirror state: phased session (sync Epics with changes → analyze deps and flag gaps → propose/update sprint grouping) persisting via `spego create`/`update` with `--expected-revision`.
- Gap judgment lives in the skill, not the CLI: groom decides per change what it requires (design for UI work, decision for architectural calls) and writes `requires:` plus freeform gap flags; the CLI only computes and renders.
- OpenSpec read-only contract holds unchanged: no writes under `openspec/`, adapter remains observe-only.
- Vocabulary per `CONTEXT.md`: Change, Epic, Sprint, Mirror, Groom, Gap, Blocker.

## Testing decisions

- Flow: hybrid — TDD (red-green, table-driven) for the pure derivation module (blocker computation, drift detection, gap math, next-change selection); e2e CLI specs written after render and flags stabilize. Existing-service-strict depth.
- Seams: primary — the e2e CLI spawn seam (`spawnCli`/`setupInitialized` in `test/_cli-helpers.ts`) asserting the `--json` contract of `spego mirror`; secondary — module-level tests for derivation, following `test/delivery.test.ts` prior art.
- Good tests cover: dependency cycles, dangling deps, cross-sprint dependency ordering, archived-change drift, empty workspace (no epics, no sprints), a change in no sprint, and the `--json` shape including warnings.

## Out of scope

- Mutating OpenSpec lifecycle state (create/apply/verify/sync/archive stay OPSX/OpenSpec territory).
- Auto-reconciliation by the CLI (no auto-closing sprints, no `--fix`); groom is the sole writer.
- Embedded LLM calls from the CLI; smartness stays in the agent workflow.
- Delivery adapters other than OpenSpec for the mirror (adapter interface stays, mirror v1 targets OpenSpec).
- Time tracking, velocity, burndown, estimates — sprints are grouping units, not capacity plans.
- A TUI/web board; `spego mirror` renders the existing human/JSON output modes only.

## Further notes

- Epic identity assumed slug = change name; enforce on create in the `epic` schema (validation rule to pin during decomposition).
- Next-change ordering rule beyond "unblocked, in active sprint" (tie-breaking: sprint order, then dep depth, then name) — pin during design of the derivation module.
- Disposition of Epics for archived changes (keep as history vs soft-delete on groom) — groom-time decision; default keep, revisit after first dogfooding.
- Whether `spego epics` output should merge Epic-artifact state into the adapter view immediately or defer to `spego mirror` only — decide during decomposition to avoid breaking the existing `epics --json` contract.
- Grooming cadence is manual by design; if drift warnings prove noisy in practice, a groom-reminder in `spego status` is a cheap follow-up.
