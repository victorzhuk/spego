# delivery-mirror Delta Specification

## MODIFIED Requirements

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

### Requirement: Render focused views
The system SHALL render a default human board and provide `--graph` (dependency edges) and `--gaps` (gap flags and missing artifacts) focus views, honoring the global `--json` flag with a deterministic shape in all modes. Every human view SHALL carry the `id` column. The default board's change table SHALL carry exactly the columns `id`, `change`, `status`, `group`, and `signals`. The `change` column SHALL never be truncated — when the terminal is too narrow, other columns shrink or truncate first. The `signals` column SHALL summarize a change's blockers, gap flags, and missing artifacts as counts, rendering only the nonzero categories joined by `·` (e.g. `1 blk · 2 gap · 1 mis`) and `—` when all three are zero; full signal text stays in the `--gaps` view, and the default board SHALL append a footer hint pointing at `spego board --gaps` whenever any rendered change has a nonzero signal count. When the mirror's mechanical reconciliation plan is non-empty, the default board SHALL append a footer hint reporting the number of pending mechanical fixes and pointing at `spego sync`. The default board SHALL group each sprint, the `Ungrouped` list, and the trailing `Warnings` table into a left-railed, right-bordered panel with its title embedded in the panel's top rule; a sprint panel's title SHALL render as `<title> · <status> · <slug>`, without a leading `Sprint` label. The default board and `--graph` SHALL render a change's `completed` status as `archived` in the `status` column, and SHALL render a change's `group` wave index as a letter (`A`, `B`, … `Z`, `AA`, …) in the `group` column. Within a panel, a row for a change whose status is satisfied (`done` or `completed`) SHALL be struck through; a row that is merely blocked (not satisfied, with pending blockers) SHALL be dimmed instead, except when `--plain` is passed, the `NO_COLOR` env var is set, or stdout is not a TTY. The left-railed, right-bordered panel structure SHALL render under those same conditions regardless — only the bold/underline/strikethrough/dim decorations are gated, not the panel border itself. `--json` output SHALL never carry ANSI codes, SHALL always report `completed` (not `archived`) for status, SHALL always report the `group` wave index as its underlying string (e.g. `g001`), never the human letter label, and SHALL keep carrying the full `blockers`, `gaps`, and `missing` arrays per change — the `signals` counter form is human-output-only. Archived changes SHALL be excluded from the `ungrouped` list by default; the `--archived` flag SHALL restore them. This filtering SHALL NOT remove an archived change from a sprint's own `changes` list — a sprint's delivered history stays intact. The default board's `Warnings` table SHALL aggregate rows describing the same underlying fact into one human-readable row rather than one row per affected change or dependency edge, while `--json`'s `warnings` array and every `MirrorChange.warnings` list SHALL continue to carry one entry per fact, unaggregated.

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

#### Scenario: Human output shows a group letter, JSON keeps the wave index
- **WHEN** a change's derived `group` is a wave-index string such as `g001` or `g002`
- **THEN** the human board and `--graph` views print a letter (`A`, `B`, …) in the `group` column
- **AND** the `--json` payload for the same board still reports `group: "g001"` (or the matching wave string), never the letter

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
