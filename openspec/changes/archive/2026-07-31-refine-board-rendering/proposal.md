## Why

Dogfooding `spego board` on a real workspace surfaced four rendering problems. The warnings
panel is unreadable at scale: a workspace with two fully-archived sprints renders 12
`archived-in-sprint` rows plus 12 `orphan-epic` rows describing the same 12 archived changes,
plus 2 `closable-sprint` rows — 26 rows of standing noise nobody can act on individually. The
panel primitive also renders open on the right, even though `board.ts` has computed and padded
to a shared panel width since `c9e60cb`/`2932373` — the right border was only ever omitted
because callers used to pass untrimmed rows. The panel title is both bolded and underlined,
which is redundant: the top rail already delimits the section. And the `group` column prints
`g001`/`g002` — a parallel-dependency wave index — where a single letter carries the same
information in a quarter of the width.

## What Changes

- The warnings table in `spego board`'s default human output aggregates rows that describe the
  same underlying fact into one row, instead of one row per affected change: `archived-in-sprint`
  groups by sprint, `orphan-epic` groups by reason (`missing` vs `archived` stay separate — they
  need different repairs), `closable-sprint`, `ungroomed-change`, and `dep-cycle` collapse to one
  row each, `dangling-dep`/`out-of-order-dep` group by the depending change. `adapter-warning` and
  `adapter-unavailable` are free-text and are not aggregated. This is purely a human-rendering
  change: `--json`'s `warnings` array and every `MirrorChange.warnings` list are unaffected.
- `renderPanel`'s left-railed panel now closes with a right border, matching the existing left
  rail. `renderTable` gains an opt-in last-column wrap mode so the (now longer) aggregated
  warning messages don't get truncated with `…`; the board's change table keeps its existing
  truncate-and-1:1-row behavior.
- The board's sprint/section panel title is bolded only; the redundant underline is dropped.
- The board's `group` column renders as a letter (`A`, `B`, … `Z`, `AA`, …) in human output.
  `--json` keeps the existing `g001`/`g002` wave-index string — this follows the same
  human-label/JSON-value split already used for `status` → `archived` (`deliveryStatusLabel`).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `delivery-mirror`: the "Render focused views" requirement gains the right-bordered panel, the
  bold-only title, and the human-only group letter label.
- `agent-command-surface`: the "Human output uses pretty rendering primitives" requirement's
  left-railed panel primitive gains a right border; its board-panel scenarios update to match.

## Impact

- Affected source: `src/cli/render.ts` (`renderPanel` right border, `renderTable`
  `wrapLastColumn` option), `src/cli/commands/board.ts` (`PANEL_CHROME_WIDTH`, drop underline,
  warning aggregation, apply the group label), `src/cli/status.ts` (new `deliveryGroupLabel`).
- Behavior change: human-only. `--json` output for `board` (and any command surfacing
  `MirrorChange.group` or `board.warnings`) is byte-for-byte unchanged — no agent-facing contract
  changes in this change.
- Tests: `test/cli.render.test.ts` gains right-border alignment and `wrapLastColumn` cases;
  `test/cli.board.test.ts` gains an aggregation fixture (sprint left `planned`/`active`, not
  `closed` — the companion `add-mirror-sync-command` change stops emitting `archived-in-sprint`
  for closed sprints and would otherwise make that fixture assert nothing), a bold-not-underlined
  title case, and a human-side group-letter case; `test/delivery-mirror.test.ts`'s existing
  `group` JSON assertions (`g001`/`g002`) are unchanged, proving the JSON contract held.
- Docs: `README.md`'s board-rendering paragraphs; `CHANGELOG.md` `[Unreleased]`.
