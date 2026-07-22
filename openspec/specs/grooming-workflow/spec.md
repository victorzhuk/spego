# grooming-workflow Specification

## Purpose
TBD - created by archiving change add-groom-workflow. Update Purpose after archive.
## Requirements
### Requirement: Groom delivery mirror state
The system SHALL provide a `spego-groom` workflow skill that syncs epic artifacts with active OpenSpec changes, analyzes dependencies, judges required artifacts, flags gaps, and maintains sprint grouping — as a phased session: orient, sync, analyze, plan, summarize. The workflow SHALL orient from `spego board --json` and `spego epics --json` and SHALL address reported drift warnings during sync and plan phases.

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
- **THEN** the workflow proposes a repair for each warning
- **AND** applies orphan-epic disposition and sprint closes only after user confirmation, keeping orphan epics by default

### Requirement: Groom is the sole writer of mirror state
The groom workflow SHALL be the only writer of epic and structured sprint-plan state, persisting exclusively through `spego create` and `spego update --expected-revision`, and SHALL NOT write under `openspec/` or mutate OpenSpec lifecycle state.

#### Scenario: OpenSpec artifacts need changes
- **WHEN** grooming reveals that an OpenSpec change's own artifacts need modification
- **THEN** the workflow directs the user to the matching OpenSpec command
- **AND** does not modify OpenSpec files itself

