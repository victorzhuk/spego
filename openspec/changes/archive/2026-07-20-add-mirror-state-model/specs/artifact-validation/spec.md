## ADDED Requirements

### Requirement: Validate epic artifacts
The system SHALL provide an `epic` artifact type whose slug names exactly one OpenSpec change and whose metadata carries `deps` (change names), `links` (artifact ids), `requires` (artifact types), and `gaps` (entries with a `flag` and optional `note`). When the delivery adapter can resolve the workspace, create and update of an epic SHALL fail validation if the slug does not name an active change; when the adapter cannot resolve, the system SHALL proceed and emit a warning.

#### Scenario: Create epic for an existing change
- **WHEN** an agent runs `spego --json create --type epic --title "add-auth"` in a workspace where `openspec/changes/add-auth/` is active
- **THEN** the artifact is created with slug `add-auth`
- **AND** its metadata validates `deps`, `links`, `requires`, and `gaps` shapes

#### Scenario: Epic slug names no active change
- **WHEN** an agent creates an epic whose slug matches no active OpenSpec change
- **THEN** the command fails with a validation error naming the unknown change

#### Scenario: Adapter unavailable
- **WHEN** an agent creates an epic in a workspace without a resolvable `openspec/` directory
- **THEN** the artifact is created
- **AND** a warning on stderr states the change link was not verified

### Requirement: Validate sprint membership
The system SHALL store sprint grouping as an ordered `changes` list in `sprint-plan` metadata and SHALL reject a create or update that places a change into more than one non-closed sprint-plan.

#### Scenario: Structured sprint plan
- **WHEN** an agent creates a sprint-plan with `changes: [add-auth, add-sessions]`
- **THEN** the metadata validates and preserves list order

#### Scenario: Change already sprinted
- **WHEN** a change is listed in an existing non-closed sprint-plan
- **AND** an agent creates or updates another non-closed sprint-plan listing the same change
- **THEN** the command fails with a validation error naming the change and the owning sprint

#### Scenario: Closed sprints do not block
- **WHEN** a change is listed only in a sprint-plan with status `closed`
- **THEN** a new sprint-plan may list that change
