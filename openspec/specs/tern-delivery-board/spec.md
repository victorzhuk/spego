# tern-delivery-board Specification

## Purpose
This capability defines the shipped Stencil Tern plugin that renders spego's derived delivery board and per-change details as native terminal views, reading all delivery data from the spego CLI and leaving delivery state owned by spego.

## Requirements

### Requirement: Ship a native delivery-board block

The plugin package MUST live at `plugins/tern-spego/` with `plugin.toml`, `host.luau`, and `README.md`, and MUST ship inside the published npm package. The manifest MUST declare `schema = 1`, `id = "spego"`, a `host` entry, and exactly one `[[blocks]]` table: `id = "board"`, `title = "Spego Delivery Board"`, `palette = true`. The host entry MUST register it with `tern.block.define("board", ...)`. No window entry, lens, keybinding, or TSP application is added.

#### Scenario: Manifest and host entry agree

- **WHEN** the plugin is linked from `plugins/tern-spego/` and reloaded
- **THEN** the plugin reports a ready status with no problems
- **AND** it declares exactly one block, `board`

#### Scenario: Built-in palette entry opens the board

- **WHEN** the user chooses the palette row `New Spego Delivery Board block`
- **THEN** exactly one board pane opens without an additional palette command registered by the plugin

#### Scenario: Published payload carries the plugin

- **WHEN** the packed npm payload is inspected
- **THEN** it contains `plugins/tern-spego/plugin.toml`, `plugins/tern-spego/host.luau`, and `plugins/tern-spego/README.md`

### Requirement: Bind the board to its host workspace

The block MUST capture the absolute pane working directory as its workspace root when the pane starts and MUST NOT follow later focus or shell changes. A valid saved root MUST take precedence when the block is restored. The block MUST NOT search parent directories or offer a workspace picker. Every command MUST run on the block's host with that root as both the process working directory and its `--cwd` argument, resolving `spego` from the host PATH.

#### Scenario: Root is captured once at pane start

- **WHEN** a board pane opens in a session whose working directory is the fixture project root
- **THEN** every command it runs carries that absolute root as the process working directory and as `--cwd`

#### Scenario: A saved root wins on restore

- **WHEN** the block is restored in a session whose working directory differs from the saved root
- **THEN** the saved absolute root is used and the changed working directory is ignored

#### Scenario: A missing or relative working directory does not spawn

- **WHEN** the pane reports no working directory or a relative one and no valid saved root exists
- **THEN** the pane shows a configuration error
- **AND** no process is started

#### Scenario: A non-workspace root surfaces the CLI error

- **WHEN** the root is not a spego workspace
- **THEN** the pane shows the CLI error and instructs the user to reopen the block from the project root

#### Scenario: A remote host needs its own installation

- **WHEN** the pane runs on a remote Tern host
- **THEN** the plugin and a compatible `spego` executable are required on that host
- **AND** no local filesystem path is used to represent the remote workspace

### Requirement: Render delivery state and selected change details

The board MUST render the decoded `spego board --json` payload in the CLI's order, showing sprint sections, ungrouped changes, status, task progress, plan state, signals, estimates, warning messages, and `next`, and MUST NOT recompute delivery, dependency, pricing, or progress rules. Selecting a change MUST open details from the accepted snapshot, and task summaries MUST load only for an eligible selected change.

#### Scenario: Payload order and fields are preserved

- **WHEN** a board payload containing sprints, ungrouped changes, warnings, and a next suggestion decodes
- **THEN** the native view shows the sprint sections and change rows in the payload's order with their status, progress, plan state, signals, and available estimates
- **AND** `next` and every warning message are visible at board level

#### Scenario: Backend completed reads as archived

- **WHEN** a change's backend status is `completed`
- **THEN** the row reads `archived` while the payload's status value is not rewritten

#### Scenario: An empty board is distinguished from an unavailable adapter

- **WHEN** a workspace without a resolvable OpenSpec adapter is rendered
- **THEN** the pane shows the adapter-unavailable warning instead of a healthy empty board

#### Scenario: Display toggles control what is shown

- **WHEN** the archived toggle is off and a finished sprint exists
- **THEN** archived ungrouped changes and the finished sprint section are hidden and a count of the hidden sections is shown

#### Scenario: Details come from the accepted snapshot without mutation controls

- **WHEN** a change is selected through the board's own selection control
- **THEN** its details show blockers, gap notes, missing artifact types, warning codes, conflict track, plan state, progress, and available estimates and actuals
- **AND** no control invokes a mutating command

#### Scenario: Task summaries load only for an eligible change

- **WHEN** details open for an active, non-archived change whose plan is readable and non-empty
- **THEN** exactly that change's task summaries are requested and rendered in adapter order with title and status

#### Scenario: Ineligible changes keep board-only details

- **WHEN** details open for an archived change, or for a change whose plan is missing, unreadable, or known-empty
- **THEN** no task request is issued
- **AND** the board-only details remain visible

#### Scenario: Duplicate rows and duplicate task titles stay valid

- **WHEN** one change appears in more than one sprint context, or two tasks carry the same title
- **THEN** every rendered row keeps a unique native key and stays visible

#### Scenario: Selection survives a refresh

- **WHEN** a refresh reorders rows but the selected change is still present
- **THEN** the selection remains on that change
- **AND** it clears when the change is no longer present

### Requirement: Render the board as a native table

Each change MUST render as a table row with the columns `id`, `change`, `status`, `tasks`, `plan`, and `signals`, plus `hours` when the payload carries estimates, aligned under a column header. Status and plan state MUST render as the CLI's own portable symbols with distinct tones, and the `change` column MUST NOT truncate a slug.

#### Scenario: Rows render as aligned columns

- **WHEN** a section holds several changes
- **THEN** each change renders one row with its `id`, `change`, `status`, `tasks`, `plan`, and `signals` cells aligned under the column header
- **AND** the `change` cell carries the slug in full even when the pane is narrow enough to squeeze the other columns

#### Scenario: Status and plan render the CLI's symbols

- **WHEN** a section holds a blocked change and an in-progress change whose plan is planned
- **THEN** the blocked row's status cell renders `×` with the error tone and the in-progress row renders `▶` with its own tone
- **AND** the plan cells render `●` for a plan holding items, `◐` for one holding none, and `—` when the plan is unreadable or the change is satisfied
- **AND** the words `blocked`, `in-progress`, and `planned` remain available in the change's details

### Requirement: Head the board sections

Each sprint section MUST render its title, status, and dates above its rows, and the ungrouped changes MUST render under their own heading.

#### Scenario: Sections are headed

- **WHEN** the payload carries two sprints and ungrouped changes
- **THEN** each sprint renders its title, status, and dates above its rows
- **AND** the ungrouped changes render under their own heading

#### Scenario: The legend names the statuses in use

- **WHEN** any board renders
- **THEN** a legend line names every status the rendered rows actually use, in the CLI's own order, before the first section
- **AND** a status the board does not render contributes no legend entry

#### Scenario: Warnings and footer hints close the board

- **WHEN** the payload carries warnings, or finished sections are hidden, or the payload's `next` is null with a grooming hint
- **THEN** a warnings table renders a `code` and a `message` per warning
- **AND** the hidden-section count renders below the sections
- **AND** the footer names `spego board --gaps` when any rendered change carries a signal, and the grooming suggestion when the payload carries none

#### Scenario: The toolbar does not restate itself as text

- **WHEN** the board renders its controls
- **THEN** the archived and finished-sprint controls appear once, as interactive controls, without a duplicate text line repeating their labels

### Requirement: Refresh and restore the board safely

The board MUST refresh exactly once when the pane initializes or restores and once per explicit user refresh, and MUST NOT poll, watch files, refresh on focus, or retry automatically. Saved pane state MUST carry preferences only, never a delivery snapshot. A late callback MUST NOT modify a pane whose state has been replaced.

#### Scenario: Initialization and restoration request fresh data

- **WHEN** a board pane initializes or restores saved preferences
- **THEN** it issues one board request and renders the result

#### Scenario: Nothing else triggers a refresh

- **WHEN** canonical files change, the pane regains focus, or time passes
- **THEN** no board or task request is issued
- **WHEN** the user requests a refresh
- **THEN** exactly one new board request is issued

#### Scenario: Saved state holds preferences only

- **WHEN** the pane is restored after a daemon restart or reload
- **THEN** it restores the root, selection, detail visibility, and display toggles
- **AND** no board payload, task list, error, or loading state is restored from saved state

#### Scenario: Invalid saved preferences reset to defaults

- **WHEN** saved preferences are malformed or carry an unknown version
- **THEN** the block starts from defaults using the current absolute working directory

#### Scenario: Obsolete callbacks are ignored

- **WHEN** a board or task request completes after its pane was replaced, or after a later request superseded it
- **THEN** it changes no state, renders nothing, and raises no toast

#### Scenario: A refresh request during a load does not stack

- **WHEN** a refresh is requested while a board request is active
- **THEN** no second board request is started

### Requirement: Handle CLI and lifecycle failures

Every process start and JSON decode MUST be protected against failure, and output MUST be accepted only after a successful exit, no timeout, and structural validation of every consumed field. Failures MUST be reported without rendering a partial payload, and a failed refresh MUST retain the last successful board with a visible stale indication.

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

### Requirement: Preserve source-state ownership

The block MUST NOT mutate `.spego/artifacts/`, `.spego/revisions/`, `.spego/config.yaml`, OpenSpec files, or cross-project run records, and MUST NOT invoke `sync`, `record`, `init`, `skills`, an index rebuild, or any artifact mutation. Existing index cache initialization under `.spego/index/` and normal Tern pane-state persistence remain permitted.

#### Scenario: Source state is untouched

- **WHEN** the board loads, refreshes, and opens details for several changes
- **THEN** the contents and membership of `.spego/artifacts/`, `.spego/revisions/`, `.spego/config.yaml`, the OpenSpec directory, and cross-project run records are unchanged

#### Scenario: Index cache initialization is permitted

- **WHEN** the workspace has no index and the board loads
- **THEN** index files may appear under `.spego/index/`
- **AND** no artifact or OpenSpec file is written

#### Scenario: No mutation command is reachable

- **WHEN** any board or detail interaction is exercised
- **THEN** no process is started for `sync`, `record`, `init`, `skills`, or an index rebuild

#### Scenario: Process authority is documented

- **WHEN** the plugin README is read
- **THEN** it states that the plugin runs `spego` with the user's rights and that Tern declares no plugin permission model
