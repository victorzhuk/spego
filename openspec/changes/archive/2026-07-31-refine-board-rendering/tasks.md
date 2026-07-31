## 1. Specification

- [x] 1.1 Run `openspec validate refine-board-rendering --strict` and resolve any structural errors before any code lands.

## 2. Rendering primitives (`src/cli/render.ts`)

- [x] 2.1 `renderPanel` closes on the right. `renderBox`'s corner math is not directly reusable — it derives its own `contentWidth` from `rows` and pads one space each side (`innerWidth = contentWidth + 2`), while `renderPanel` takes `width` as content width and already derives `total = width + 2` for the top rule. Add the right border (` │` suffix on each body line, closing `╮`/`╯` corners) deriving the bottom rule's length from that same `total`, not from `renderBox`'s expression — the two aren't the same quantity. Document that callers passing ANSI-styled `bodyLines` MUST supply `opts.width` explicitly, since `.length` on styled input counts escape bytes.
- [x] 2.2 `renderTable` gains `opts.wrapLastColumn`: when set, a cell in the last column that doesn't fit wraps onto continuation rows with every preceding column blank, instead of truncating with `…`. Default behavior (truncate) is unchanged for existing callers.

## 3. Board renderer (`src/cli/commands/board.ts`)

- [x] 3.1 `PANEL_CHROME_WIDTH`: 2 → 4 (the `│ ` rail plus the new ` │` border), so `totalWidth` still fits the terminal instead of overflowing by the border's width.
- [x] 3.2 Drop `'underline'` from the title styling; keep `'bold'`. The `finished` (closed-sprint) branch stays fully `dim`.
- [x] 3.3 Add a warning-aggregation step before building `warningRows`, keyed per code (not one universal rule):
  - `archived-in-sprint` → group by `details.sprint`, list the affected change slugs in the message.
  - `orphan-epic` → group by `details.reason` (`missing` and `archived` never merge — different repairs).
  - `closable-sprint` → group by code only, list the affected sprint slugs.
  - `dep-cycle` → group by code only (existing per-member warnings share one `details.cycle`).
  - `dangling-dep`, `out-of-order-dep` → group by `(code, details.change)`.
  - `ungroomed-change` → group by code only.
  - `adapter-warning`, `adapter-unavailable` → not aggregated, one row each.
  - Apply `opts.wrapLastColumn` to the warnings table so aggregated messages aren't truncated.
- [x] 3.4 Apply the new `deliveryGroupLabel` to the `group` cell in `changeRow`, mirroring how `deliveryStatusLabel` is applied to `status`.

## 4. Group label (`src/cli/status.ts`)

- [x] 4.1 Add `deliveryGroupLabel(group: string): string`: `g001` → `A` … `g026` → `Z`, `g027` → `AA` (bijective base-26, total for any positive wave). `!` and `—` pass through unchanged; anything unparseable returns its input unchanged.

## 5. Tests

- [x] 5.1 `test/cli.render.test.ts`: right border column-aligned across header, divider, short rows, and blank rows; an explicit `opts.width` wider than content still aligns; `wrapLastColumn` continuation rows blank the leading columns and respect the column width; default (non-wrap) behavior unchanged.
- [x] 5.2 `test/cli.board.test.ts`: extend the existing panel-alignment cases to assert the right edge; a fixture with several archived changes in one `planned` or `active` sprint (never `closed`) asserting one aggregated `archived-in-sprint` row naming all affected changes, instead of one row per change; title bold-not-underlined; `--json` warnings array and `MirrorChange.warnings` unchanged in shape and count; human board prints letters in `group`, `--json` still prints `gNNN`.
- [x] 5.3 Confirm `test/delivery-mirror.test.ts`'s `describe('group (parallel wave)')` assertions pass unmodified — proof the JSON contract held.
- [x] 5.4 Confirm the existing fitting-message-not-truncated case in `test/cli.board.test.ts` still passes with aggregation in place.

## 6. Documentation

- [x] 6.1 README: update the board-rendering paragraph — right-bordered panel, bold-only title, human-only group letter, aggregated warnings table (note `--json` stays per-fact).
- [x] 6.2 CHANGELOG `[Unreleased]` → `Changed`: right-bordered panel, dropped title underline, group letter label, aggregated warnings; `--json` unchanged.
