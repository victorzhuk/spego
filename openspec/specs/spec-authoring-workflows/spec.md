## ADDED Requirements

### Requirement: Provide help workflow skill
The system SHALL ship a `help` workflow skill that inspects workspace state via the existing read-only CLI commands and recommends the next required and optional steps.

#### Scenario: Workflow shape
- **WHEN** the registry entry for `help` is read
- **THEN** it declares at least the persona `Guide`
- **AND** it declares phases that include inspecting workspace state, synthesizing observations, and recommending next steps
- **AND** it declares an optional `query` input for free-form natural-language questions
- **AND** it declares no required output artifact (the recommendation is delivered in chat)

#### Scenario: Read-only behavior
- **WHEN** the generated `spego-help` skill is rendered
- **THEN** it instructs the agent to call `spego status`, `spego list`, and `spego epics` with `--json`
- **AND** it does not instruct the agent to invoke any mutating CLI command (`create`, `update`, `delete`)
- **AND** it instructs the agent to present recommendations as an ordered list with the recommended skill or command and a one-line rationale

#### Scenario: Recommendation rubric covers every registered workflow
- **WHEN** the generated `spego-help` skill is rendered
- **THEN** its body mentions every other workflow currently present in `WORKFLOW_REGISTRY` at least once
- **AND** its body includes mappings from observable workspace states to specific workflow recommendations

### Requirement: Provide deep brainstorm workflow skill
The system SHALL ship a `brainstorm-deep` workflow skill that drives single-persona, high-volume ideation and persists results as a `brainstorm` artifact.

#### Scenario: Workflow shape
- **WHEN** the registry entry for `brainstorm-deep` is read
- **THEN** it declares exactly one persona (`Ideator`)
- **AND** it declares phases that include framing the topic, expanding ideas, pruning, and a final record phase
- **AND** it declares a required `topic` input
- **AND** it declares an optional `target_count` input with a default of 50
- **AND** it declares an optional `seedArtifactId` input
- **AND** it declares `brainstorm` as a required output artifact type

#### Scenario: Differentiation from party-mode
- **WHEN** the generated `spego-brainstorm-deep` skill is rendered
- **THEN** its body explicitly contrasts itself with `spego-brainstorm-party` in a "When NOT to use" paragraph
- **AND** it instructs the agent to maintain a single voice throughout the workflow

#### Scenario: Persistence checkpoint
- **WHEN** the generated `spego-brainstorm-deep` skill is rendered
- **THEN** its `record` phase instructs the agent to invoke `spego create --type brainstorm`

### Requirement: Provide elicit workflow skill
The system SHALL ship an `elicit` workflow skill that iteratively refines an existing artifact and applies confirmed refinements in place.

#### Scenario: Workflow shape
- **WHEN** the registry entry for `elicit` is read
- **THEN** it declares at least the persona `Refiner`
- **AND** it declares phases that include reading the source artifact, selecting a refinement method, proposing a change, confirming with the user, applying the change, and summarizing
- **AND** it declares a required `artifactRef` input
- **AND** it declares an optional `methods` input whose allowed values are a documented enumeration including at least `clarify`, `sharpen`, `generalize`, `specialize`, and `stress-test`
- **AND** it declares `qa` (summary) and an `update`-kind entry against the source artifact as outputs

#### Scenario: Mandatory optimistic concurrency
- **WHEN** the generated `spego-elicit` skill is rendered
- **THEN** its body instructs the agent to invoke `spego update` with `--expected-revision` for every applied refinement
- **AND** its body forbids invoking `spego update` without `--expected-revision`

#### Scenario: Bounded refinement cycles
- **WHEN** the generated `spego-elicit` skill is rendered
- **THEN** its body documents a maximum number of refinement cycles per session
- **AND** the documented maximum is no greater than five
- **AND** the workflow forces the `summarize` phase once the cap is reached

### Requirement: Output kind discrimination
The workflow registry SHALL distinguish between workflows that create artifacts, workflows that update existing artifacts, and workflows that produce no artifact.

#### Scenario: Output kind exposed on registry entries
- **WHEN** consumer code reads any entry from `WORKFLOW_REGISTRY`
- **THEN** every output declares a `kind` of `create`, `update`, or `none`
- **AND** the default `kind` when unspecified is `create`
- **AND** read-only workflows (such as `help`) declare either no outputs or outputs with `kind: 'none'`
- **AND** mutating workflows (such as `elicit`) declare at least one output with `kind: 'update'`

### Requirement: Authoring loop is documented
The system SHALL document the recommended authoring loop in the README so agents understand how the new workflows compose with the existing ones.

#### Scenario: README authoring loop section
- **WHEN** the README "Workflow Skills" section is rendered
- **THEN** it describes a recommended authoring sequence beginning with `spego-help`
- **AND** the sequence includes a brainstorming step (party or deep)
- **AND** the sequence includes a creation step using `spego create`
- **AND** the sequence includes a refinement step using `spego-elicit`
- **AND** the sequence includes a review step using one or more workflows from the review suite
