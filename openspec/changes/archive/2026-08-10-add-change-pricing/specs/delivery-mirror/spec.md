# delivery-mirror Delta Specification

## ADDED Requirements

### Requirement: Price changes and sprints
The system SHALL derive, on render and without storing them, a Flow Estimate and a Human Estimate for every change whose epic carries a `tier` and whose workspace declares a `flows` block. The Flow Estimate SHALL come from the profile of the change's Flow — the epic's `flow` when set, otherwise the workspace default — and the Human Estimate SHALL come from the shared human table. Every priced change SHALL also carry the rung its price came from, so a consumer can tell a declared number from a measured one. Each sprint SHALL carry the total Flow Estimate of its pending changes; changes whose status is `done` or `completed` SHALL NOT count toward that total. A change whose epic declares a Flow absent from `flows.profiles` SHALL be reported unpriced rather than failing the render.

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
- **WHEN** an epic declares a `flow` absent from `flows.profiles`
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

## MODIFIED Requirements

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
