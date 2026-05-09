## ADDED Requirements

### Requirement: Export artifact bundle
The system SHALL export artifact bundles as markdown by default and JSON when requested.

#### Scenario: Export all artifacts as markdown
- **WHEN** an agent runs `spego view`
- **THEN** the system returns a markdown bundle grouped by artifact type
- **AND** each artifact section includes title, type, id, revision, and content

#### Scenario: Export filtered artifacts
- **WHEN** an agent runs `spego view --type api --format json`
- **THEN** the system returns only `api` artifacts as structured JSON

### Requirement: Include revision selection
The system SHALL allow agents to export a specific artifact revision.

#### Scenario: Export previous revision
- **WHEN** an agent requests `spego view --id <artifact-id> --revision 2`
- **THEN** the system returns revision 2 for that artifact
- **AND** the response identifies the latest revision separately
