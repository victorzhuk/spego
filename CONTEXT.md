# Spego Delivery Mirror

Glossary for spego's workflow layer on top of OpenSpec: spego observes OpenSpec changes and enriches them with dependency, planning, and gap state that OpenSpec deliberately does not manage.

## Language

**Change**:
An OpenSpec unit of work under `openspec/changes/<name>/`, owned entirely by OpenSpec.
_Avoid_: ticket, issue, task (a task is a checklist item inside a change)

**Epic**:
A spego artifact mirroring exactly one Change, carrying deps on other Changes, links to supporting artifacts, and gap flags.
_Avoid_: change-map, card, mirror entry

**Sprint**:
A `sprint-plan` artifact owning an ordered list of Changes that together form one releasable, testable unit.
_Avoid_: milestone, iteration, release train

**Mirror**:
The derived picture — graph of Epics, Sprint grouping, blockers, and gaps — composed by the CLI from Epic and Sprint artifacts plus the read-only OpenSpec adapter.
_Avoid_: board (rendering of the Mirror, not the state itself), dashboard

**Groom**:
The agent workflow (`spego-groom` skill) that syncs Epics with Changes, analyzes deps, flags Gaps, and proposes Sprint grouping — the only writer of Mirror state.
_Avoid_: analyze, refine, orchestrate

**Gap**:
A missing or weak supporting artifact for a Change, flagged on its Epic (e.g. no design, no ADR, weak spec, insufficient research).
_Avoid_: finding (reserved for qa artifacts), violation

**Blocker**:
A derived state: a Change whose dependency is not done and not scheduled in the same or an earlier Sprint.
_Avoid_: dependency (the declared edge; a Blocker is its unsatisfied consequence)

## Relationships

- An **Epic** mirrors exactly one **Change**; a Change has at most one Epic.
- An **Epic** declares zero or more dependencies on other **Changes**.
- A **Sprint** owns zero or more **Changes**; a Change belongs to at most one Sprint.
- The **Mirror** is derived — never stored as a whole — from Epics, Sprints, and adapter state.
- A **Gap** belongs to one **Epic**; a **Blocker** is computed, never written.

## Example dialogue

> **Dev:** "Change `add-auth` is blocked — where do I record that?"
> **Domain expert:** "You don't. Declare on its **Epic** that it depends on `add-sessions`; the **Blocker** appears in the **Mirror** because `add-sessions` isn't done and isn't in an earlier **Sprint**."
> **Dev:** "And 'this change has no design handoff'?"
> **Domain expert:** "That's a **Gap** — the analysis skill flags it on the Epic; the CLI just renders it."

## Flagged ambiguities

- "epic" previously meant only the adapter's read-only view of a Change (`spego epics`). Resolved: Epic is now the stored artifact; `spego epics` merges adapter state with Epic artifacts into one view.
- "sprint" as free-form `sprint-plan` prose vs structured grouping. Resolved: sprint-plan meta gains a structured Changes list and is the single owner of grouping.
- "smart command" — smartness lives in an agent workflow skill that persists judgment via spego artifacts; CLI commands stay deterministic (validate, derive, render).
