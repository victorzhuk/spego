# artifact-validation Delta Specification

## MODIFIED Requirements

### Requirement: Validate epic artifacts
The system SHALL provide an `epic` artifact type whose slug names exactly one OpenSpec change and whose metadata carries `deps` (change names), `links` (artifact ids), `requires` (artifact types), `gaps` (entries with a `flag` and optional `note`), and an optional `track` (non-empty string naming the epic's conflict lane). When the delivery adapter can resolve the workspace, create and update of an epic SHALL fail validation if the slug does not name an active change; when the adapter cannot resolve, the system SHALL proceed and emit a warning.

#### Scenario: Create epic for an existing change
- **WHEN** an agent runs `spego --json create --type epic --title "add-auth"` in a workspace where `openspec/changes/add-auth/` is active
- **THEN** the artifact is created with slug `add-auth`
- **AND** its metadata validates `deps`, `links`, `requires`, `gaps`, and `track` shapes

#### Scenario: Epic carries a track
- **WHEN** an agent updates an epic with `meta.track: "storage"`
- **THEN** the update succeeds and the track persists
- **AND** an update with an empty-string `track` fails validation

#### Scenario: Epic slug names no active change
- **WHEN** an agent creates an epic whose slug matches no active OpenSpec change
- **THEN** the command fails with a validation error naming the unknown change

#### Scenario: Adapter unavailable
- **WHEN** an agent creates an epic in a workspace without a resolvable `openspec/` directory
- **THEN** the artifact is created
- **AND** a warning on stderr states the change link was not verified
