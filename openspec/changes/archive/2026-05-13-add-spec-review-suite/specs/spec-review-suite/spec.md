## ADDED Requirements

### Requirement: Provide edge-case review workflow skill
The system SHALL ship a `review-edge-cases` workflow skill that mechanically enumerates branching paths in a source artifact and reports only unhandled paths.

#### Scenario: Workflow shape
- **WHEN** the registry entry for `review-edge-cases` is read
- **THEN** it declares at least the personas `Path-tracer`, `Boundary-checker`, and `Concurrency-skeptic`
- **AND** it declares phases that include reading the source artifact, enumerating paths, deriving edge classes, filtering already-handled cases, and a final record phase
- **AND** it declares a required `artifactRef` input identifying the source artifact
- **AND** it declares an optional `also_consider` input
- **AND** it declares `qa` as a required output artifact type

#### Scenario: Output format
- **WHEN** the generated `spego-review-edge-cases` skill is rendered
- **THEN** it instructs the agent to write the `qa` artifact body containing a fenced JSON block
- **AND** the JSON is an array of findings each with `location`, `trigger_condition`, `guard_snippet`, and `potential_consequence` fields
- **AND** the skill instructs the agent to silently discard handled cases and report only unhandled ones

### Requirement: Provide prose editorial review workflow skill
The system SHALL ship an `editorial-prose` workflow skill that performs a clinical copy-edit pass on a source artifact and may apply confirmed edits in place.

#### Scenario: Workflow shape
- **WHEN** the registry entry for `editorial-prose` is read
- **THEN** it declares at least the persona `Copy-editor`
- **AND** it declares phases that include reading the source artifact, performing a clarity pass, deciding apply-or-recommend per edit, and a final record phase
- **AND** it declares a required `artifactRef` input
- **AND** it declares optional `target_audience` and `reader_type` inputs
- **AND** it declares `qa` as a required output artifact type
- **AND** it permits `update` of the source artifact as a secondary output

#### Scenario: Safe in-place mutation
- **WHEN** the generated `spego-editorial-prose` skill is rendered
- **THEN** it instructs the agent to confirm each edit before applying it
- **AND** it instructs the agent to invoke `spego update` with `--expected-revision` whenever it applies an edit
- **AND** it instructs the agent to record both applied and recommended-only edits in a single `qa` summary artifact

### Requirement: Provide structural editorial review workflow skill
The system SHALL ship an `editorial-structure` workflow skill that proposes restructuring of a source artifact without mutating it.

#### Scenario: Workflow shape
- **WHEN** the registry entry for `editorial-structure` is read
- **THEN** it declares at least the persona `Structural editor`
- **AND** it declares phases that include reading the source artifact, outlining its current structure, proposing restructuring, prioritizing recommendations, and a final record phase
- **AND** it declares a required `artifactRef` input
- **AND** it declares optional `purpose`, `target_audience`, and `length_target` inputs
- **AND** it declares `qa` as a required output artifact type

#### Scenario: No source mutation
- **WHEN** the generated `spego-editorial-structure` skill is rendered
- **THEN** it explicitly states that the workflow does not mutate the source artifact
- **AND** it does not instruct the agent to invoke `spego update` against the source

### Requirement: Reviewers complement, not replace, adversarial review
The system SHALL document the review suite so agents understand when to combine reviewers for orthogonal coverage.

#### Scenario: Combined coverage guidance
- **WHEN** the README "Workflow Skills" section is rendered
- **THEN** it states that `spego-review-adversarial` and `spego-review-edge-cases` are complementary (attitude-driven and method-driven respectively)
- **AND** it states that `spego-editorial-prose` and `spego-editorial-structure` cover communication defects that the technical reviewers do not catch
- **AND** it recommends running at least one technical reviewer and at least one editorial reviewer before declaring an artifact ready
