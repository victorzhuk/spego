# Delivery board

`spego board` derives the delivery mirror on demand. It never writes artifacts or OpenSpec state.

The board combines active and archived OpenSpec changes with `epic` and `sprint-plan` artifacts into a sprint board: sprints in date order (undated last), each sprint's changes in dependency order, then per-change status, blockers, gaps, and missing artifacts (`requires` minus resolvable `links`).

A `sprint-plan` carries its own `requires` and `links`, resolved by the same rule: what the sprint as a whole needs — a design, a QA plan, a decision that spans its changes — rather than what any single change needs. The unresolved remainder is the sprint's `missing`.

A change is blocked when a dependency is not `done` or `completed` and is not scheduled in the same or an earlier sprint. Archived changes are discovered from `openspec/changes/archive/<date>-<slug>/`, with the date prefix stripped to derive the slug, and always resolve to `completed` — so a dependency that resolved through the archive no longer trips `dangling-dep`.

## Status

A change's status is one of `backlog`, `in-progress`, `done`, `completed`, `blocked`, `paused`, or `unknown`. The human board prints each status as one portable symbol, so the same row reads on any terminal, in any editor, and in any piped log:

| Status | Symbol |
| --- | --- |
| `backlog` | `○` |
| `in-progress` | `▶` |
| `done` | `✓` |
| `completed` | `🗑` (U+1F5D1 U+FE0E, text style) |
| `blocked` | `×` |
| `paused` | `■` |
| `unknown` | `?` |

Directly under the heading, the board prints a legend naming the status behind every symbol it uses, so the first reader never has to guess.

`--nerd-font` opts in to Nerd Font icons for all seven statuses, keeping the same meaning — the trash icon marks `archived`, the stop square marks `paused`. It is strictly opt-in: nothing detects an installed font, so a terminal without one never receives glyphs it cannot draw. `--plain` takes precedence over `--nerd-font` and restores the text statuses, so a piped or color-disabled run stays legible.

`done` and `completed` both satisfy a dependent's blocker check but mean different things: `done` is all tasks checked and not yet archived; `completed` is archived — a filesystem fact that always wins, even over a manual override. Human output (`board`, `epics`, and `view`'s epic rows) reads `completed` as `archived`, since that is the fact that explains why the change is finished — the board as the trash symbol, the other two as the word. `--json` keeps `completed` unchanged, so agents see no contract change.

`blocked` and `paused` have no signal in OpenSpec's plain-text files, so they are set by hand on the `epic` artifact's `status` meta. That override applies only to a change with a real backing OpenSpec change, never forces `done`/`completed`/`in-progress`/`backlog`, and is dropped once the change is archived. An orphan epic — no backing change at all — has no other source of truth, so its `status` meta accepts any of the seven values.

## Identity and conflict tracks

Every change carries a stable `id`: `c` plus a 4+ hex-char slice of the slug's sha1 hash (`c4f2a`), longer only for the rare slug that collides with another on the same board. The id depends only on the slug, so adding, removing, or archiving other changes never shifts an existing id. Blockers are reported by `id`, not slug.

The conflict track — the epic's `track` meta, set during grooming from file and subsystem overlap — still exists and is still the right way to reason about parallel safety: two changes sharing a track are expected to conflict and must run sequentially, changes in different tracks are parallel-safe. It is not a column on the board. The default tables show progress where that column used to sit, and the track itself stays available to agents in `--json` as `group`, so nothing about the data contract changed.

A pending change whose epic carries no track is grooming debt to clear with `spego groom`; in `group` it reads `?`, and a `done` or `completed` change reads `—`. Unlike `id`, `group` is a live value expected to shift as tracks are assigned and work completes.

## Modes and filters

The default output is the human board.

- `--graph` shows dependency edges.
- `--gaps` focuses on gap flags and missing artifacts.
- `--sync` applies the mechanical reconciliation plan before rendering.
- `--nerd-font` swaps the portable status symbols for Nerd Font icons. Off unless asked for.
- `--plain` wins over `--nerd-font` and prints the text statuses.
- `--archived` restores archived changes to the `Ungrouped` list, which excludes them by default. They still resolve dependencies and blockers either way, and a sprint's own change list is never filtered — an archived change still scheduled in a sprint keeps showing there, struck through as satisfied.
- `--closed` renders a sprint whose changes are all `done`/`completed`, which is otherwise hidden behind a trailing `N closed sprints hidden (--closed to show).` note and rendered muted when shown. This is purely a display filter: `--json` always lists every sprint, and hiding never writes `status: closed` to the sprint-plan artifact — that persistence belongs to the groom workflow, after your confirmation.

`--graph` and `--gaps` also carry the `id` column. The global `--json` flag emits a deterministic `{ sprints, ungrouped, warnings, next }` document in all modes; `next` names the first pending, unblocked change, or is `null` with a hint to groom.

## Rendering

Each sprint — and the `Ungrouped` list and the trailing `Warnings` table — renders as a bordered panel: a left rail closed on the right with `│`, corners `╮`/`╯`, and its title embedded in the top rail as `<title> · <status> · <slug>`, bolded. A sprint whose own `requires` are unresolved adds `· N mis`, the same signal its change rows carry, at sprint scope.

Every panel on a board renders at the same width: whichever is wider between the shared table grid and the longest panel title, capped at the terminal width. A title too long for that width truncates with `…` rather than widening its panel past its siblings.

The board opens with a centered `📋 Delivery board` heading and two blank lines above and below it. Colored output underlines the heading in place; `--plain` has no underline attribute to draw, so it gets a literal rule of `─` characters of the same width, aligned with the heading. The heading is centered over the same width every panel uses, so it stays put across terminal widths.

The default change table carries `id`, `change`, `status`, `tasks`, `plan`, and `signals` — plus `hours` between `plan` and `signals` when the workspace declares a `flows` block — on one shared grid across every panel. The `tasks` column replaces the old `group` column in both the sprint tables and the `Ungrouped` list, and reads `done/total`: `0/5` for a planned change with nothing checked, `5/5` for a fully checked one. A change with a known-empty plan reads `0/0`, which is what separates it from one nobody planned. A change whose plan is missing or unreadable reads `—`, so an unknown count never looks like zero progress.

The `plan` column names the same fact: `planned` when the task plan holds at least one item, `planning` when a `tasks.md` exists but none yet, and `—` when there is no readable task plan. Colored output renders the two named states as portable symbols — `●` planned, `◐` planning, a fill progression from `—` — with `--nerd-font` swapping in Nerd Font glyphs for the same meaning; `--plain` prints the words. A `done` or `completed` row always reads `—` — its plan is moot. `--json` carries the state per change as `planState` (`planned`, `planning`, or `none`) and omits the key when the adapter cannot tell; `--graph` and `--gaps` do not carry the column.

Columns shrink together, widest first, to fit the terminal width, or 120 columns when not a TTY. The `change` column is protected: it never truncates, so every slug shows in full no matter how narrow the terminal gets, and the other columns absorb the deficit.

The `signals` column summarizes drift as nonzero counts joined by `·` — `N blk` (blockers), `N gap` (gap flags), `N mis` (missing artifacts) — or `—` when the change is clean. The full text lives in `spego board --gaps`.

The legend names only the statuses and plan states the board actually shows — statuses first, always in the same order (`backlog`, `in-progress`, `done`, archived, `blocked`, `paused`, `unknown`), then any rendered plan symbols. A change whose status has no symbol counts as `unknown`. The entries share one line when the rendered width allows it and wrap onto more lines when it does not, at the full rendered board width. Under `--nerd-font` the symbols differ but the words behind them do not. Under `--plain` the statuses and plan states are already words, so no legend is printed.

The footer adds a dim `spego board --gaps` hint when any rendered change carries a signal, and a dim `N mechanical fixes — run spego sync` line when the reconciliation plan is non-empty.

## Drift warnings

Every rendering attaches drift warnings: `dangling-dep`, `dep-cycle`, `out-of-order-dep`, `ungroomed-change`, `no-task-plan`, `orphan-epic`, `closable-sprint`, and `stale-profile`. `out-of-order-dep` flags a scheduled change blocked by a dependency scheduled into a later sprint. `no-task-plan` flags an active change with no task items — `reason: missing` for no `tasks.md` at all, `reason: empty` for one that holds none — the two cases that both read as `backlog` on the board.

The mechanical subset is repaired by `spego sync`:

- `ungroomed-change` — create the epic
- `closable-sprint` — close the sprint
- `orphan-epic` whose change is archived — retire the epic

The judgment-only warnings — `orphan-epic` whose change is missing, `dangling-dep`, `dep-cycle`, `out-of-order-dep`, `no-task-plan`, and [`stale-profile`](estimation.md#bias) — belong to the groom workflow. The board only reports; pass `--sync` to apply the mechanical plan and re-render in one step.

## Related

- [Estimation](estimation.md) — the `hours` column and sprint totals
- [OpenSpec adapter](openspec-adapter.md) — where change state comes from
- [Workflows](workflows.md#groom) — the groom workflow that clears judgment debt
