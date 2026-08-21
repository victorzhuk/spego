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
The system SHALL attach drift warnings to every mirror rendering, covering: `dangling-dep`, `dep-cycle`, `out-of-order-dep`, `ungroomed-change`, `orphan-epic`, `closable-sprint`, and `stale-profile`. Dependency cycles SHALL be reported, treated as blocking their members, and SHALL NOT cause non-termination. An archived change scheduled into a sprint SHALL NOT produce a warning of its own: mid-sprint archival is normal progress, already visible as a struck-through row, and end-of-sprint cleanup is owned by `closable-sprint`. A `stale-profile` warning SHALL fire when a Flow and Size Tier pair's bias leaves a fixed band around parity, naming the Flow, the tier, and the direction of the miss, and pointing at re-grooming rather than at an automatic repair.

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

#### Scenario: Profile drifted from reality
- **WHEN** a Flow and Size Tier pair's bias leaves the band around parity
- **THEN** the mirror reports `stale-profile` naming the Flow, the tier, and the direction
- **AND** a pair whose bias sits inside the band raises no warning

#### Scenario: Stale profile aggregates in human output
- **WHEN** several Flow and Tier pairs have drifted
- **THEN** the human `Warnings` table renders one `stale-profile` row naming the affected pairs
- **AND** the `--json` payload's `warnings` array carries one entry per pair

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
The system SHALL render a default human board and provide `--graph` (dependency edges) and `--gaps` (gap flags and missing artifacts) focus views, honoring the global `--json` flag with a deterministic shape in all modes. Every human view SHALL carry the `id` column. The default board's change table SHALL carry exactly the columns `id`, `change`, `status`, `group`, `hours`, and `signals`. The `hours` column SHALL carry the change's Flow Estimate, rendering `?` for an unpriced change (no `tier`, unknown `flow`, or missing profile), and each sprint panel SHALL report its remaining total alongside the panel title; a workspace declaring no `flows` block SHALL omit the column and the totals entirely. An unpriced change SHALL NOT count toward its sprint's total, and a sprint holding pending unpriced changes SHALL render its total with a `+?` suffix so the total never reads as a complete plan when it is not. Hours SHALL render as decimal numbers with trailing zeros trimmed (`0.5`, `1`, `2`); a sprint total SHALL be summed from unrounded values and formatted the same way. The `change` column SHALL never be truncated — when the terminal is too narrow, other columns shrink or truncate first. The `signals` column SHALL summarize a change's blockers, gap flags, and missing artifacts as counts, rendering only the nonzero categories joined by `·` (e.g. `1 blk · 2 gap · 1 mis`) and `—` when all three are zero; full signal text stays in the `--gaps` view, and the default board SHALL append a footer hint pointing at `spego board --gaps` whenever any rendered change has a nonzero signal count. When the mirror's mechanical reconciliation plan is non-empty, the default board SHALL append a footer hint reporting the number of pending mechanical fixes and pointing at `spego sync`. The default board SHALL group each sprint, the `Ungrouped` list, and the trailing `Warnings` table into a left-railed, right-bordered panel with its title embedded in the panel's top rule; a sprint panel's title SHALL render as `<title> · <status> · <slug>`, without a leading `Sprint` label. The default board and `--graph` SHALL render a change's `completed` status as `archived` in the `status` column, and SHALL render the `group` column as the change's conflict-track value (`track` name, `?`, or `—`) identically in human and `--json` output — there is no separate human label for group. Within a panel, a row for a change whose status is satisfied (`done` or `completed`) SHALL be struck through; a row that is merely blocked (not satisfied, with pending blockers) SHALL be dimmed instead, except when `--plain` is passed, the `NO_COLOR` env var is set, or stdout is not a TTY. The left-railed, right-bordered panel structure SHALL render under those same conditions regardless — only the bold/underline/strikethrough/dim decorations are gated, not the panel border itself. `--json` output SHALL never carry ANSI codes, SHALL always report `completed` (not `archived`) for status, SHALL carry each change's Flow Estimate, Human Estimate, and rung together with each sprint's total, and SHALL keep carrying the full `blockers`, `gaps`, and `missing` arrays per change — the `signals` counter form is human-output-only. Archived changes SHALL be excluded from the `ungrouped` list by default; the `--archived` flag SHALL restore them. This filtering SHALL NOT remove an archived change from a sprint's own `changes` list — a sprint's delivered history stays intact. The default board's `Warnings` table SHALL aggregate rows describing the same underlying fact into one human-readable row rather than one row per affected change or dependency edge, while `--json`'s `warnings` array and every `MirrorChange.warnings` list SHALL continue to carry one entry per fact, unaggregated.

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

#### Scenario: Hours column and sprint total
- **WHEN** a priced workspace renders the default board
- **THEN** each change row's `hours` cell carries its Flow Estimate
- **AND** each sprint panel reports the total Flow Estimate of its pending changes

#### Scenario: Unpriced workspace omits the column
- **WHEN** the workspace declares no `flows` block
- **THEN** the default board renders without the `hours` column and without sprint totals
- **AND** `--json` carries no estimates

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

### Requirement: Price changes and sprints
The system SHALL derive, on render and without storing them, a Flow Estimate and a Human Estimate for every change whose epic carries a `tier` and whose workspace declares a `flows` block. The Flow Estimate SHALL come from the profile of the change's Flow — the epic's `flow` when set, otherwise the workspace default — and the Human Estimate SHALL come from the shared human table. A Flow Profile SHALL resolve down a ladder, independently for each Flow and Size Tier pair: the median of this workspace's recorded runs for that pair once their count reaches a fixed minimum; otherwise, when the workspace opts into cross-project pricing, the median of the cross-project store's runs for that pair once they reach the same minimum; otherwise the config seed. Only runs recorded under a Flow SHALL count toward that Flow's profile. Every priced change SHALL carry the rung its price came from, so a consumer can tell a declared number from a measured one and repo evidence from cross-project evidence. Each sprint SHALL carry the total Flow Estimate of its pending changes; changes whose status is `done` or `completed` SHALL NOT count toward that total. A change whose epic declares a Flow absent from `flows.profiles` and with no recorded runs SHALL be reported unpriced rather than failing the render.

#### Scenario: Change priced from the default flow
- **WHEN** an epic carries `tier: m` and the workspace declares `flows.default: zapply` with a `zapply` profile pricing `m`
- **THEN** the change carries a Flow Estimate equal to that profile's `m` value
- **AND** a Human Estimate equal to the human table's `m` value
- **AND** a rung identifying the config seed as the source

#### Scenario: Epic overrides the flow
- **WHEN** an epic carries `tier: m` and `flow: opsx-apply`, and both `zapply` and `opsx-apply` profiles are declared
- **THEN** the change is priced from the `opsx-apply` profile
- **AND** its Human Estimate is unchanged, because the human table is shared across Flows

#### Scenario: Unknown flow on an epic
- **WHEN** an epic declares a `flow` absent from `flows.profiles` and no runs have been recorded under it
- **THEN** the change is reported unpriced
- **AND** the render succeeds

#### Scenario: Epic without a tier
- **WHEN** an epic carries no `tier`
- **THEN** the change is reported unpriced and its `hours` cell renders `?`
- **AND** it does not count toward its sprint's total
- **AND** the sprint's total renders with a `+?` suffix while any pending change is unpriced

#### Scenario: Hours formatting
- **WHEN** a profile prices one tier at `0.5` hours and another at `2` hours
- **THEN** the `hours` cells render `0.5` and `2` with trailing zeros trimmed
- **AND** the sprint total sums unrounded values and renders formatted the same way

#### Scenario: Sprint total counts pending work only
- **WHEN** a sprint holds three priced changes and one of them is `completed`
- **THEN** the sprint's total equals the sum of the two pending changes' Flow Estimates
- **AND** a sprint whose changes are all satisfied totals zero

#### Scenario: Prices are never stored
- **WHEN** an agent runs `spego board --json` in a priced workspace
- **THEN** no epic, sprint-plan, or OpenSpec file is modified
- **AND** the same inputs produce the same prices on every render

#### Scenario: Observed hours outrank the seed
- **WHEN** this workspace's recorded runs for Flow `zapply` at tier `m` reach the minimum sample count
- **THEN** changes of tier `m` priced under `zapply` carry the median of those runs
- **AND** their rung identifies this workspace's observations as the source

#### Scenario: Sparse evidence falls back
- **WHEN** the recorded runs for a Flow and Tier pair are below the minimum sample count in this workspace and in the cross-project store
- **THEN** changes of that pair are priced from the config seed
- **AND** their rung identifies the seed as the source

#### Scenario: Tiers resolve independently
- **WHEN** one tier has enough recorded runs and another on the same board does not
- **THEN** the first is priced from observation and the second falls further down the ladder
- **AND** each reports its own rung

#### Scenario: Runs do not cross flows
- **WHEN** every recorded run at tier `m` was made under Flow `zapply`
- **THEN** a change priced under Flow `opsx-apply` at tier `m` falls back to that Flow's seed
- **AND** its rung identifies the seed as the source

#### Scenario: Cross-project evidence beats the seed
- **WHEN** the workspace opts into cross-project pricing and has too few runs of its own for a pair
- **AND** the cross-project store holds enough runs for that pair
- **THEN** the pair is priced from the store's median
- **AND** its rung identifies cross-project observations as the source

#### Scenario: Repo evidence outranks cross-project evidence
- **WHEN** both this workspace and the cross-project store hold enough runs for a pair
- **THEN** the pair is priced from this workspace's runs
- **AND** its rung identifies this workspace's observations as the source

#### Scenario: Opting out keeps pricing repo-local
- **WHEN** the workspace does not opt into cross-project pricing
- **THEN** no price resolves from the cross-project store
- **AND** pairs without enough local runs are priced from the config seed

### Requirement: Record flow actuals
The system SHALL provide a `spego record` command that records one measured run against a change: the Flow that ran it and the Flow Hours it took, supplied by the caller rather than measured by spego. Recording SHALL append to the change's epic rather than replace what is already there, so a change delivered across several runs accumulates. The command SHALL persist through the existing artifact write path with optimistic concurrency, SHALL write nothing under `openspec/`, SHALL mutate no artifact other than the named change's epic, and SHALL fail with a named error when the change is unknown, when it has no epic, or when the supplied hours are negative or not finite. Derived output SHALL carry each change's recorded runs and their total alongside its estimates.

#### Scenario: Record a run
- **WHEN** a Flow records 1.75 hours against change `add-auth` under Flow `zapply`
- **THEN** the change's epic carries an entry naming that Flow and those hours
- **AND** `spego board --json` reports the run and a recorded total of 1.75 for the change

#### Scenario: A resumed change accumulates
- **WHEN** a second run of 0.5 hours is recorded against the same change
- **THEN** the epic carries both entries
- **AND** the reported total is 2.25

#### Scenario: Runs keep their flow attribution
- **WHEN** a change carries runs recorded under two different Flows
- **THEN** each entry reports the Flow that produced it
- **AND** the derived change reports both entries unmerged

#### Scenario: Unknown change
- **WHEN** a run is recorded against a change that does not exist, or against a change with no epic
- **THEN** the command fails with an error naming the change
- **AND** no artifact is written

#### Scenario: Invalid hours
- **WHEN** a run is recorded with negative or non-finite hours
- **THEN** the command fails with a validation error naming the value
- **AND** no artifact is written

#### Scenario: Concurrent recording
- **WHEN** two runs are recorded against one change and the second carries a stale expected revision
- **THEN** the second fails with a revision conflict
- **AND** the first run's entry is intact

#### Scenario: Recording touches nothing else
- **WHEN** a run is recorded in a workspace with several epics and sprint-plans
- **THEN** only the named change's epic is modified
- **AND** no file under `openspec/` is written

### Requirement: Correct estimates by observed bias
The system SHALL derive, per Flow and Size Tier, the bias between recorded runs and the prices those runs' changes were carrying, aggregated as a median ratio and recomputed on render rather than stored. Bias SHALL correct prices that are not derived from this workspace's own recorded runs, and SHALL NOT correct a price already taken from them, since correcting an observation by its own residual double-counts the same evidence. The applied correction SHALL be clamped to a fixed bound so that a single pathological run cannot reprice a tier without limit, while the reported bias SHALL remain unclamped. Derived output SHALL carry the bias for each priced change's Flow and Tier pair.

#### Scenario: Seeded price corrected by bias
- **WHEN** recorded runs for Flow `zapply` at tier `m` came in consistently above the price those changes carried
- **AND** the pair is priced from the config seed
- **THEN** the seeded price is raised by the pair's bias
- **AND** the change carries the bias in derived output

#### Scenario: Local observation is not corrected
- **WHEN** a Flow and Tier pair has enough of this workspace's recorded runs to be priced from them
- **THEN** its price is the median of those runs, uncorrected
- **AND** the reported bias for the pair is still derived and carried

#### Scenario: Evidence from elsewhere is corrected
- **WHEN** a pair is priced from any source other than this workspace's recorded runs
- **THEN** its price is corrected by the pair's bias
- **AND** the rung it resolved from is unchanged by the correction

#### Scenario: Correction is clamped
- **WHEN** one recorded run is far enough from its price to push the pair's bias beyond the bound
- **THEN** the applied correction stops at the bound
- **AND** the reported bias carries the unclamped value

#### Scenario: No runs, no bias
- **WHEN** a Flow and Tier pair has no recorded runs
- **THEN** no bias is reported for it
- **AND** its price is the uncorrected seed

#### Scenario: Bias is never stored
- **WHEN** an agent runs `spego board --json` in a workspace with recorded runs
- **THEN** no artifact is modified
- **AND** the same inputs produce the same bias on every render
