# spego Tern plugin

A native Tern block that renders Spego sprints, ungrouped changes, warnings,
and `next` from `spego --json board --fresh`.

## Install

```sh
tern plugin link plugins/tern-spego
```

`tern plugin link` points Tern at this checkout, so edits land on the next
`tern plugin reload`. A bare `tern plugin install github.com/...` clones the
default branch unpinned - prefer linking a known-good checkout.

## Workspace root

Open the block (palette: `New Spego Delivery Board block`) from a shell whose
working directory is the spego project root. The plugin captures that absolute
directory once at block start and never searches parent directories. A relative
or missing cwd is a configuration error, not a fallback. A saved absolute root
from a previous session is restored in preference to a changed cwd. Every
command runs on the block's host with that root as its process working
directory and as `--cwd`, so a remote host needs its own plugin installation
and a compatible `spego` on its daemon PATH.

A malformed or unknown-version saved preference record is discarded and all
preferences reset to defaults taken from the current working directory.

## Refresh

The board loads once on open. Use **Sync and refresh** or press `r` to run
`spego sync` before a fresh board read. Sync can create missing epics, close
finished sprints, and retire epics for archived changes. When sync fails, the
plugin displays the error and reads the board once to show any writes that
completed. When the read fails, the last successful board stays visible.

`a` toggles archived ungrouped changes and reads the board. `c` shows or hides
finished sprint sections. The board renders each section as a native table
under the block's native title, with a status legend and CLI-style footer
hints. Table rows are not clickable in Tern, so the `Details` button lists
every rendered change; the Details control itself is context-menu-only, and
keyboard selection is the pointer-free path: `d` opens details for the
selected visible change (or the first visible one), `n` and `p` move between
visible changes without wrapping, and Escape closes details. The archived and
finished-sprint filters never clear an accepted selection. Picking a menu
entry opens its details from the accepted board snapshot; task summaries load
only for an active, non-archived change with a readable, non-empty task plan
(`spego tasks <slug> --json`). A failed task load shows inside the details
and never changes board rows.

## Workspace writes

Manual sync can write under `.spego/artifacts/` and `.spego/revisions/`.
Opening the board, changing filters, and viewing details read source data.
The CLI may initialize its cache under `.spego/index/`. The plugin resolves
`spego` from the host daemon's PATH and runs it with your user's rights.
Tern provides no separate plugin permissions.
