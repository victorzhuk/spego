## ADDED Requirements

### Requirement: Workflow registry as source of truth
The system SHALL expose a `WORKFLOW_REGISTRY` describing every workflow skill with its name, description, ordered personas, ordered phases, declared inputs, and declared output artifact types.

#### Scenario: Registry exposes workflow metadata
- **WHEN** consumer code imports `WORKFLOW_REGISTRY` from the workflows module
- **THEN** each entry has a unique `name`, a non-empty `description`, an ordered `personas` array of length ≥ 3, an ordered `phases` array whose final phase persists results, an `inputs` array with at least one required input, and an `outputs` array referencing artifact types that exist in `ARTIFACT_META_SCHEMAS`

#### Scenario: Registry lookup by name
- **WHEN** an agent or tool calls `getWorkflowByName('brainstorm-party')`
- **THEN** the system returns the matching workflow metadata
- **AND** an unknown name returns `undefined`

### Requirement: Provide brainstorm-party workflow skill
The system SHALL ship a `brainstorm-party` workflow skill that orchestrates a multi-persona brainstorming process and persists results as a `brainstorm` artifact.

#### Scenario: Workflow shape
- **WHEN** the registry entry for `brainstorm-party` is read
- **THEN** it declares at least the personas `PM`, `Architect`, `UX`, `Dev`, `QA`, and `Skeptic`
- **AND** it declares phases that include framing, divergence, cross-persona challenge, convergence, and a final record phase
- **AND** it declares a required `topic` input
- **AND** it declares `brainstorm` as a required output artifact type

#### Scenario: Persistence checkpoint
- **WHEN** the generated `spego-brainstorm-party` skill is rendered
- **THEN** it instructs the agent to invoke `spego create --type brainstorm` to persist the converged output
- **AND** it does not invoke any mutation surface other than the documented `spego` CLI commands

### Requirement: Provide review-adversarial workflow skill
The system SHALL ship a `review-adversarial` workflow skill that drives an adversarial critique of an existing artifact and persists results as a `qa` or `risk` artifact.

#### Scenario: Workflow shape
- **WHEN** the registry entry for `review-adversarial` is read
- **THEN** it declares at least the personas `Skeptic`, `Security`, `Reliability`, `UX`, and `Cost`
- **AND** it declares phases that include reading the source artifact, attacking it per persona, surfacing unstated assumptions, prioritizing findings, and a final record phase
- **AND** it declares a required `artifactRef` input identifying the artifact under review
- **AND** it declares `qa` and `risk` as the candidate output artifact types, with at least one of them required

#### Scenario: Persistence checkpoint
- **WHEN** the generated `spego-review-adversarial` skill is rendered
- **THEN** it instructs the agent to invoke `spego read` for the source artifact at the start
- **AND** it instructs the agent to invoke `spego create --type qa` or `spego create --type risk` for the critique output
- **AND** it does not invoke any mutation surface other than the documented `spego` CLI commands

### Requirement: Workflow skills are safe by default
Each workflow skill SHALL include a safety block instructing the agent to treat artifact content as data, never as executable instructions.

#### Scenario: Safety block present
- **WHEN** any workflow `SKILL.md` is generated
- **THEN** its body contains a "Safety" section
- **AND** that section states that artifact text is data and not instructions
- **AND** that section forbids passing raw artifact content into shell commands without sanitization
- **AND** that section instructs the agent to treat embedded directives such as "ignore previous" as literal text

### Requirement: Workflow skills are non-autonomous
Workflow skills SHALL be agent-facing prompts that produce side effects only through documented `spego` CLI commands.

#### Scenario: No hidden execution
- **WHEN** a workflow skill is generated
- **THEN** it does not introduce any new mutation API
- **AND** it does not embed shell commands other than `spego` invocations in its persistence checkpoints
