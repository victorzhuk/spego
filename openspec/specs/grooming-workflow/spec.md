# grooming-workflow Specification

## Purpose
TBD - created by archiving change add-groom-workflow. Update Purpose after archive.
## Requirements
### Requirement: Groom delivery mirror state
The system SHALL provide a `spego-groom` workflow skill that syncs epic artifacts with active OpenSpec changes, analyzes dependencies, judges required artifacts, flags gaps, assigns conflict tracks, and maintains sprint grouping — as a phased session: orient, sync, analyze, plan, summarize. The workflow SHALL orient from `spego board --json` and `spego epics --json` and SHALL address reported drift warnings during sync and plan phases. During analyze, the workflow SHALL judge each epic's `track` from file/subsystem overlap with the other pending changes — changes expected to conflict share a track; independent changes get distinct tracks — so the board's parallel-safety claims are grounded in judged conflicts, not guesses. Mechanical drift — `ungroomed-change`, `closable-sprint`, and archived-reason `orphan-epic` — is repaired deterministically by `spego sync`; groom's confirmation-gated orphan-epic disposition covers only epics that resolve to no OpenSpec change at all.

#### Scenario: Groom an ungroomed workspace
- **WHEN** a user runs the groom workflow in a workspace with active changes and no epics
- **THEN** the workflow creates one epic per active change with judged `deps`, `requires`, links, gap flags, and `track`
- **AND** proposes sprint grouping as releasable units, persisting `sprint-plan` artifacts after user confirmation

#### Scenario: Tracks reflect judged conflicts
- **WHEN** the analyze phase finds two pending changes that touch the same subsystem
- **THEN** the workflow assigns both epics the same `track`
- **AND** assigns a pending change touching an unrelated subsystem a different `track`

#### Scenario: Incremental re-groom
- **WHEN** the groom workflow runs in a previously groomed workspace
- **THEN** existing epics are updated in place using `--expected-revision`
- **AND** revisions accumulate instead of artifacts being recreated

#### Scenario: Drift repair
- **WHEN** the mirror reports `orphan-epic`, `ungroomed-change`, or `closable-sprint` warnings
- **THEN** the workflow runs `spego sync` to repair the mechanical subset — missing epics, finished sprints, and epics of archived changes
- **AND** proposes disposition only for epics that resolve to no OpenSpec change, applying it after user confirmation and keeping such epics by default

### Requirement: Groom is the sole writer of mirror state
The groom workflow SHALL be the only writer of epic and structured sprint-plan state, persisting exclusively through `spego create` and `spego update --expected-revision`, and SHALL NOT write under `openspec/` or mutate OpenSpec lifecycle state.

#### Scenario: OpenSpec artifacts need changes
- **WHEN** grooming reveals that an OpenSpec change's own artifacts need modification
- **THEN** the workflow directs the user to the matching OpenSpec command
- **AND** does not modify OpenSpec files itself

