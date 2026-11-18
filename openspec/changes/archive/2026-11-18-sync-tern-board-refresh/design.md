## Decisions

Manual refresh runs sync and then uses the existing fresh board loader. The active workspace and pane generation guard the sync callback. One busy state serializes sync with board reads within the pane. The board request uses the latest archived preference.

Sync can apply part of its plan before failing. The plugin attempts one fresh board read after either result and keeps the sync error visible until the next manual refresh. If that read fails, the accepted snapshot stays visible with its stale indication.

## Verification

Use the deterministic Tern suite to check command ordering, busy state, filter changes, obsolete callbacks, and both failure paths. The suite runs without writing to a live workspace.
