## MODIFIED Requirements

### Requirement: Refresh and restore the board safely

The board MUST refresh exactly once when the pane initializes or restores and once after each accepted manual sync attempt, and MUST NOT poll, watch files, refresh on focus, or retry automatically. Saved pane state MUST carry preferences only, never a delivery snapshot. A late callback MUST NOT modify a pane whose state has been replaced.

#### Scenario: Initialization and restoration request fresh data

- **WHEN** a board pane initializes or restores saved preferences
- **THEN** it issues one board request and renders the result

#### Scenario: Nothing else triggers a refresh

- **WHEN** canonical files change, the pane regains focus, or time passes
- **THEN** no board or task request is issued

#### Scenario: Manual refresh reconciles before reading

- **WHEN** the user presses the Sync and refresh button or `r` while idle
- **THEN** the pane runs `spego --json sync --cwd <root>` before starting one fresh board request
- **AND** archive toggles during sync are included in that board request

#### Scenario: Saved state holds preferences only

- **WHEN** the pane is restored after a daemon restart or reload
- **THEN** it restores the root, selection, detail visibility, and display toggles
- **AND** no board payload, task list, error, or loading state is restored from saved state

#### Scenario: Invalid saved preferences reset to defaults

- **WHEN** saved preferences are malformed or carry an unknown version
- **THEN** the block starts from defaults using the current absolute working directory

#### Scenario: Obsolete callbacks are ignored

- **WHEN** a sync, board, or task request completes after its pane was replaced, or after a later request superseded it
- **THEN** it changes no state, renders nothing, and raises no toast

#### Scenario: A refresh request during a load does not stack

- **WHEN** a refresh is requested while a sync or board request is active
- **THEN** no additional sync or board request is started

### Requirement: Handle CLI and lifecycle failures

Every process start and JSON decode MUST be protected against failure, and output MUST be accepted only after a successful exit, no timeout, and structural validation of every consumed field. Failures MUST be reported without rendering a partial payload, and a failed board read MUST retain the last successful board with a visible stale indication.

#### Scenario: A missing executable is reported, not installed

- **WHEN** `spego` is not resolvable on the host PATH
- **THEN** the pane shows an actionable error and starts no installer or shell profile

#### Scenario: Process failures do not produce a board

- **WHEN** the process fails to start, exceeds its timeout, or exits nonzero
- **THEN** the pane reports the failure, using stderr for diagnostics when available
- **AND** no partial or empty board is presented as successful

#### Scenario: Malformed or wrong-shaped output is rejected

- **WHEN** stdout is not valid JSON, or decodes to a shape missing a consumed field
- **THEN** the pane reports a load failure instead of rendering a partial payload

#### Scenario: An output stream at the host cap is rejected

- **WHEN** a captured stdout or stderr stream reaches the host's 16 MiB cap
- **THEN** the result is treated as possibly truncated and rejected

#### Scenario: Optional counts are validated as a pair

- **WHEN** `taskCount` or `tasksDone` is present
- **THEN** both are present as nonnegative integers with `tasksDone` not exceeding `taskCount`
- **AND** their absence is not treated as an incompatible CLI

#### Scenario: An older CLI is reported as incompatible

- **WHEN** the binary rejects `--fresh`
- **THEN** the pane reports a compatibility error
- **AND** no fallback to ordinary indexed board output occurs

#### Scenario: A failed refresh keeps the previous board

- **WHEN** a board request fails after a successful load
- **THEN** the previous board stays visible with a stale or error indication
- **AND** a further manual refresh is possible

#### Scenario: A task failure stays inside details

- **WHEN** a task request fails after the board loaded
- **THEN** the error appears with the task details while the board rows keep their payload values
- **AND** board progress is never derived from the task response

#### Scenario: Busy state is cleared on every path

- **WHEN** a start attempt fails before reaching the process callback
- **THEN** the pane leaves its loading state so refresh remains available

#### Scenario: Sync fails after possible writes

- **WHEN** sync fails to start, times out, or exits nonzero
- **THEN** the pane reports the sync failure and attempts one fresh board read
- **AND** the sync error stays visible even if the read succeeds
- **AND** the pane never retries sync automatically

### Requirement: Preserve source-state ownership

Only explicit manual refresh may invoke `spego sync` to reconcile artifacts and revisions through the CLI. The block MUST NOT invoke `record`, `init`, `skills`, an index rebuild, or any other artifact mutation. It MUST NOT modify configuration, OpenSpec files, or cross-project run records. Existing index cache initialization under `.spego/index/` and normal Tern pane-state persistence remain permitted.

#### Scenario: Source state is untouched

- **WHEN** the board opens, restores preferences, changes filters, or opens details
- **THEN** the contents and membership of `.spego/artifacts/`, `.spego/revisions/`, `.spego/config.yaml`, the OpenSpec directory, and cross-project run records are unchanged

#### Scenario: Index cache initialization is permitted

- **WHEN** the workspace has no index and the board loads
- **THEN** index files may appear under `.spego/index/`
- **AND** no artifact or OpenSpec file is written

#### Scenario: No mutation command is reachable

- **WHEN** the pane opens, restores, changes filters, or opens details
- **THEN** no process is started for `sync`, `record`, `init`, `skills`, or an index rebuild

#### Scenario: Process authority is documented

- **WHEN** the plugin README is read
- **THEN** it states that the plugin runs `spego` with the user's rights and that Tern declares no plugin permission model
