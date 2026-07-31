## 1. Specification

- [x] 1.1 Update the `delivery-mirror` capability: panel/rail structure for the default board, strikethrough-for-satisfied, its precedence over dim-for-blocked, and the human-only `archived` display label.
- [x] 1.2 Update the `agent-command-surface` capability: add the left-rail panel to the blessed primitive set; pin that it survives `--plain` and non-TTY output.
- [x] 1.3 Run `openspec validate restyle-board-panels --strict` and resolve any structural errors before any code lands.

## 2. Rendering primitive (`src/cli/render.ts`)

- [x] 2.1 Add `renderPanel(title, bodyLines, opts?: { width?: number })`: top rule embeds `title`, left rail (`│ `) prefixes each body line, bottom rule, no right border. Content width defaults to the longest body line, widened to fit `title` when narrower. Blank body lines render as a bare `│`.

## 3. Board renderer (`src/cli/commands/board.ts`)

- [x] 3.1 Replace `muteBlockedRows` with `styleChangeRows`: per row, satisfied (`done`/`completed`) → strikethrough + dim; blocked only → dim; else unstyled. Body line `i` stays aligned to `changes[i]`.
- [x] 3.2 Wrap each sprint, `Ungrouped`, and `Warnings` in a panel via `renderPanelSection`, sharing one width computed across all three so panels line up. Panel titles are bolded/underlined by styling only the title substring of the panel's top line, after the plain layout math runs.
- [x] 3.3 `--graph` and `--gaps` keep their flat single-table rendering — no panel, since rows aren't grouped by section there.
- [x] 3.4 Apply `deliveryStatusLabel` to the status column in the default board's change rows and `--graph`'s rows.

## 4. Status vocabulary and label

- [x] 4.1 `src/delivery/mirror.ts`: add and export `isSatisfied(status)`; replace the four internal `=== 'completed' || === 'done'` disjunctions with it.
- [x] 4.2 `src/cli/status.ts`: add `deliveryStatusLabel(status)` mapping `completed` → `archived`, identity otherwise.
- [x] 4.3 Apply the label in `src/cli/commands/delivery.ts` (`spego epics`) and `src/cli/commands/view.ts` (only for `epic` rows — other artifact types have their own unrelated `completed` value).

## 5. Tests

- [x] 5.1 `test/cli.render.test.ts`: `renderPanel` — top rule carries the title, bottom rule has no right border, non-blank lines align to one width, blank lines are a bare rail, explicit width widens the panel, a width narrower than the title is clamped up, empty body renders rule-only.
- [x] 5.2 `test/cli.board.test.ts`: new fixture with a dangling dependency so blockers exist regardless of sprint scheduling; cases for bold/underline title, strikethrough-over-dim precedence on a satisfied-but-blocked row, dim-only on a blocked row, and panel rule alignment.
- [x] 5.3 `test/cli.board.test.ts`: extend the existing archived-in-sprint case — JSON status stays `completed`, human output shows `archived`.
- [x] 5.4 Confirm `test/delivery-mirror.test.ts` and `test/view.test.ts` status assertions pass unmodified — proof the `isSatisfied` refactor is behavior-preserving.

## 6. Documentation

- [x] 6.1 README: rewrite the board-styling paragraph (panel, title emphasis, strikethrough, rail-is-structural) and extend the `done`/`completed` paragraph with the human-only `archived` label.
- [x] 6.2 CHANGELOG `[Unreleased]` → `Changed`: panel/rail rendering, strikethrough for satisfied rows, `archived` display label; `--json` unchanged.
