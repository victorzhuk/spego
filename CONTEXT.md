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
A `sprint-plan` artifact owning an ordered list of Changes that together form one releasable, testable unit; the board and `--json` list each sprint's changes in execution (dependency) order.
_Avoid_: milestone, iteration, release train

**Mirror**:
The derived picture — graph of Epics, Sprint grouping, blockers, and gaps — composed by the CLI from Epic and Sprint artifacts plus the read-only OpenSpec adapter.
_Avoid_: board (rendering of the Mirror, not the state itself), dashboard

**Groom**:
The agent workflow (`spego-groom` skill) that owns the judgment layer of the Mirror — orphan-epic disposition, dependency analysis, gap flagging, conflict-track assignment, and sprint grouping. Mechanical reconciliation (an epic for every ungroomed change, a close for every finished sprint) is owned by `spego sync`; both persist through `spego create`/`spego update`, and the CLI never mutates Mirror state while rendering.
_Avoid_: analyze, refine, orchestrate

**Gap**:
A missing or weak supporting artifact for a Change, flagged on its Epic (e.g. no design, no ADR, weak spec, insufficient research).
_Avoid_: finding (reserved for qa artifacts), violation

**Blocker**:
A derived state: a Change whose dependency is not done and not scheduled in the same or an earlier Sprint.
_Avoid_: dependency (the declared edge; a Blocker is its unsatisfied consequence)

**Group**:
A change's conflict track — the epic's `track` meta, set by groom from file/subsystem overlap. Changes sharing a Group are expected to conflict and run sequentially; changes in different Groups are parallel-safe. A pending change with no track shows `?` (run groom); a `done`/`completed` change shows `—`.
_Avoid_: wave, parallel lane (same Group now means conflict, the inverse of the old wave meaning)

**Flow**:
A named end-to-end pipeline that carries one Change from ready-to-apply to merged (e.g. `zapply`, a plain OPSX apply). Two Flows applying the same Change cost different amounts of time — that difference is the reason estimates are Flow-scoped rather than absolute.
_Avoid_: workflow (reserved for spego workflow skills), pipeline, process

**Harness**:
What a Flow executes on — the coding agent, its model, and the settings that govern them. One Flow run on two Harnesses is two different cost profiles.
_Avoid_: agent, tool, environment

**Flow Hours**:
The unit for agent-delivered work: elapsed wall-clock hours a Change takes under a stated Flow and Harness, from ready-to-apply to merged. Recorded twice per Change — once as a Flow Estimate before work starts, once as a Flow Actual after it merges.
_Avoid_: IT-hours, agent time, runtime, duration

**Human Hours**:
The unit for the counterfactual: hand-coding hours the same Change would cost a maintainer working without agents. Recorded once, as a Human Estimate; there is no human actual, because nobody hand-codes a Change that an agent already delivered.
_Avoid_: man-hours, человеко-часы, story points, ideal days, effort

**Flow Estimate**:
Predicted Flow Hours for a Change, recorded before work starts. Priced from the Change's size against the profile of the Flow that will execute it, so the same Change carries different Flow Estimates under `zapply` and under a plain apply.
_Avoid_: forecast, prediction, budget

**Human Estimate**:
Predicted Human Hours for a Change, recorded before work starts. Flow-independent by definition — it describes the work, not the machinery.
_Avoid_: baseline, reference estimate

**Flow Actual**:
Measured Flow Hours a Change really took, reported by the Flow itself when the Change merges. The only observed number of the three; the gap between it and the Flow Estimate is what re-prices every future estimate. A Change delivered across several runs accumulates its Flow Actual rather than overwriting it.
_Avoid_: real time, spent, elapsed, tracked time

**Size Tier**:
The single estimation judgment recorded per Change — how big it is, on one shared scale, independent of who or what will build it. Groom writes it; every hour figure is derived from it.
_Avoid_: story points, complexity, t-shirt size, weight

**Flow Profile**:
The mapping from Size Tier to hours for one Flow. Derived from recorded Flow Actuals in this repo, falling back to the same Flow's cross-project history, then to a declared seed — each price naming the rung it came from.
_Avoid_: velocity, capacity, baseline, calibration table

**Bias**:
How far a Flow Profile's prices sit from observed reality, rolled up per Size Tier per Flow. Bias corrects future Flow Estimates automatically and raises a warning once it grows large enough to mean the profile needs re-grooming.
_Avoid_: overrun, variance, error, drift (reserved for the Mirror lagging OpenSpec)

## Relationships

- An **Epic** mirrors exactly one **Change**; a Change has at most one Epic.
- An **Epic** declares zero or more dependencies on other **Changes**.
- A **Sprint** owns zero or more **Changes**; a Change belongs to at most one Sprint.
- The **Mirror** is derived — never stored as a whole — from Epics, Sprints, and adapter state.
- A **Gap** belongs to one **Epic**; a **Blocker** is computed, never written.
- A **Change** carries one **Size Tier**; both its **Flow Estimate** and its **Human Estimate** are priced from that Tier against a **Flow Profile**, never written by hand.
- A **Flow Estimate** is scoped to one **Flow** — the same Change prices differently under another one. A **Human Estimate** is scoped to none.
- A **Flow Actual** belongs to one Change and names the **Flow** that produced it; Flow Actuals are the only input that moves a **Flow Profile**.
- **Bias** and a **Sprint**'s remaining hours are derived like a **Blocker** — computed on render, never stored.

## Example dialogue

> **Dev:** "Change `add-auth` is blocked — where do I record that?"
> **Domain expert:** "You don't. Declare on its **Epic** that it depends on `add-sessions`; the **Blocker** appears in the **Mirror** because `add-sessions` isn't done and isn't in an earlier **Sprint**."
> **Dev:** "And 'this change has no design handoff'?"
> **Domain expert:** "That's a **Gap** — the analysis skill flags it on the Epic; the CLI just renders it."

## Flagged ambiguities

- "epic" previously meant only the adapter's read-only view of a Change (`spego epics`). Resolved: Epic is now the stored artifact; `spego epics` merges adapter state with Epic artifacts into one view.
- "sprint" as free-form `sprint-plan` prose vs structured grouping. Resolved: sprint-plan meta gains a structured Changes list and is the single owner of grouping.
- "smart command" — smartness lives in an agent workflow skill that persists judgment via spego artifacts; CLI commands stay deterministic (validate, derive, render).
- "estimate" was ruled out of scope by the delivery-mirror PRD, on the grounds that sprints are grouping units rather than capacity plans. Resolved: reversed for hours specifically — see `decision/change-estimation-groom-judged-tier-cli-priced-hours-flow-calibrated`. A Sprint now carries derived remaining hours; velocity, burndown, and time tracking stay out.
- "IT-hours" (человеко-часы) was ambiguous between time an agent flow burns and time a person would burn. Resolved: split into **Flow Hours** and **Human Hours**; the term itself is avoided.
- "harness" and "flow" were used interchangeably for the machinery around a Change. Resolved: **Flow** is the pipeline, **Harness** is the runtime it executes on.
