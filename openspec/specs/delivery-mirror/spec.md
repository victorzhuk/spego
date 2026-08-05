# delivery-mirror Specification

## Purpose
TBD - created by archiving change add-mirror-command. Update Purpose after archive.
## Requirements
### Requirement: Derive the delivery mirror
The system SHALL derive the Mirror on demand from read-only inputs — OpenSpec adapter state, epic artifacts, and sprint-plan artifacts — and SHALL NOT store the derived graph or mutate any artifact or OpenSpec file while rendering. Derived state SHALL include per-change status, dependency edges, blockers, gap flags, and missing artifacts computed as `requires` minus resolvable `links`. Each change SHALL also carry a stable `id`, derived only from its own slug (unaffected by other changes being added, removed, or archived), and a `group` naming its conflict track: the epic's `track` metadata when set, `?` for a pending change without one, `—` for a satisfied change. Two changes sharing a track conflict and MUST NOT run in parallel; changes on different tracks are parallel-safe unless a dependency edge orders them. Within each sprint, the derived `changes` list SHALL be in execution order: topologically sorted by declared deps among the sprint's own members (a dependency precedes its dependent), stable to the sprint-plan's stored list order for ties, with dependency-cycle members left in stored order.

#### Scenario: Board from groomed workspace
- **WHEN** an agent runs `spego board --json` in a workspace with epics and sprint-plans
- **THEN** the output lists sprints in sprint order with their changes in execution order
- **AND** each change carries status, blockers, gaps, missing artifacts, `id`, and `group`
- **AND** no artifact or OpenSpec file is modified

#### Scenario: Group reports the epic's track
- **WHEN** two pending changes' epics both carry `track: storage` and a third pending change's epic carries `track: tma`
- **THEN** the first two report `group: "storage"` and the third reports `group: "tma"`
- **AND** a pending change whose epic has no `track` reports `group: "?"`
- **AND** a satisfied change reports `group: "—"` regardless of its track

#### Scenario: Sprint changes sorted by execution order
- **WHEN** a sprint-plan stores `changes: [b, a]` and `b`'s epic declares a dep on `a`
- **THEN** the derived sprint lists `a` before `b`
- **AND** changes without dependency edges between them keep their stored relative order

#### Scenario: Cycle members keep stored order
- **WHEN** a sprint's changes `x` and `y` depend on each other
- **THEN** the derived sprint keeps `x` and `y` in stored list order
- **AND** both are reported as members of a `dep-cycle`

#### Scenario: Blocked change
- **WHEN** change X's epic declares a dep on change D
- **AND** D's status is not `done` or `completed`, and D is not scheduled in the same or an earlier sprint than X
- **THEN** X is reported blocked by D, referenced by D's `id`

#### Scenario: Empty mirror state
- **WHEN** an agent runs `spego board` in a workspace with active changes but no epic artifacts
- **THEN** the command succeeds with the adapter-only view
- **AND** each active change is flagged `ungroomed-change`

#### Scenario: Stable id across board membership changes
- **WHEN** a change's `id` is derived on one render
- **AND** another change is added, removed, or archived elsewhere on the board
- **THEN** the original change's `id` is unchanged on the next render

#### Scenario: Archived dependency resolves
- **WHEN** change X depends on change D
- **AND** D has been archived in OpenSpec (found under `openspec/changes/archive/`)
- **THEN** D resolves to status `completed` and is not reported as a `dangling-dep` or a blocker of X

### Requirement: Report drift warnings
The system SHALL attach drift warnings to every mirror rendering, covering: `dangling-dep`, `dep-cycle`, `out-of-order-dep`, `ungroomed-change`, `orphan-epic`, and `closable-sprint`. Dependency cycles SHALL be reported, treated as blocking their members, and SHALL NOT cause non-termination. An archived change scheduled into a sprint SHALL NOT produce a warning of its own: mid-sprint archival is normal progress, already visible as a struck-through row, and end-of-sprint cleanup is owned by `closable-sprint`.

#### Scenario: Orphan epic after archive
- **WHEN** an epic's change has been archived in OpenSpec
- **THEN** the mirror reports `orphan-epic` for that epic and notes the change is archived

#### Scenario: Closable sprint
- **WHEN** every change of a non-closed sprint-plan is `done`, `completed`, or archived
- **THEN** the mirror reports `closable-sprint` for that sprint

#### Scenario: Out-of-order dependency
- **WHEN** a scheduled change X is blocked by dependency D
- **AND** D is scheduled into a sprint later than X's sprint
- **THEN** the mirror reports `out-of-order-dep` with `details.change` set to X's slug and `details.dep` set to D's slug
- **AND** a dependency scheduled in the same or an earlier sprint than X does not trigger this warning

#### Scenario: Archived change in a closed sprint is not drift
- **WHEN** a sprint's status is `closed`
- **AND** the sprint's `changes` list includes an archived change
- **THEN** the mirror reports no warning about that scheduling

#### Scenario: Archived change in a live sprint is not drift
- **WHEN** a sprint's status is `planned` or `active`
- **AND** the sprint's `changes` list includes an archived change
- **THEN** the mirror reports no warning about that scheduling
- **AND** the change's row renders struck through as a satisfied change

### Requirement: Manual status override via epic metadata
The system SHALL allow a change's derived status to be overridden to `blocked` or `paused` by setting `status` on its `epic` artifact's `meta`, since these are subjective states with no signal in OpenSpec's plain-text files. This override SHALL apply only to a known change (one with a backing OpenSpec change) and SHALL NOT accept any other status value for a known change — a human cannot force a known change to `done`, `completed`, `in-progress`, or `backlog` via this mechanism, since that would desync the reported status from the dependency-satisfaction semantics the rest of the graph relies on. An archived change (`archived === true`) SHALL always resolve to `completed`, overriding any manual override.

#### Scenario: Blocked override on a known change
- **WHEN** a known change's epic has `meta.status: 'blocked'`
- **AND** the change is not archived
- **THEN** the change's status is `blocked`
- **AND** the change is reported as an unsatisfied blocker for anything depending on it

#### Scenario: Paused override on a known change
- **WHEN** a known change's epic has `meta.status: 'paused'`
- **AND** the change is not archived
- **THEN** the change's status is `paused`
- **AND** the change is reported as an unsatisfied blocker for anything depending on it

#### Scenario: Archived wins over a manual override
- **WHEN** a change is archived
- **AND** its epic has `meta.status: 'blocked'` or `meta.status: 'paused'`
- **THEN** the change's status resolves to `completed`

### Requirement: Suggest the next change
The system SHALL suggest as next the first pending, unblocked change in the active sprint's execution order (the same dependency-sorted order the board renders); when no sprint is active, the first planned sprint in sprint order is used; when nothing is eligible, the system SHALL return no suggestion and hint that grooming is needed.

#### Scenario: Next in active sprint
- **WHEN** the active sprint's execution order is `[a, b, c]`, `a` is done and `b` is blocked
- **THEN** the mirror suggests `c`

#### Scenario: Next respects execution order over stored order
- **WHEN** the active sprint stores `changes: [b, a]` and `b` depends on pending `a`
- **THEN** the mirror suggests `a`

#### Scenario: Nothing eligible
- **WHEN** every pending change is blocked
- **THEN** the mirror returns no suggestion
- **AND** the output hints to run the groom workflow

### Requirement: Render focused views
The system SHALL render a default human board and provide `--graph` (dependency edges) and `--gaps` (gap flags and missing artifacts) focus views, honoring the global `--json` flag with a deterministic shape in all modes. Every human view SHALL carry the `id` column. The default board's change table SHALL carry exactly the columns `id`, `change`, `status`, `group`, and `signals`. The `change` column SHALL never be truncated — when the terminal is too narrow, other columns shrink or truncate first. The `signals` column SHALL summarize a change's blockers, gap flags, and missing artifacts as counts, rendering only the nonzero categories joined by `·` (e.g. `1 blk · 2 gap · 1 mis`) and `—` when all three are zero; full signal text stays in the `--gaps` view, and the default board SHALL append a footer hint pointing at `spego board --gaps` whenever any rendered change has a nonzero signal count. When the mirror's mechanical reconciliation plan is non-empty, the default board SHALL append a footer hint reporting the number of pending mechanical fixes and pointing at `spego sync`. The default board SHALL group each sprint, the `Ungrouped` list, and the trailing `Warnings` table into a left-railed, right-bordered panel with its title embedded in the panel's top rule; a sprint panel's title SHALL render as `<title> · <status> · <slug>`, without a leading `Sprint` label. The default board and `--graph` SHALL render a change's `completed` status as `archived` in the `status` column, and SHALL render the `group` column as the change's conflict-track value (`track` name, `?`, or `—`) identically in human and `--json` output — there is no separate human label for group. Within a panel, a row for a change whose status is satisfied (`done` or `completed`) SHALL be struck through; a row that is merely blocked (not satisfied, with pending blockers) SHALL be dimmed instead, except when `--plain` is passed, the `NO_COLOR` env var is set, or stdout is not a TTY. The left-railed, right-bordered panel structure SHALL render under those same conditions regardless — only the bold/underline/strikethrough/dim decorations are gated, not the panel border itself. `--json` output SHALL never carry ANSI codes, SHALL always report `completed` (not `archived`) for status, and SHALL keep carrying the full `blockers`, `gaps`, and `missing` arrays per change — the `signals` counter form is human-output-only. Archived changes SHALL be excluded from the `ungrouped` list by default; the `--archived` flag SHALL restore them. This filtering SHALL NOT remove an archived change from a sprint's own `changes` list — a sprint's delivered history stays intact. The default board's `Warnings` table SHALL aggregate rows describing the same underlying fact into one human-readable row rather than one row per affected change or dependency edge, while `--json`'s `warnings` array and every `MirrorChange.warnings` list SHALL continue to carry one entry per fact, unaggregated.

#### Scenario: Gap focus
- **WHEN** an agent runs `spego board --gaps --json`
- **THEN** the output is limited to changes with gap flags or missing artifacts, plus warnings

#### Scenario: Plain output suppresses color
- **WHEN** an agent runs `spego board --plain` against a workspace with blocked changes
- **THEN** the rendered rows carry no ANSI escape codes

#### Scenario: Change column survives a narrow terminal
- **WHEN** the human board renders in a terminal too narrow for every column's natural width
- **THEN** the `change` column still shows every change slug in full, untruncated
- **AND** other columns shrink or truncate to absorb the deficit

#### Scenario: Signals column summarizes counts
- **WHEN** a rendered change has one blocker, two gap flags, and no missing artifacts
- **THEN** its `signals` cell reads `1 blk · 2 gap`
- **AND** a change with no blockers, gaps, or missing artifacts renders `—`
- **AND** the board footer hints at `spego board --gaps` for detail

#### Scenario: JSON keeps full signal arrays
- **WHEN** an agent runs `spego board --json` against a workspace with blocked changes and gap flags
- **THEN** each change in the payload carries its full `blockers`, `gaps`, and `missing` arrays
- **AND** no `signals` counter string appears in the payload

#### Scenario: Sync hint footer for pending mechanical fixes
- **WHEN** the human board renders while the mechanical reconciliation plan contains two actions
- **THEN** the board footer reports `2 mechanical fixes — run spego sync`
- **AND** a board whose mechanical plan is empty renders no such hint

#### Scenario: Human output shows a group letter, JSON keeps the wave index
- **WHEN** a pending change's epic carries `track: api-contract`
- **THEN** the human board's `group` column reads `api-contract` — the track name verbatim, not a wave letter
- **AND** the `--json` payload reports `group: "api-contract"` for the same change
- **AND** no wave code (`g001`) or letter label (`A`) appears in either mode

#### Scenario: Archived changes hidden from ungrouped by default
- **WHEN** an agent runs `spego board` in a workspace with an archived change that is not scheduled into any sprint
- **THEN** that change is absent from the `Ungrouped` list
- **AND** running `spego board --archived` includes it in `Ungrouped` again
- **AND** an archived change still scheduled into a sprint appears in that sprint's list either way

#### Scenario: Sprint sections are grouped by a left rail
- **WHEN** a user runs `spego board` in a workspace with at least one sprint
- **THEN** the sprint's title, change table, `Ungrouped` list, and `Warnings` table each render inside a panel with a left rail and a right border
- **AND** the sprint panel's title renders as `<title> · <status> · <slug>` and is bolded, not underlined

#### Scenario: Satisfied row is struck through
- **WHEN** a change's status is `done` or `completed`
- **THEN** its row in the human board is struck through

#### Scenario: Satisfied and blocked row is struck, not dimmed
- **WHEN** a change's status is satisfied (`done` or `completed`) and it still has pending blockers
- **THEN** its row is struck through
- **AND** its row is not additionally dimmed

#### Scenario: Human output shows the archived label, JSON keeps completed
- **WHEN** a change is archived, so its status resolves to `completed`
- **THEN** the human board and `--graph` views print `archived` in the `status` column
- **AND** the `--json` payload for the same board still reports `status: "completed"`

#### Scenario: Panel rail survives plain output
- **WHEN** an agent runs `spego board --plain` against a workspace with at least one sprint
- **THEN** the sprint section still renders inside a left-railed, right-bordered panel
- **AND** the panel carries no ANSI escape codes

#### Scenario: Warnings describing the same fact aggregate into one row
- **WHEN** a workspace has several epics that do not resolve to any OpenSpec change
- **THEN** the human `Warnings` table renders one `orphan-epic` row naming the affected epics, not one row per epic
- **AND** the `--json` payload's `warnings` array still contains one `orphan-epic` object per affected epic

### Requirement: Synchronize mirror state
The system SHALL expose a deterministic reconciliation over mirror state: `spego sync` SHALL derive a plan from the same mirror the board computes and apply only the mechanical subset of it — creating an `epic` artifact for every active change that has none (the `ungroomed-change` condition), titled from the change's resolved title, closing every non-closed sprint whose changes are all satisfied (the `closable-sprint` condition), and retiring (soft-deleting) every epic whose backing OpenSpec change has been archived (the `orphan-epic` condition with the archived reason). It SHALL NOT act on judgment-only drift — `orphan-epic` whose change does not resolve to any OpenSpec change at all, dependency edges, gaps, `requires`/`links`, or sprint grouping — which it SHALL instead report as remaining. It SHALL NOT write into `openspec/`, and every write SHALL go through the same optimistic-concurrency artifact-engine path (`create`, `update` with an expected revision, `softDelete`) already used elsewhere, so a concurrent conflicting write is rejected rather than silently overwritten. A `--dry-run` flag SHALL derive and report the plan without writing anything. `spego board --sync` SHALL apply the same mechanical plan and then render the board derived from the reconciled state; without the flag, `spego board` SHALL remain strictly read-only. Applying the same plan twice SHALL be a no-op the second time.

#### Scenario: Create epic for an ungroomed change
- **WHEN** an agent runs `spego sync` in a workspace with an active OpenSpec change that has no epic artifact
- **THEN** the system creates an `epic` artifact for that change, titled from the change's resolved title
- **AND** the created epic resolves the change's `ungroomed-change` warning on the next board render

#### Scenario: Close a finished sprint
- **WHEN** an agent runs `spego sync` in a workspace with a non-closed sprint whose every change is satisfied
- **THEN** the system sets that sprint-plan's status to `closed`
- **AND** the sprint's `closable-sprint` warning no longer appears on the next board render

#### Scenario: Retire the epic of an archived change
- **WHEN** an agent runs `spego sync` in a workspace with an epic whose OpenSpec change has been archived
- **THEN** the system soft-deletes that epic artifact
- **AND** the epic's `orphan-epic` warning no longer appears on the next board render

#### Scenario: Missing-change orphan is reported, not applied
- **WHEN** an agent runs `spego sync` in a workspace with an epic that does not resolve to any OpenSpec change, active or archived
- **THEN** the system does not delete, retire, or otherwise mutate that epic
- **AND** the warning is included in the sync output as remaining work

#### Scenario: Judgment-only drift is reported, not applied
- **WHEN** an agent runs `spego sync` in a workspace with judgment-only drift — an `orphan-epic` warning whose epic resolves to no OpenSpec change, dependency edges, or gap flags
- **THEN** the system does not delete, retire, or otherwise mutate the affected artifacts
- **AND** the drift is included in the sync output as remaining work

#### Scenario: Board applies the mechanical plan with --sync
- **WHEN** an agent runs `spego board --sync` in a workspace with an ungroomed active change
- **THEN** the epic is created before rendering
- **AND** the rendered board shows the change groomed, with no `ungroomed-change` warning

#### Scenario: Dry run writes nothing
- **WHEN** an agent runs `spego sync --dry-run` in a workspace with pending reconciliation actions
- **THEN** the system reports the plan it would apply
- **AND** no artifact file is created, updated, or otherwise modified

#### Scenario: Sync is idempotent
- **WHEN** an agent runs `spego sync` twice in a row with no other changes to the workspace in between
- **THEN** the second run applies zero actions

#### Scenario: Sync never writes OpenSpec files
- **WHEN** an agent runs `spego sync` in any workspace
- **THEN** no file under `openspec/` is created, updated, or deleted

