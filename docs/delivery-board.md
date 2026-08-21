# Delivery board

`spego board` derives the delivery mirror on demand. It never writes artifacts or OpenSpec state.

The board combines active and archived OpenSpec changes with `epic` and `sprint-plan` artifacts into a sprint board: sprints in date order (undated last), each sprint's changes in dependency order, then per-change status, blockers, gaps, and missing artifacts (`requires` minus resolvable `links`).

A change is blocked when a dependency is not `done` or `completed` and is not scheduled in the same or an earlier sprint. Archived changes are discovered from `openspec/changes/archive/<date>-<slug>/`, with the date prefix stripped to derive the slug, and always resolve to `completed` — so a dependency that resolved through the archive no longer trips `dangling-dep`.

## Status

A change's status is one of `backlog`, `in-progress`, `done`, `completed`, `blocked`, `paused`, or `unknown`.

`done` and `completed` both satisfy a dependent's blocker check but mean different things: `done` is all tasks checked and not yet archived; `completed` is archived — a filesystem fact that always wins, even over a manual override. Human output (`board`, `epics`, and `view`'s epic rows) prints `completed` as `archived`, since that is the fact that explains why the change is finished. `--json` keeps `completed` unchanged, so agents see no contract change.

`blocked` and `paused` have no signal in OpenSpec's plain-text files, so they are set by hand on the `epic` artifact's `status` meta. That override applies only to a change with a real backing OpenSpec change, never forces `done`/`completed`/`in-progress`/`backlog`, and is dropped once the change is archived. An orphan epic — no backing change at all — has no other source of truth, so its `status` meta accepts any of the seven values.

## Identity and conflict tracks

Every change carries a stable `id`: `c` plus a 4+ hex-char slice of the slug's sha1 hash (`c4f2a`), longer only for the rare slug that collides with another on the same board. The id depends only on the slug, so adding, removing, or archiving other changes never shifts an existing id. Blockers are reported by `id`, not slug.

`group` names the change's conflict track — the epic's `track` meta, set during grooming from file and subsystem overlap. Two changes sharing a track are expected to conflict and must run sequentially; changes in different tracks are parallel-safe. A pending change whose epic has no track shows `?` — grooming debt to clear with `spego groom`. A `done` or `completed` change shows `—`. Unlike `id`, `group` is a live value expected to shift as tracks are assigned and work completes.

## Modes and filters

The default output is the human board.

- `--graph` shows dependency edges.
- `--gaps` focuses on gap flags and missing artifacts.
- `--sync` applies the mechanical reconciliation plan before rendering.
- `--archived` restores archived changes to the `Ungrouped` list, which excludes them by default. They still resolve dependencies and blockers either way, and a sprint's own change list is never filtered — an archived change still scheduled in a sprint keeps showing there, struck through as satisfied.
- `--closed` renders a sprint whose changes are all `done`/`completed`, which is otherwise hidden behind a trailing `N closed sprints hidden (--closed to show).` note and rendered muted when shown. This is purely a display filter: `--json` always lists every sprint, and hiding never writes `status: closed` to the sprint-plan artifact — that persistence belongs to the groom workflow, after your confirmation.

`--graph` and `--gaps` also carry the `id` column. The global `--json` flag emits a deterministic `{ sprints, ungrouped, warnings, next }` document in all modes; `next` names the first pending, unblocked change, or is `null` with a hint to groom.

## Rendering

Each sprint — and the `Ungrouped` list and the trailing `Warnings` table — renders as a bordered panel: a left rail closed on the right with `│`, corners `╮`/`╯`, and its title embedded in the top rail as `<title> · <status> · <slug>`, bolded.

Every panel on a board renders at the same width: whichever is wider between the shared table grid and the longest panel title, capped at the terminal width. A title too long for that width truncates with `…` rather than widening its panel past its siblings.

The default change table carries `id`, `change`, `status`, `group`, and `signals` — plus `hours` between `group` and `signals` when the workspace declares a `flows` block — on one shared grid across every panel. Columns shrink together, widest first, to fit the terminal width, or 120 columns when not a TTY. The `change` column is protected: it never truncates, so every slug shows in full no matter how narrow the terminal gets, and the other columns absorb the deficit.

The `signals` column summarizes drift as nonzero counts joined by `·` — `N blk` (blockers), `N gap` (gap flags), `N mis` (missing artifacts) — or `—` when the change is clean. The full text lives in `spego board --gaps`.

The footer adds a dim `spego board --gaps` hint when any rendered change carries a signal, and a dim `N mechanical fixes — run spego sync` line when the reconciliation plan is non-empty.

## Drift warnings

Every rendering attaches drift warnings: `dangling-dep`, `dep-cycle`, `out-of-order-dep`, `ungroomed-change`, `orphan-epic`, `closable-sprint`, and `stale-profile`. `out-of-order-dep` flags a scheduled change blocked by a dependency scheduled into a later sprint.

The mechanical subset is repaired by `spego sync`:

- `ungroomed-change` — create the epic
- `closable-sprint` — close the sprint
- `orphan-epic` whose change is archived — retire the epic

The judgment-only warnings — `orphan-epic` whose change is missing, `dangling-dep`, `dep-cycle`, `out-of-order-dep`, and [`stale-profile`](estimation.md#bias) — belong to the groom workflow. The board only reports; pass `--sync` to apply the mechanical plan and re-render in one step.

## Related

- [Estimation](estimation.md) — the `hours` column and sprint totals
- [OpenSpec adapter](openspec-adapter.md) — where change state comes from
- [Workflows](workflows.md#groom) — the groom workflow that clears judgment debt
