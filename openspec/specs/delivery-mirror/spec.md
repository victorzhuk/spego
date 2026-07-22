# delivery-mirror Specification

## Purpose
TBD - created by archiving change add-mirror-command. Update Purpose after archive.
## Requirements
### Requirement: Derive the delivery mirror
The system SHALL derive the Mirror on demand from read-only inputs — OpenSpec adapter state, epic artifacts, and sprint-plan artifacts — and SHALL NOT store the derived graph or mutate any artifact or OpenSpec file while rendering. Derived state SHALL include per-change status, dependency edges, blockers, gap flags, and missing artifacts computed as `requires` minus resolvable `links`.

#### Scenario: Board from groomed workspace
- **WHEN** an agent runs `spego board --json` in a workspace with epics and sprint-plans
- **THEN** the output lists sprints in sprint order with their changes in list order
- **AND** each change carries status, blockers, gaps, and missing artifacts
- **AND** no artifact or OpenSpec file is modified

#### Scenario: Blocked change
- **WHEN** change X's epic declares a dep on change D
- **AND** D is not completed and is not scheduled in the same or an earlier sprint than X
- **THEN** X is reported blocked by D

#### Scenario: Empty mirror state
- **WHEN** an agent runs `spego board` in a workspace with active changes but no epic artifacts
- **THEN** the command succeeds with the adapter-only view
- **AND** each active change is flagged `ungroomed-change`

### Requirement: Report drift warnings
The system SHALL attach drift warnings to every mirror rendering, covering: `dangling-dep`, `dep-cycle`, `ungroomed-change`, `orphan-epic`, `archived-in-sprint`, and `closable-sprint`. Dependency cycles SHALL be reported, treated as blocking their members, and SHALL NOT cause non-termination.

#### Scenario: Orphan epic after archive
- **WHEN** an epic's change has been archived in OpenSpec
- **THEN** the mirror reports `orphan-epic` for that epic and notes the change is archived

#### Scenario: Closable sprint
- **WHEN** every change of a non-closed sprint-plan is completed or archived
- **THEN** the mirror reports `closable-sprint` for that sprint

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
The system SHALL render a default human board and provide `--graph` (dependency edges) and `--gaps` (gap flags and missing artifacts) focus views, honoring the global `--json` flag with a deterministic shape in all modes.

#### Scenario: Gap focus
- **WHEN** an agent runs `spego board --gaps --json`
- **THEN** the output is limited to changes with gap flags or missing artifacts, plus warnings

