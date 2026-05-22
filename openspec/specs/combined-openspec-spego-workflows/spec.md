## ADDED Requirements

### Requirement: Provide combined OpenSpec and spego workflow guidance
The system SHALL document and expose agent workflow guidance for using OpenSpec change state together with spego artifacts.

#### Scenario: Explain ownership boundary
- **WHEN** an agent presents combined OpenSpec and spego workflow guidance
- **THEN** it states that OpenSpec owns change execution and lifecycle state
- **AND** it states that spego owns durable product-thinking artifacts
- **AND** it states that the spego delivery adapter is read-only

#### Scenario: Recommend combined workflow lanes
- **WHEN** documentation describes combined OpenSpec and spego usage
- **THEN** it groups guidance into before-implementation, during-implementation, and after-implementation lanes
- **AND** each lane includes at least one OpenSpec action and one spego artifact action

### Requirement: Brainstorm around an OpenSpec change
The system SHALL provide a workflow that uses an existing OpenSpec change as context for a spego brainstorm artifact.

#### Scenario: Change brainstorm creates spego artifact
- **WHEN** a user asks to brainstorm around an OpenSpec change
- **THEN** the workflow reads the change summary and task state
- **AND** it reads relevant OpenSpec artifacts when available
- **AND** it persists the brainstorm output as a `brainstorm` artifact through `spego create`
- **AND** it does not mutate the OpenSpec change

### Requirement: Review an OpenSpec change into spego QA or risk artifacts
The system SHALL provide a workflow that reviews an OpenSpec change and persists findings as spego artifacts.

#### Scenario: Change review persists findings
- **WHEN** a user asks to review an OpenSpec change
- **THEN** the workflow reviews proposal, specs, design, and tasks when available
- **AND** it persists quality findings as a `qa` artifact or risk findings as a `risk` artifact
- **AND** it recommends OPSX/OpenSpec updates when change artifacts need mutation

### Requirement: Capture OpenSpec verification as spego QA
The system SHALL provide a workflow for persisting completed OpenSpec verification findings as a spego QA artifact.

#### Scenario: Verification report is durable
- **WHEN** a user verifies an OpenSpec change before archive
- **THEN** the workflow can persist completeness, correctness, and coherence findings as a `qa` artifact
- **AND** it keeps OpenSpec task completion and archive decisions in OpenSpec

### Requirement: Capture completed change retrospectives
The system SHALL provide a workflow for creating a spego retrospective from a completed or archived OpenSpec change.

#### Scenario: Change retro summarizes outcome
- **WHEN** an OpenSpec change is complete or archived
- **THEN** the workflow can create a `retro` artifact summarizing what changed, what worked, what failed, and follow-up actions
- **AND** it includes the OpenSpec change name as traceable context
- **AND** it can read archived change artifacts directly when the change is no longer visible through `spego epics`

### Requirement: Recommend combined flows from workspace help
The system SHALL update help recommendations to account for active OpenSpec changes.

#### Scenario: Active OpenSpec change exists
- **WHEN** `spego-help` observes active epics from the OpenSpec delivery adapter
- **THEN** it can recommend combined change workflows before recommending unrelated artifact creation
- **AND** it preserves the existing artifact-centric recommendations when no active changes exist
