# project-initialization Delta Specification

## MODIFIED Requirements

### Requirement: Configure flow profiles
Workspace config SHALL support an optional `flows` block declaring how Size Tiers are priced: `default` naming the Flow that prices changes with no per-epic override, `profiles` mapping each declared Flow name to a seed table of Flow Hours per Size Tier, `human` mapping each Size Tier to Human Hours once, shared across every Flow, and an opt-in flag enabling the cross-project rung, defaulting to disabled. The Size Tier scale SHALL be fixed at `xs`, `s`, `m`, `l`, `xl` and SHALL NOT be configurable. Config parsing SHALL reject a `default` that names no declared profile, a profile or human table missing a tier or declaring an unknown one, and any hours value that is negative or not finite. A workspace with no `flows` block SHALL remain valid and SHALL price nothing. The root of the cross-project store SHALL resolve from an environment override before falling back to the user's configuration directory, so that a run can be made hermetic without touching workspace config.

#### Scenario: Valid flows block
- **WHEN** `.spego/config.yaml` declares `flows.default: zapply`, a `zapply` profile covering all five tiers, and a `human` table covering all five tiers
- **THEN** config parsing succeeds
- **AND** the resolved configuration exposes the default Flow, the profile, and the human table

#### Scenario: Default names no profile
- **WHEN** `flows.default` names a Flow absent from `flows.profiles`
- **THEN** config parsing fails with a validation error naming the missing profile

#### Scenario: Incomplete tier table
- **WHEN** a declared profile omits a tier of the fixed scale, or declares a tier outside it
- **THEN** config parsing fails with a validation error naming the offending tier

#### Scenario: Invalid hours value
- **WHEN** a profile or the human table declares a negative or non-finite hours value
- **THEN** config parsing fails with a validation error naming the offending entry

#### Scenario: Workspace without flows
- **WHEN** `.spego/config.yaml` declares no `flows` block
- **THEN** config parsing succeeds
- **AND** no change carries a Flow Estimate or a Human Estimate

#### Scenario: Cross-project pricing defaults to off
- **WHEN** a `flows` block declares no opt-in flag
- **THEN** config parsing succeeds
- **AND** the resolved configuration reports cross-project pricing as disabled

#### Scenario: Store root honors the override
- **WHEN** the environment names a store root
- **THEN** the cross-project store resolves under it
- **AND** the user's configuration directory is not read
