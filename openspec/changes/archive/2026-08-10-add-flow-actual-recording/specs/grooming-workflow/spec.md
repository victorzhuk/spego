# grooming-workflow Delta Specification

## MODIFIED Requirements

### Requirement: Groom is the sole writer of mirror state
The groom workflow SHALL be the only writer of judged mirror state — epic judgment fields and structured sprint-plan state — persisting exclusively through `spego create` and `spego update --expected-revision`, and SHALL NOT write under `openspec/` or mutate OpenSpec lifecycle state. Recorded Flow actuals are the one exception: they are measurements supplied by the Flow that delivered a change, neither judged nor derived from the filesystem, and SHALL be written only by the `spego record` command, which SHALL NOT write any other epic field.

#### Scenario: OpenSpec artifacts need changes
- **WHEN** grooming reveals that an OpenSpec change's own artifacts need modification
- **THEN** the workflow directs the user to the matching OpenSpec command
- **AND** does not modify OpenSpec files itself

#### Scenario: Groom does not record actuals
- **WHEN** a grooming session runs against a workspace with recorded actuals
- **THEN** the workflow leaves every recorded run untouched
- **AND** does not ask the user to recall how long a change took

#### Scenario: Recording writes only actuals
- **WHEN** a Flow records a run against a change whose epic also carries judged deps, gaps, and a tier
- **THEN** only the recorded runs change
- **AND** every judged field keeps its value
