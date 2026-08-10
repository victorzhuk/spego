## Purpose
Define validation for artifact types and content, plus resilient index rebuilding for invalid files.
## Requirements
### Requirement: Validate artifact type
The system SHALL accept only supported artifact types unless configuration explicitly registers an extension type.

#### Scenario: Supported type
- **WHEN** an agent creates an artifact with type `architecture`
- **THEN** the system accepts the type and applies the architecture artifact schema

#### Scenario: Unsupported type
- **WHEN** an agent creates an artifact with type `roadmap`
- **THEN** the system rejects the request unless `roadmap` is registered in config

### Requirement: Validate frontmatter and content
The system SHALL validate required metadata and content before writing an artifact.

#### Scenario: Missing title
- **WHEN** an agent creates an artifact without a title
- **THEN** the system rejects the request with a validation error for `title`

#### Scenario: Invalid metadata
- **WHEN** an agent provides metadata that does not match the artifact schema
- **THEN** the system rejects the request before writing any file

### Requirement: Rebuild index from files
The system SHALL rebuild the SQLite index from markdown files and report invalid artifacts.

#### Scenario: Rebuild valid workspace
- **WHEN** an agent runs index rebuild in a valid workspace
- **THEN** the system indexes all valid artifacts and revisions

#### Scenario: Rebuild with invalid artifact
- **WHEN** an artifact file has invalid frontmatter
- **THEN** the system reports the file path and validation errors
- **AND** it continues indexing other valid artifacts

### Requirement: Validate epic artifacts
The system SHALL provide an `epic` artifact type whose slug names exactly one OpenSpec change and whose metadata carries `deps` (change names), `links` (artifact ids), `requires` (artifact types), `gaps` (entries with a `flag` and optional `note`), an optional `track` (non-empty string naming the epic's conflict lane), an optional `tier` (the change's Size Tier, one of `xs`, `s`, `m`, `l`, `xl`), and an optional `flow` (non-empty string naming the Flow whose profile prices the change, overriding the workspace default). When the delivery adapter can resolve the workspace, create and update of an epic SHALL fail validation if the slug does not name an active change; when the adapter cannot resolve, the system SHALL proceed and emit a warning.

#### Scenario: Create epic for an existing change
- **WHEN** an agent runs `spego --json create --type epic --title "add-auth"` in a workspace where `openspec/changes/add-auth/` is active
- **THEN** the artifact is created with slug `add-auth`
- **AND** its metadata validates `deps`, `links`, `requires`, `gaps`, `track`, `tier`, and `flow` shapes

#### Scenario: Epic carries a track
- **WHEN** an agent updates an epic with `meta.track: "storage"`
- **THEN** the update succeeds and the track persists
- **AND** an update with an empty-string `track` fails validation

#### Scenario: Epic carries a size tier
- **WHEN** an agent updates an epic with `meta.tier: "m"`
- **THEN** the update succeeds and the tier persists
- **AND** an update with a tier outside `xs`, `s`, `m`, `l`, `xl` fails validation naming the accepted values

#### Scenario: Epic overrides its flow
- **WHEN** an agent updates an epic with `meta.flow: "opsx-apply"`
- **THEN** the update succeeds and the flow name persists
- **AND** an update with an empty-string `flow` fails validation

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

