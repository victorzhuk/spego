## Why

spego derives a delivery board from OpenSpec changes plus `epic` and `sprint-plan` artifacts, but the only way to read it is a one-shot CLI render. Stencil Tern runs native plugin blocks whose panes survive window closes and daemon restarts, so a spego board pane gives that derived state a persistent native surface with manual refresh.

## What Changes

- Ship a static, host-only Tern plugin at `plugins/tern-spego/` declaring one `board` block, published inside `@zhuk/spego`.
- Render `spego board --json` as native Tern views: sprint sections, ungrouped changes, status, task progress, plan state, signals, estimates, warnings, and `next`.
- Open change details from the board and load `spego tasks <change> --json` on demand for the selected change only.
- Refresh once on pane initialization or restoration and once per explicit user request, with no polling or file watching.
- Save preferences only — workspace root, selection, detail visibility, display toggles — never a delivery snapshot.
- Add `spego board --fresh`, which reads current canonical artifact metadata for that invocation instead of trusting indexed rows.
- Add optional `taskCount` and `tasksDone` to board JSON so a board consumer can render progress without a second command per change.

## Capabilities

### New Capabilities

- `tern-delivery-board`: a shipped host-only Tern plugin block that renders the spego delivery board and per-change details natively from spego JSON output.

### Modified Capabilities

- `delivery-mirror`: board JSON gains optional per-change task counts, and `spego board --fresh` reads canonical artifact metadata rather than indexed rows.

## Impact

- New files: `plugins/tern-spego/plugin.toml`, `plugins/tern-spego/host.luau`, `plugins/tern-spego/README.md`; `package.json` `files` list.
- Affected code: `src/cli/commands/board.ts` (new `--fresh` flag), `src/delivery/load.ts`, `src/delivery/mirror.ts`, `src/artifacts/`.
- Affected specs: new `tern-delivery-board`; modified `delivery-mirror`.
- No change to the existing `agents` and `opencode` targets, and no new delivery mutation surface.
