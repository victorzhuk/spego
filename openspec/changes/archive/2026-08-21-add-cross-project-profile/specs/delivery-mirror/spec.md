# delivery-mirror Delta Specification

## MODIFIED Requirements

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
