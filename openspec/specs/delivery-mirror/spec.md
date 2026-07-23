# delivery-mirror Specification

## Purpose
TBD - created by archiving change add-mirror-command. Update Purpose after archive.
## Requirements
### Requirement: Derive the delivery mirror
The system SHALL derive the Mirror on demand from read-only inputs — OpenSpec adapter state, epic artifacts, and sprint-plan artifacts — and SHALL NOT store the derived graph or mutate any artifact or OpenSpec file while rendering. Derived state SHALL include per-change status, dependency edges, blockers, gap flags, and missing artifacts computed as `requires` minus resolvable `links`. Each change SHALL also carry a stable `id`, derived only from its own slug (unaffected by other changes being added, removed, or archived), and a `group` marking its parallel-dependency wave, so that two changes sharing a group have no dependency path between them.

#### Scenario: Board from groomed workspace
- **WHEN** an agent runs `spego board --json` in a workspace with epics and sprint-plans
- **THEN** the output lists sprints in sprint order with their changes in list order
- **AND** each change carries status, blockers, gaps, missing artifacts, `id`, and `group`
- **AND** no artifact or OpenSpec file is modified

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
The system SHALL attach drift warnings to every mirror rendering, covering: `dangling-dep`, `dep-cycle`, `out-of-order-dep`, `ungroomed-change`, `orphan-epic`, `archived-in-sprint`, and `closable-sprint`. Dependency cycles SHALL be reported, treated as blocking their members, and SHALL NOT cause non-termination.

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
The system SHALL suggest as next the first pending, unblocked change in the active sprint's list order; when no sprint is active, the first planned sprint in sprint order is used; when nothing is eligible, the system SHALL return no suggestion and hint that grooming is needed.

#### Scenario: Next in active sprint
- **WHEN** the active sprint lists `[a, b, c]`, `a` is done and `b` is blocked
- **THEN** the mirror suggests `c`

#### Scenario: Nothing eligible
- **WHEN** every pending change is blocked
- **THEN** the mirror returns no suggestion
- **AND** the output hints to run the groom workflow

### Requirement: Render focused views
The system SHALL render a default human board and provide `--graph` (dependency edges) and `--gaps` (gap flags and missing artifacts) focus views, honoring the global `--json` flag with a deterministic shape in all modes. Every human view SHALL carry the `id` column. The default board SHALL dim rows for changes with pending blockers, except when `--plain` is passed, the `NO_COLOR` env var is set, or stdout is not a TTY; `--json` output SHALL never carry ANSI codes. Archived changes SHALL be excluded from the `ungrouped` list by default; the `--archived` flag SHALL restore them. This filtering SHALL NOT remove an archived change from a sprint's own `changes` list, so `archived-in-sprint` stays actionable.

#### Scenario: Gap focus
- **WHEN** an agent runs `spego board --gaps --json`
- **THEN** the output is limited to changes with gap flags or missing artifacts, plus warnings

#### Scenario: Plain output suppresses color
- **WHEN** an agent runs `spego board --plain` against a workspace with blocked changes
- **THEN** the rendered rows carry no ANSI escape codes

#### Scenario: Archived changes hidden from ungrouped by default
- **WHEN** an agent runs `spego board` in a workspace with an archived change that is not scheduled into any sprint
- **THEN** that change is absent from the `Ungrouped` list
- **AND** running `spego board --archived` includes it in `Ungrouped` again
- **AND** an archived change still scheduled into a sprint appears in that sprint's list either way

