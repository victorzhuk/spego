## ADDED Requirements

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
