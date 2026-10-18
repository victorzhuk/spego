# spego Tern plugin

A read-only Spego delivery board as a native Tern block. The plugin runs
`spego --json board --fresh` in the workspace and renders sprints, ungrouped
changes, warnings, and `next`. It mutates nothing: no sync, no record, no
index rebuild.

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

## Refresh

The board loads once on open and then only when you press `r`, the Refresh
button, or toggle the archived filter. There is no polling, file watching, or
automatic retry. `a` toggles archived ungrouped changes, `c` shows or hides
finished sprint sections. The board renders each section as a native table
under a `📋 Delivery board` heading with a status legend and CLI-style footer
hints. Table rows are not clickable in Tern, so the `Details` button lists
every rendered change; picking one opens its details from the
accepted board snapshot; task summaries load only for an active, non-archived
change with a readable, non-empty task plan (`spego tasks <slug> --json`).
A failed task load shows inside the details and never changes board rows.

## Read boundary

The plugin never writes under `.spego/artifacts/`, `.spego/revisions/`, or
`config.yaml`, and never touches OpenSpec files. Opening the board may let the
spego CLI initialize its existing index cache under `.spego/index/`; the
plugin promises nothing about a physically read-only index directory. Tern
has no plugin permission system: the plugin runs `spego` as a child process
with your user's full rights. It resolves `spego` from the host daemon's
PATH and requires it there.
