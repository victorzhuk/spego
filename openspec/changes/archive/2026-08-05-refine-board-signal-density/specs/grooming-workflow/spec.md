# grooming-workflow Delta Specification

## MODIFIED Requirements

### Requirement: Groom delivery mirror state
The system SHALL provide a `spego-groom` workflow skill that syncs epic artifacts with active OpenSpec changes, analyzes dependencies, judges required artifacts, flags gaps, and maintains sprint grouping — as a phased session: orient, sync, analyze, plan, summarize. The workflow SHALL orient from `spego board --json` and `spego epics --json` and SHALL address reported drift warnings during sync and plan phases. Mechanical drift — `ungroomed-change`, `closable-sprint`, and archived-reason `orphan-epic` — is repaired deterministically by `spego sync`; groom's confirmation-gated orphan-epic disposition covers only epics that resolve to no OpenSpec change at all.

#### Scenario: Groom an ungroomed workspace
- **WHEN** a user runs the groom workflow in a workspace with active changes and no epics
- **THEN** the workflow creates one epic per active change with judged `deps`, `requires`, links, and gap flags
- **AND** proposes sprint grouping as releasable units, persisting `sprint-plan` artifacts after user confirmation

#### Scenario: Incremental re-groom
- **WHEN** the groom workflow runs in a previously groomed workspace
- **THEN** existing epics are updated in place using `--expected-revision`
- **AND** revisions accumulate instead of artifacts being recreated

#### Scenario: Drift repair
- **WHEN** the mirror reports `orphan-epic`, `ungroomed-change`, or `closable-sprint` warnings
- **THEN** the workflow runs `spego sync` to repair the mechanical subset — missing epics, finished sprints, and epics of archived changes
- **AND** proposes disposition only for epics that resolve to no OpenSpec change, applying it after user confirmation and keeping such epics by default
