# Workflow skills

Workflow skills guide an agent through a multi-persona process inside the chat, persisting results as spego artifacts at well-defined checkpoints. They are generated per agent target — see [Agent targets](agent-targets.md).

`spego workflows` lists them with their metadata.

| Skill | Personas | Output |
|-------|----------|--------|
| [`brainstorm-party`](#brainstorm-party) | PM, Architect, UX, Dev, QA, Skeptic | `brainstorm`, optionally `prd` or `design` |
| [`brainstorm-deep`](#brainstorm-deep) | Ideator | `brainstorm` |
| [`review-adversarial`](#review-adversarial) | Skeptic, Security, Reliability, UX, Cost | `qa` or `risk`, optionally `decision` or `retro` |
| [`review-edge-cases`](#review-edge-cases) | Path-tracer, Boundary-checker, Concurrency-skeptic | `qa` |
| [`editorial-prose`](#editorial-prose) | Copy-editor | `qa` plus in-place edits |
| [`editorial-structure`](#editorial-structure) | Structural editor | `qa` |
| [`elicit`](#elicit) | Refiner | `qa` plus in-place edits |
| [`groom`](#groom) | Groomer | `epic`, `sprint-plan` |
| [`help`](#help) | Guide | none — chat only |

## brainstorm-party

Multi-persona collaborative brainstorming. Six roles take turns framing, expanding, challenging, and converging on ideas.

Use when exploring a problem space broadly or stress-testing a concept before committing.

## brainstorm-deep

Single-persona, high-volume ideation targeting 50-100 ideas on a focused topic. One Ideator generates breadth, then clusters, deduplicates, and ranks the output.

Use when you have a focused problem and want maximum idea throughput without persona debate.

| Scenario | Use |
|----------|-----|
| Focused problem, need volume | `brainstorm-deep` |
| Broad problem, need diverse perspectives | `brainstorm-party` |
| One voice, fast iteration | `brainstorm-deep` |
| Multiple viewpoints, stress-test ideas | `brainstorm-party` |

## review-adversarial

Adversarial critique of an existing artifact. Five roles attack from different angles, surface gaps, and prioritize findings.

Use when you need rigorous review before approval or implementation.

## review-edge-cases

Method-driven edge-case enumeration. Three roles mechanically trace branching paths, derive edge classes (off-by-one, unguarded inputs, missing else/default, race conditions, timeout gaps), filter already-handled cases, and report only unhandled paths. The `qa` artifact carries a fenced JSON array of findings.

Use when you need to find logic defects that adversarial review may miss.

## editorial-prose

Clinical copy-edit pass. The Copy-editor identifies ambiguous sentences, unnecessary jargon, long sentences, passive voice, and redundancy. Confirmed edits are applied in place via `spego update --expected-revision`; declined edits are recorded as recommendations.

Use when the ideas are sound but the prose needs tightening.

## editorial-structure

Structural review without mutation. The Structural editor outlines the current structure, proposes cuts, merges, reorders, and splits, and produces a prioritized recommendation list. The source artifact is not modified.

Use when content is correct but organization needs improvement.

## elicit

Iterative refinement of an existing artifact using named methods: clarify, sharpen, generalize, specialize, stress-test, contextualize, simplify, formalize. The Refiner proposes changes, confirms with the user, and applies via `spego update --expected-revision`. Maximum 5 cycles per session.

Use when you have a draft that needs systematic improvement.

## groom

Delivery-mirror workflow reconciling active OpenSpec changes with `epic` and `sprint-plan` artifacts. Five phases:

1. `orient` — read `spego board --json` and `spego epics --json`, then classify drift warnings.
2. `sync` — run `spego sync` to mechanically create missing epics, close finished sprints, and retire epics of archived changes, then propose disposition for orphans resolving to no OpenSpec change.
3. `analyze` — update deps, requires, supporting links, gap notes, conflict tracks, and Size Tiers on epics.
4. `plan` — schedule one sprint by default, the first releasable, testable unit, and create or update its `sprint-plan` after confirmation; every other pending change stays in the backlog as an epic without a `sprint-plan`. The next sprint is formed at the groom after that sprint closes; more than one sprint in the same session only on the user's explicit request.
5. `summarize` — report epics, dispositions, sprint plans, and the next-change suggestion.

Sole writers: groom and `spego sync` persist mirror state only through `spego create` / `spego update` with `--expected-revision`. Neither writes `openspec/` or mutates OpenSpec lifecycle state. Orphan disposition — only for epics resolving to no OpenSpec change — requires explicit confirmation; the default is keep. Epics of archived changes are retired, and finished sprints closed, deterministically by `spego sync` (preview with `--dry-run`), not by hand in groom.

## help

Orientation workflow that reads workspace state and recommends next steps. The Guide runs `spego status`, `spego list`, and `spego epics`, then applies a recommendation rubric to suggest the most impactful action. Produces no artifact.

Use when starting a session, unsure what to do next, or asking "what should I work on?".

## Authoring loop

1. **Orient** — `spego-help` for workspace state and recommendations.
2. **Ideate** — `spego-brainstorm-party` (multi-perspective breadth) or `spego-brainstorm-deep` (single-voice volume).
3. **Capture** — `spego create --type prd` (or `architecture`, `design`, …) to persist the output.
4. **Refine** — `spego-elicit` to iteratively improve the draft with structured methods.
5. **Review** — `spego-review-adversarial` and `spego-review-edge-cases` for technical coverage, `spego-editorial-prose` / `spego-editorial-structure` for communication quality.

## Complementary reviews

Combine reviewers for orthogonal coverage:

- **Technical defects** — `review-adversarial` is attitude-driven, hunting gaps and weak assumptions; `review-edge-cases` is method-driven, enumerating unhandled branching paths. Together they catch almost all technical defects.
- **Communication defects** — `editorial-prose` (copy-edit) and `editorial-structure` (organizational review) catch confusion, ambiguity, and poor organization that technical reviewers do not flag.
- **Recommended minimum** — at least one technical reviewer and at least one editorial reviewer before declaring an artifact ready.

## Combined OpenSpec + spego workflows

OpenSpec prompts and spego workflow skills are separate surfaces:

- OPSX/OpenSpec prompts live under `.claude/commands/opsx/` and `.claude/skills/openspec-*/`.
- spego-generated commands and workflow skills live under `.claude/commands/spego/` and `.claude/skills/spego-*/`.

OpenSpec owns change execution and lifecycle state: proposal, design, specs, tasks, apply, verify, sync, archive. spego owns durable product-thinking artifacts — `brainstorm`, `qa`, `risk`, `retro` — plus delivery-mirror state, `epic` and `sprint-plan`, written only by the groom workflow. The [OpenSpec delivery adapter](openspec-adapter.md) is read-only.

Use combined workflows when an OpenSpec change needs durable thinking around it:

| Lane | OpenSpec action | spego action |
|------|-----------------|--------------|
| Before implementation | Create or continue a change with OPSX/OpenSpec, then read `proposal.md`, `design.md`, specs, and `tasks.md` | `spego-groom` grooms the delivery mirror; `spego-change-brainstorm` creates a `brainstorm` artifact |
| During implementation | Keep task state and artifact mutations in OPSX/OpenSpec | `spego-change-review` creates `qa` or `risk` findings |
| Before archive | Run OPSX/OpenSpec verification | `spego-change-verify-report` creates a `qa` verification report |
| After completion | Archive or complete the OpenSpec change | `spego-change-retro` creates a `retro` artifact |

Persistence checkpoints:

```sh
spego --json create --type brainstorm --title "<change-name> brainstorm" --body "<brainstorm output>"
spego --json create --type qa --title "<change-name> review" --body "<quality findings>"
spego --json create --type risk --title "<change-name> risks" --body "<risk findings>"
spego --json create --type retro --title "<change-name> retro" --body "<retrospective>"
```

If a combined workflow discovers that OpenSpec artifacts need to change, use the matching OPSX/OpenSpec command. Do not mutate OpenSpec lifecycle state through spego.
