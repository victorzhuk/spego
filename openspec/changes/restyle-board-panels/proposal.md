## Why

`spego board` renders every sprint as an unadorned title line followed by a flat table. With more than one sprint plus the `Ungrouped` block, the output reads as one undifferentiated wall of rows: nothing marks where a sprint begins or ends, the sprint title carries no more visual weight than a data cell, and a finished change looks identical to a pending one. The only visual signal today is a dim body row for changes with pending blockers.

Separately, the status column shows both `done` and `completed` with no cue that they mean different things (`done` is all tasks checked; `completed` is archived in OpenSpec). A reader can't tell them apart at a glance, and four call sites in `src/delivery/mirror.ts` hand-duplicate the `=== 'completed' || === 'done'` disjunction that decides it.

## What Changes

- Each sprint section (plus `Ungrouped` and the trailing `Warnings` table) in `spego board`'s default human output now renders as a left-railed panel — the title is embedded in the top rail and bolded/underlined, and the panel bounds the table below it.
- Rows for a satisfied change (`done` or `completed`) are struck through. Rows that are merely blocked (and not satisfied) are dimmed, as before. A satisfied row that still carries a stale blocker is struck through, not dimmed — there is nothing left to act on.
- The rail is structural, not a color decoration: it renders under `--plain`, under `NO_COLOR`, and when stdout is not a TTY. Only the bold/underline/strikethrough/dim decorations are gated by those same conditions, matching the existing dim-row behavior.
- `spego board`'s default and `--graph` views, `spego epics`, and `spego view`'s `epic` rows print `completed` as `archived` in human output only. `--json` output is unchanged in every command — `completed` stays `completed` in the payload, so no agent-facing contract changes.
- `src/delivery/mirror.ts` gains an exported `isSatisfied(status)` predicate, replacing four internal `=== 'completed' || === 'done'` disjunctions with one definition.

## Capabilities

### Modified Capabilities

- `delivery-mirror`: the "Render focused views" requirement gains the panel/rail structure, the strikethrough-for-satisfied rule, its precedence over dim-for-blocked, and the human-only `archived` display label for `completed`.
- `agent-command-surface`: the "Human output uses pretty rendering primitives" requirement adds the left-rail panel to the blessed primitive set, with a scenario pinning that the rail survives `--plain` and non-TTY output.

### New Capabilities

None.

## Impact

- Affected source: `src/cli/render.ts` (new `renderPanel` primitive), `src/cli/commands/board.ts` (panel composition, row styling, status label), `src/cli/status.ts` (new `deliveryStatusLabel`), `src/cli/commands/delivery.ts` and `src/cli/commands/view.ts` (apply the label to their own status columns), `src/delivery/mirror.ts` (`isSatisfied` predicate).
- Behavior change: human-only. `--json` output for `board`, `epics`, `tasks`, `sprints`, and `view` is byte-for-byte unchanged — no agent-facing contract changes.
- Tests: `test/cli.render.test.ts` gains a `renderPanel` describe block; `test/cli.board.test.ts` gains a fixture and cases for panel structure, strikethrough/dim precedence, and the archived display label; existing `test/delivery-mirror.test.ts` and `test/view.test.ts` status assertions are unchanged, proving the `isSatisfied` refactor is behavior-preserving.
- Docs: `README.md`'s board-rendering and status paragraphs; `CHANGELOG.md` `[Unreleased]`.
