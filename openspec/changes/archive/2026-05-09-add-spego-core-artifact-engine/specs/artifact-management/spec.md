## ADDED Requirements

### Requirement: Create artifact
The system SHALL create a markdown artifact for a supported artifact type with validated frontmatter and content.

#### Scenario: Create PRD artifact
- **WHEN** an agent creates a `prd` artifact with a title and markdown body
- **THEN** the system writes `.spego/artifacts/prd/<slug>.md`
- **AND** the response includes the artifact id, type, path, revision, and rendered markdown

### Requirement: Read artifact
The system SHALL read the latest artifact revision by id, type, or path.

#### Scenario: Read latest artifact
- **WHEN** an agent requests an existing artifact by id
- **THEN** the system returns the latest markdown content and metadata

#### Scenario: Read missing artifact
- **WHEN** an agent requests an artifact that does not exist
- **THEN** the system returns a not-found error with the lookup key

### Requirement: Update artifact with revision control
The system SHALL update an artifact only after validating the requested mutation and recording a new revision.

#### Scenario: Update with markdown body
- **WHEN** an agent updates an existing artifact with a markdown body
- **THEN** the system writes the new content atomically
- **AND** the revision number increments
- **AND** the previous content remains available by revision

#### Scenario: Stale revision update
- **WHEN** an agent updates an artifact using an outdated expected revision
- **THEN** the system rejects the update with a revision-conflict error

### Requirement: Delete artifact without losing history
The system SHALL mark deleted artifacts as deleted while preserving revision history.

#### Scenario: Delete artifact
- **WHEN** an agent deletes an artifact
- **THEN** the latest artifact listing excludes it by default
- **AND** revision history remains readable with an explicit include-deleted option
