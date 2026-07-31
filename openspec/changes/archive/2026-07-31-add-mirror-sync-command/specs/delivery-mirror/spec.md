## ADDED Requirements

### Requirement: Synchronize mirror state
The system SHALL expose a deterministic reconciliation over mirror state: `spego sync` SHALL derive a plan from the same mirror the board computes and apply only the mechanical subset of it — creating an `epic` artifact for every active change that has none (the `ungroomed-change` condition), titled from the change's resolved title, and closing every non-closed sprint whose changes are all satisfied (the `closable-sprint` condition). It SHALL NOT act on judgment-only drift — `orphan-epic` disposition, dependency edges, gaps, `requires`/`links`, or sprint grouping — which it SHALL instead report as remaining. It SHALL NOT write into `openspec/`, and every write SHALL go through the same optimistic-concurrency artifact-engine path (`create`, `update` with an expected revision) already used elsewhere, so a concurrent conflicting write is rejected rather than silently overwritten. A `--dry-run` flag SHALL derive and report the plan without writing anything. Applying the same plan twice SHALL be a no-op the second time.

#### Scenario: Create epic for an ungroomed change
- **WHEN** an agent runs `spego sync` in a workspace with an active OpenSpec change that has no epic artifact
- **THEN** the system creates an `epic` artifact for that change, titled from the change's resolved title
- **AND** the created epic resolves the change's `ungroomed-change` warning on the next board render

#### Scenario: Close a finished sprint
- **WHEN** an agent runs `spego sync` in a workspace with a non-closed sprint whose every change is satisfied
- **THEN** the system sets that sprint-plan's status to `closed`
- **AND** the sprint's `closable-sprint` warning no longer appears on the next board render

#### Scenario: Judgment-only drift is reported, not applied
- **WHEN** an agent runs `spego sync` in a workspace with an `orphan-epic` warning
- **THEN** the system does not delete, retire, or otherwise mutate the orphaned epic
- **AND** the warning is included in the sync output as remaining work

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

## MODIFIED Requirements

### Requirement: Report drift warnings
The system SHALL attach drift warnings to every mirror rendering, covering: `dangling-dep`, `dep-cycle`, `out-of-order-dep`, `ungroomed-change`, `orphan-epic`, `archived-in-sprint`, and `closable-sprint`. Dependency cycles SHALL be reported, treated as blocking their members, and SHALL NOT cause non-termination. `archived-in-sprint` SHALL NOT be reported for a sprint whose status is `closed` — a closed sprint holding archived changes is accurate history, not drift — but SHALL still be reported for an archived change scheduled into a sprint that is not closed.

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
- **THEN** the mirror does not report `archived-in-sprint` for that change

#### Scenario: Archived change in a live sprint is still drift
- **WHEN** a sprint's status is `planned` or `active`
- **AND** the sprint's `changes` list includes an archived change
- **THEN** the mirror reports `archived-in-sprint` for that change
