# spego

Agent-first product orchestration: markdown-first artifact engine with SQLite indexing.

## Quick Start

```sh
npm install --global @zhuk/spego
spego init --agents claude,opencode --demo false
```

## Commands

| Command | Description |
|---------|-------------|
| `spego init` | Initialize `.spego/` workspace |
| `spego status` | Report workspace status |
| `spego create --type prd --title "My PRD"` | Create an artifact |
| `spego read --id <uuid>` | Read by id, type+slug, or path |
| `spego update --id <uuid> --body "new content"` | Update with revision control |
| `spego delete --id <uuid>` | Soft-delete (preserves history) |
| `spego list` | List artifacts |
| `spego view` | Overview of artifacts as a table; `--detail` exports the full markdown bundle, `--json` exports full JSON |
| `spego commands` | List command metadata |
| `spego workflows` | List workflow skills metadata |
| `spego skills` | Regenerate agent skill files |
| `spego epics [name]` | List delivery epics, or get one by change name |
| `spego tasks <change> [task]` | List tasks for a change, or get one task |
| `spego sprints` | List sprint plans in board order |
| `spego board` | Show the delivery board (sprints, change signals, drift); --sync reconciles first |
| `spego sync` | Reconcile the delivery mirror: create missing epics, close finished sprints, retire epics of archived changes |
| `spego record <change>` | Record one measured run (`--flow`, `--hours`) against a change's epic `actuals`; appends, never overwrites |
| `spego index rebuild` | Rebuild SQLite index from files |

All commands accept `--cwd <dir>` to set the project root.

### Output modes

Every spego command speaks two output modes:

- **Human (default)** — pretty, scannable output for terminals. Every command renders a section: a single emoji header (`📦 📄 🛠️ 🧭 📚 ✅ ✨ 🗑 📋 🏃 🕸️ 🧩`), one blank line, then the content. Summaries render as bordered boxes (`╭─ … ─╮`), lists render as aligned tables. `view` defaults to an overview — a totals box plus one table per artifact type, with `epic` rows carrying delivery-derived status; `view --detail` renders the full markdown bundle instead, separating artifacts with `────` dividers. Errors print as `⚠️  [CODE] message` to stderr.
- **JSON (opt-in)** — pass the global `--json` flag to get deterministic, decoration-free JSON on stdout. Errors come back as `{ "error": { "code", "message", "details" } }` on stderr; `details` is always an object.

Agents calling spego MUST pass `--json` so they get parseable output. Humans normally do not.

`spego read --json` and `spego update --json` both return artifact records with `frontmatter`, `body`, and `path`; `update` also keeps the compatibility fields `id` and `revision`.

`spego create` and `spego update` accept body content through `--body`, `--body-file <path>`, or stdin via `--body-file -`.

## Architecture

- Markdown files are the source of truth (`.spego/artifacts/<type>/<slug>.md`)
- SQLite indexes metadata and revisions for fast lookup
- Revisions stored as snapshots (`.spego/revisions/<type>/<slug>.r<n>.md`)
- Per-type metadata schemas validated on create/update
- Index is fully rebuildable from markdown files
- Delivery adapters provide read-only epics/tasks views (default: OpenSpec)

## Artifact Types

Built-in: `prd`, `epic`, `okr`, `retro`, `sprint-plan`, `brainstorm`, `usecases`, `design`, `api`, `architecture`, `decision`, `risk`, `qa`, `ceremony`

- `epic` mirrors an OpenSpec change. Its optional meta supports `deps`, `links`, `requires`, and `gaps`.
- `sprint-plan` may include ordered `changes`; a change can belong to only one non-closed sprint-plan.

Custom types can be registered via workspace config (`extraArtifactTypes`).

## Configuration

Workspace config lives at `.spego/config.yaml`:

```yaml
version: 1
agents:
  - claude
  - opencode
demo: false
extraArtifactTypes: []
deliveryAdapter:
  name: openspec
  options: {}
```

## OpenSpec Delivery View

The default delivery adapter is OpenSpec. `spego epics` exposes active OpenSpec changes as delivery epics, and `spego tasks --change <name>` exposes checklist items from the change's `tasks.md`.

The adapter is read-only. It observes OpenSpec state but does not create, continue, apply, verify, sync, or archive OpenSpec changes.
`spego sync` reconciles the delivery mirror — it creates a missing epic for every ungroomed change, closes every finished sprint, and retires the epic of any archived change — and is unrelated to OpenSpec's own `sync` / `/opsx:sync`, which merges a change's spec deltas into the main specs tree.

| Source | spego view |
|--------|------------|
| `openspec/changes/<name>/proposal.md` | Epic title |
| `openspec/changes/<name>/tasks.md` | Task status and counts |

The `openspec` binary is not required on PATH — board and epics resolve status entirely from `tasks.md` on disk.

Archived changes under `openspec/changes/archive/` are excluded. A change with no `tasks.md`, or an empty one, is reported as `backlog`; a `tasks.md` with unchecked items is `in-progress`; all items checked is `done`.

## Delivery Mirror

`spego board` derives the delivery mirror on demand — it never writes artifacts or OpenSpec state. It combines active and archived OpenSpec changes with `epic` and `sprint-plan` artifacts into a sprint board: sprints in date order (undated last), each sprint's changes in dependency (execution) order, per-change status, blockers, gaps, and missing artifacts (`requires` minus resolvable `links`). A change is blocked when a dependency is not `done` or `completed`, and not scheduled in the same or an earlier sprint. Archived changes are discovered from `openspec/changes/archive/<date>-<slug>/` (the date prefix is stripped to derive the slug) and always resolve to status `completed`, so they no longer trip `dangling-dep` for dependencies that actually resolved via archive.

A change's status is one of `backlog`, `in-progress`, `done`, `completed`, `blocked`, `paused`, or `unknown`. `done` and `completed` both satisfy a dependent's blocker check, but they mean different things: `done` is all tasks checked and not yet archived; `completed` is archived — a hard filesystem fact that always wins, even over a manual override. Human output (`spego board`, `spego epics`, and `spego view`'s epic rows) prints `completed` as `archived`, since that's the fact that actually explains why the change is finished; `--json` output keeps `completed` unchanged, so agents parsing the payload see no contract change. `blocked` and `paused` have no signal in OpenSpec's plain-text files, so they're set by hand on the `epic` artifact's own `status` meta field; that override only applies to a change with a real backing OpenSpec change (a known change), never forces a change to `done`/`completed`/`in-progress`/`backlog`, and is dropped once the change is archived. An orphan epic (no backing OpenSpec change at all) has no other source of truth, so its `status` meta can be set to any of the seven values.

Every change carries a stable `id` (`c` + a 4+ hex-char slice of the slug's sha1 hash, e.g. `c4f2a`; longer only for the rare slug that collides with another on the same board) and a `group` naming its conflict track — the epic's `track` meta, set during grooming from file/subsystem overlap. Two changes sharing a group (track) are expected to conflict and must run sequentially; changes in different groups are parallel-safe (the inverse of the old wave meaning). A pending change whose epic has no track shows `?` — grooming debt to clear with `spego groom`; a `done`/`completed` change shows `—`. The `id` depends only on the slug, so adding, removing, or archiving other changes never changes an existing change's id — unlike `group`, which is a live value expected to shift as tracks are assigned and work completes. Blockers are reported by `id`, not slug.

When the workspace config declares a `flows` block — `default` naming the Flow that prices changes with no per-epic override, per-Flow `profiles` mapping the fixed Size Tier scale (`xs`, `s`, `m`, `l`, `xl`) to Flow Hours, and one `human` table shared across Flows — the board prices every change whose epic carries a `tier`: a Flow Estimate from the epic's `flow` profile (the workspace default when unset) and a Human Estimate from the shared table, each carrying the rung the price came from (`config-seed`). Estimates are derived on render, never stored. A change without a `tier`, or naming a `flow` absent from `flows.profiles`, renders `?` in the `hours` column and does not count toward its sprint's total; a sprint holding such pending changes renders its total with a `+?` suffix. Hours render as decimals with trailing zeros trimmed, and sprint totals sum unrounded values. Each sprint panel's title reports the remaining total Flow Estimate of its pending changes. `--json` carries `flowEstimate`, `humanEstimate`, and `rung` per priced change and `flowTotal` and `unpricedPending` per sprint; a workspace with no `flows` block omits the column, the totals, and every one of those fields. The rung says where the Flow Estimate came from: `config-seed` for the declared table, `observed` once the repo's own history takes over — for a Flow and Size Tier pair with at least three recorded runs (`spego record`), the price is the median of those runs, resolved per pair, so one tier can price from observation while another falls back to the seed on the same board, and runs under one Flow never price another. Observed hours carry a `*` in the `hours` column, with a dim legend line whenever a rendered change is observed. The mirror also derives a bias per Flow and Size Tier pair — the median ratio of recorded runs over the price those runs' changes carried — and corrects seeded prices by it, clamped to a factor of two either way (an observed price is never corrected by its own residual). `--json` carries the unclamped `bias` per priced change. A pair whose bias leaves the band around parity raises `stale-profile`, naming the Flow, the tier, and the direction — the repair is judgment (wrong seed or inconsistent tier calls), so the warning points at re-grooming, not at an automatic fix; several drifted pairs aggregate into one human Warnings row while `--json` keeps one entry per pair. Groom judges each epic's `tier` during analyze, sizing the change itself rather than the machinery that will build it.

A workspace can also price from history it does not have. `spego record` appends every tiered run to a cross-project store — an append-only `runs.jsonl` under the platform configuration directory (`$XDG_CONFIG_HOME/spego` or `~/.config/spego`; `%APPDATA%\spego` on Windows; `~/Library/Application Support/spego` on macOS), one `{flow, tier, hours}` line per run with no repo attribution — and the ladder gains a middle rung between the repo's own observations and the config seed: with `crossProject: true` in the `flows` block, a Flow and Size Tier pair whose local runs are below the sample threshold prices from the store's median once the store holds three or more runs for that pair, reported as rung `cross-project`. The flag defaults to off: a workspace that says nothing prices exactly as before, from repo observations and the seed alone, and its board stays reproducible from the repo — opting in trades that reproducibility away, since the store lives outside the repo and grows with every run recorded anywhere. The store's root resolves from `SPEGO_STORE_ROOT` before the configuration directory, so a test suite or a reproducible run can point it somewhere hermetic; the suite sets it for every spawned CLI run. The store is plain data, not a workspace: losing it costs evidence, not correctness — the ladder simply falls back a rung. Recording writes the epic first and the store second, so a failed store write (reported as `WRITE_FAILED`) never costs the epic entry, and the store is written whether or not the workspace opts in.

The first seed for a `flows` profile does not have to be invented: `node scripts/calibrate-seed.mjs` joins the agent sessions already recorded for this project to archived changes by time window and branch, sums elapsed wall-clock per change, and prints a per-change table for review, then — given a Size Tier per change — a `flows` block holding the median hours per tier, ready to paste into `.spego/config.yaml`. The script is calibration scaffolding, not product code: it reads a vendor-specific session format, its join is a heuristic the maintainer confirms before trusting, and it ships nowhere — it lives under `scripts/`, outside the published package, which is exactly where the CLI's design keeps that format out of the npm artifact.

The default output is the human board. `--graph` shows dependency edges; `--gaps` focuses on gap flags and missing artifacts; both also carry the `id` column. `--sync` applies the mechanical reconciliation plan before rendering. The global `--json` flag emits a deterministic `{ sprints, ungrouped, warnings, next }` document in all modes; `next` names the first pending, unblocked change or is `null` with a hint to groom.

Archived changes are excluded from the `Ungrouped` list by default — they still resolve dependencies and blockers correctly, just aren't shown as loose noise. Pass `--archived` to bring them back. A sprint's own change list is never filtered by this: an archived change still scheduled in a sprint keeps showing there, struck through as satisfied.

Each sprint (and the `Ungrouped` list, and the trailing `Warnings` table) renders as a bordered panel — a left rail closed on the right with `│`, corners `╮`/`╯` — with its title embedded in the top rail as `<title> · <status> · <slug>`, bolded. Every panel on a board renders at the same width: whichever is wider between the shared table grid and the longest panel title, capped at the terminal width; a title too long for that width truncates with `…` rather than widening its panel past its siblings. The default change table carries the columns `id`, `change`, `status`, `group`, and `signals` — plus `hours` between `group` and `signals` when the workspace declares a `flows` block — on one shared grid across every panel; columns shrink together, widest first, to fit the terminal width (or 120 columns when not a TTY). The `change` column is protected: it never truncates, so every slug shows in full no matter how narrow the terminal gets, and the other columns absorb the deficit. The `signals` column summarizes a change's drift as nonzero counts joined by `·` — `N blk` (blockers), `N gap` (gap flags), `N mis` (missing artifacts) — or `—` when the change is clean; the full text lives in `spego board --gaps`. The board footer adds a dim `spego board --gaps` hint when any rendered change carries a signal, and a dim `N mechanical fixes — run spego sync` line when the reconciliation plan is non-empty.

Every rendering attaches drift warnings: `dangling-dep`, `dep-cycle`, `out-of-order-dep`, `ungroomed-change`, `orphan-epic`, and `closable-sprint`. `out-of-order-dep` flags a scheduled change blocked by a dependency scheduled into a later sprint. The mechanical subset — `ungroomed-change` (create an epic), `closable-sprint` (close the sprint), and `orphan-epic` whose change is archived (retire the epic) — is repaired by `spego sync`; the judgment-only warnings (`orphan-epic` whose change is missing, `dangling-dep`, `dep-cycle`, `out-of-order-dep`) belong to the groom workflow. The board only reports — pass `--sync` to apply the mechanical plan and re-render in one step.

A sprint whose changes are all `done`/`completed` — the same condition behind `closable-sprint` — is hidden from the default board and replaced by a trailing `N closed sprints hidden (--closed to show).` note; pass `--closed` to render it anyway, muted (dim panel, unbolded title). This is purely a display filter: `--json` always lists every sprint regardless of `--closed`, and hiding never writes `status: closed` to the sprint-plan artifact — that persistence still belongs to the groom workflow, after your confirmation.

### Authoring a priced change

This project forks OpenSpec's `spec-driven` schema into `openspec/schemas/spec-driven-custom` (selected in `openspec/config.yaml`) and adds an `estimating` artifact between `proposal` and `tasks`: once the proposal settles the scope, the author judges the change's Size Tier (`xs`, `s`, `m`, `l`, `xl`) — sizing the change itself, not the flow machinery that will build it — and persists it through `spego sync` plus `spego update` onto the change's epic. The generated `estimating.md` records the tier and its one-line rationale as the human-readable trace; the epic's `tier` meta is the state the board prices from, so a change arrives priced instead of waiting for the next groom run. OpenSpec owns the ritual, spego owns the state — the step writes nothing under `openspec/` beyond its own artifact file. Changes authored without the fork are unaffected: grooming judges their tier as before. The `openspec schema` surface is experimental; if it changes, the prompt disappears and every recorded tier stays on its epic.

## OpenCode Workflows

When `opencode` is listed in `.spego/config.yaml` agents, `spego init` and `spego skills` generate static OpenCode commands under `.opencode/commands/`:

- `/spego-apply` implements pending tasks from an OpenSpec change in the active OpenCode instance.
- `/spego-verify` checks completeness, correctness, coherence, and tests before archive.
- `/spego-explore` enters a read-only exploration stance for ideas, problems, or OpenSpec changes.

`/spego-apply` runs as a phased current-session workflow: select the change, load context, plan tasks, execute work, verify results, update task checkboxes, and summarize status. It may use OpenCode-native subagents only inside the active OpenCode instance for independent investigation, implementation review, or verification.

Spego does not start or control OpenCode through `opencode serve`, does not call the OpenCode REST API, does not create external OpenCode sessions, and does not own model selection. Configure models, variants, agents, and permissions in OpenCode itself.

There are no `spego apply`, `spego verify`, `spego explore`, or `spego orchestrate` CLI commands. Apply, verify, and explore are generated OpenCode workflows; spego remains the local artifact engine and read-only OpenSpec delivery view.

## Generated Files

For Claude agent targets, `spego init` generates:

- `.claude/skills/spego-<command>/SKILL.md` — skill definitions following Claude Code conventions
- `.claude/commands/spego/` — slash command wrappers

For OpenCode targets, `spego init` generates:

- `.opencode/commands/spego-apply.md`
- `.opencode/commands/spego-verify.md`
- `.opencode/commands/spego-explore.md`

Run `spego skills` to update generated files without reinitializing the workspace.

During regeneration, Spego removes stale generated OpenCode compatibility files such as old `opsx-*` commands, `openspec-*` skills, and retired orchestration assets only when they carry the `spego_generated: true` marker. User-owned OpenCode files without that marker are preserved and reported as skipped.

## Workflow Skills

Workflow skills guide an agent through a multi-persona process inside the chat, persisting results as spego artifacts at well-defined checkpoints.

### brainstorm-party

Multi-persona collaborative brainstorming. Six roles (PM, Architect, UX, Dev, QA, Skeptic) take turns framing, expanding, challenging, and converging on ideas. Outputs a `brainstorm` artifact and optionally drafts a follow-up `prd` or `design`.

Use when exploring a problem space broadly or stress-testing a concept before committing.

### review-adversarial

Adversarial critique of an existing artifact. Five roles (Skeptic, Security, Reliability, UX, Cost) attack from different angles, surface gaps, and prioritize findings. Outputs a `qa` or `risk` artifact and optionally a `decision` or `retro`.

Use when you need rigorous review before approval or implementation.

### review-edge-cases

Method-driven edge-case enumeration. Three roles (Path-tracer, Boundary-checker, Concurrency-skeptic) mechanically trace branching paths, derive edge classes (off-by-one, unguarded inputs, missing else/default, race conditions, timeout gaps), filter already-handled cases, and report only unhandled paths. Outputs a `qa` artifact with a fenced JSON array of findings.

Use when you need to find logic defects that adversarial review may miss.

### editorial-prose

Clinical copy-edit pass. A single Copy-editor persona identifies ambiguous sentences, unnecessary jargon, long sentences, passive voice, and redundancy. Confirmed edits are applied in place via `spego update` with `--expected-revision`; declined edits are recorded as recommendations. Outputs a `qa` artifact summarizing all edits.

Use when the artifact's ideas are sound but the prose needs tightening.

### editorial-structure

Structural review without mutation. A single Structural editor persona outlines the current structure, proposes cuts/merges/reorders/splits, and produces a prioritized recommendation list. Does not modify the source artifact. Outputs a `qa` artifact with restructuring recommendations.

Use when content is correct but organization needs improvement.

### help

Orientation workflow that reads workspace state and recommends next steps. A single Guide persona runs `spego status`, `spego list`, and `spego epics` to inspect the workspace, then applies a recommendation rubric to suggest the most impactful action. Produces no artifact — recommendations are delivered in chat only.

Use when starting a new session, unsure what to do next, or asking "what should I work on?".

### brainstorm-deep

Single-persona, high-volume ideation targeting 50-100 ideas on a focused topic. One Ideator persona generates breadth, then clusters, deduplicates, and ranks the output. Outputs a `brainstorm` artifact.

Use when you have a focused problem and want maximum idea throughput without persona debate.

**When to use brainstorm-deep vs brainstorm-party:**

| Scenario | Use |
|----------|-----|
| Focused problem, need volume | `brainstorm-deep` |
| Broad problem, need diverse perspectives | `brainstorm-party` |
| One voice, fast iteration | `brainstorm-deep` |
| Multiple viewpoints, stress-test ideas | `brainstorm-party` |

### Combined OpenSpec + spego workflows

OpenSpec prompts and spego workflow skills are separate surfaces:

- OPSX/OpenSpec prompts live under `.claude/commands/opsx/` and `.claude/skills/openspec-*/`.
- spego-generated commands and workflow skills live under `.claude/commands/spego/` and `.claude/skills/spego-*/`.

OpenSpec owns change execution and lifecycle state: proposal, design, specs, tasks, apply, verify, sync, and archive. spego owns durable product-thinking artifacts: `brainstorm`, `qa`, `risk`, and `retro`, plus delivery-mirror state: `epic` and `sprint-plan` written only by the groom workflow. The OpenSpec delivery adapter exposed through `spego epics` and `spego tasks` is read-only.

Use combined workflows when an OpenSpec change needs durable thinking around it:

| Lane | OpenSpec action | spego action |
|------|-----------------|--------------|
| Before implementation | Create or continue a change with OPSX/OpenSpec, then read `proposal.md`, `design.md`, specs, and `tasks.md` | `spego-groom` grooms the delivery mirror; `spego-change-brainstorm` creates a `brainstorm` artifact |
| During implementation | Keep task state and artifact mutations in OPSX/OpenSpec | `spego-change-review` creates `qa` or `risk` findings |
| Before archive | Run OPSX/OpenSpec verification | `spego-change-verify-report` creates a `qa` verification report |
| After completion | Archive or complete the OpenSpec change | `spego-change-retro` creates a `retro` artifact |

Example read-only context commands:

```sh
spego epics --json
spego tasks --change <change-name> --json
```

Example spego persistence checkpoints:

```sh
spego --json create --type brainstorm --title "<change-name> brainstorm" --body "<brainstorm output>"
spego --json create --type qa --title "<change-name> review" --body "<quality findings>"
spego --json create --type risk --title "<change-name> risks" --body "<risk findings>"
spego --json create --type retro --title "<change-name> retro" --body "<retrospective>"
```

If a combined workflow discovers that OpenSpec artifacts need to change, use the matching OPSX/OpenSpec command. Do not mutate OpenSpec lifecycle state through spego.

### groom

Delivery-mirror workflow that reconciles active OpenSpec changes with `epic` and `sprint-plan` artifacts. One Groomer persona runs five phases:

1. `orient` — read `spego board --json` and `spego epics --json`, then classify drift warnings.
2. `sync` — run `spego sync` to mechanically create missing epics, close finished sprints, and retire epics of archived changes, then propose disposition for orphans resolving to no OpenSpec change.
3. `analyze` — update deps, requires, supporting links, gap notes, conflict tracks, and Size Tiers on epics.
4. `plan` — propose releasable, testable sprint groupings and create or update `sprint-plan` artifacts after confirmation.
5. `summarize` — report epics, dispositions, sprint plans, and the next-change suggestion.

Sole writers: groom and `spego sync` persist mirror state only through `spego create` / `spego update` with `--expected-revision`; neither writes `openspec/` or mutates OpenSpec lifecycle. Orphan disposition (only for epics resolving to no OpenSpec change) requires explicit confirmation; default is keep. Epics of archived changes are retired, and finished sprints are closed, deterministically by `spego sync` (preview with `--dry-run`), not by hand in groom.

### elicit

Iterative refinement of an existing artifact using named methods (clarify, sharpen, generalize, specialize, stress-test, contextualize, simplify, formalize). A single Refiner persona proposes changes, confirms with the user, and applies via `spego update --expected-revision`. Maximum 5 cycles per session. Outputs a `qa` summary and in-place updates of the source artifact.

Use when you have a draft that needs systematic improvement.

### Authoring loop

The recommended authoring sequence combines all workflow skills:

1. **Orient** — Run `spego-help` to understand workspace state and get recommendations.
2. **Ideate** — Run `spego-brainstorm-party` (multi-perspective breadth) or `spego-brainstorm-deep` (single-voice volume) to explore the problem space.
3. **Capture** — Run `spego create --type prd` (or `architecture`, `design`, etc.) to persist the output.
4. **Refine** — Run `spego-elicit` to iteratively improve the draft with structured methods.
5. **Review** — Run `spego-review-adversarial` and `spego-review-edge-cases` for technical coverage, or `spego-editorial-prose` / `spego-editorial-structure` for communication quality.

### Invocation

All workflow skills are generated at `.claude/skills/spego-<workflow>/SKILL.md` during `spego init`. The agent picks them up automatically based on the skill description.

### Complementary reviews

For thorough artifact review, combine reviewers for orthogonal coverage:

- **Technical defects:** Run `review-adversarial` (attitude-driven: hunts for gaps, weak assumptions) and `review-edge-cases` (method-driven: enumerates unhandled branching paths). Together they catch almost all technical defects.
- **Communication defects:** Run `editorial-prose` (copy-edit) and `editorial-structure` (organizational review). These catch confusion, ambiguity, and poor organization that technical reviewers don't flag.
- **Recommended minimum:** At least one technical reviewer + at least one editorial reviewer before declaring an artifact ready.

## Development

```sh
npm run typecheck   # type checking
npm run lint        # eslint
npm test            # run tests (vitest)
npm run build       # compile to dist/
```

## Requirements

- Node.js >= 22.14.0 (for `node:sqlite`)
