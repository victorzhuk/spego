# OpenSpec delivery adapter

The default delivery adapter is OpenSpec. `spego epics` exposes active OpenSpec changes as delivery epics, and `spego tasks --change <name>` exposes checklist items from the change's `tasks.md`.

| Source | spego view |
|--------|------------|
| `openspec/changes/<name>/proposal.md` | Epic title |
| `openspec/changes/<name>/tasks.md` | Task status and counts |

The `openspec` binary is not required on PATH — board and epics resolve status entirely from `tasks.md` on disk.

## Read-only contract

The adapter observes OpenSpec state. It does not create, continue, apply, verify, sync, or archive OpenSpec changes.

`spego sync` reconciles the delivery mirror — it creates a missing epic for every ungroomed change, closes every finished sprint, and retires the epic of any archived change. It is unrelated to OpenSpec's own `sync` / `/opsx:sync`, which merges a change's spec deltas into the main specs tree.

## Status derivation

Archived changes under `openspec/changes/archive/` are excluded from the active set. Of the remainder:

- no `tasks.md`, or an empty one → `backlog`
- `tasks.md` with unchecked items → `in-progress`
- all items checked → `done`

Archived changes always resolve to `completed`. See [Delivery board](delivery-board.md#status) for how the two finished states differ and how manual overrides interact with them.

## Example

```sh
spego epics --json
spego tasks --change <change-name> --json
```

## Related

- [Delivery board](delivery-board.md)
- [Workflows](workflows.md#combined-openspec--spego-workflows) — which surface owns which state
