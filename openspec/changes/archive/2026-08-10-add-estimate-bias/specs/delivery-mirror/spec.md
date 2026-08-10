# delivery-mirror Delta Specification

## ADDED Requirements

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

## MODIFIED Requirements

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
