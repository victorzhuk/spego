## ADDED Requirements

### Requirement: Generate OpenCode workflow commands
The system SHALL generate OpenCode command files for applying, verifying, and exploring OpenSpec changes when the `opencode` agent target is configured.

#### Scenario: OpenCode commands are generated for configured target
- **WHEN** an agent runs `spego skills` with `opencode` in `.spego/config.yaml` agents
- **THEN** the system writes `.opencode/commands/spego-apply.md`
- **AND** the system writes `.opencode/commands/spego-verify.md`
- **AND** the system writes `.opencode/commands/spego-explore.md`
- **AND** each generated file carries the `spego_generated: true` marker

#### Scenario: OpenCode commands are target-scoped
- **WHEN** an agent runs `spego skills` without `opencode` in the configured agents list
- **THEN** the system does not create OpenCode workflow command files

### Requirement: Keep OpenCode execution inside the active instance
The generated OpenCode workflow commands SHALL instruct the active OpenCode instance to execute or explore the change directly and SHALL NOT shell out to `spego orchestrate`, start `opencode serve`, or call the OpenCode REST API.

#### Scenario: Apply command uses current instance workflow
- **WHEN** `.opencode/commands/spego-apply.md` is generated
- **THEN** its body describes how to select an OpenSpec change, read OpenSpec instructions, implement pending tasks, and update task checkboxes
- **AND** it does not include `spego orchestrate`
- **AND** it does not include `opencode serve`

#### Scenario: Verify command uses current instance workflow
- **WHEN** `.opencode/commands/spego-verify.md` is generated
- **THEN** its body describes how to verify completeness, correctness, and coherence against OpenSpec artifacts
- **AND** it does not include `spego orchestrate`
- **AND** it does not include OpenCode REST API configuration

#### Scenario: Explore command stays read-only for implementation
- **WHEN** `.opencode/commands/spego-explore.md` is generated
- **THEN** its body states that explore mode may read and investigate but MUST NOT implement code
- **AND** it may offer to capture decisions in OpenSpec artifacts when the user asks

### Requirement: Clean up stale generated OpenCode orchestration assets
The system SHALL remove stale generated OpenCode orchestration files that belong to the retired daemon-backed workflow. Cleanup SHALL only remove files carrying the `spego_generated: true` marker.

#### Scenario: Stale generated OpenCode orchestration assets are removed
- **WHEN** an agent runs `spego skills` and stale generated orchestration files exist
- **THEN** the system removes `.opencode/commands/orchestrate.md` if it is spego-generated
- **AND** the system removes `.opencode/agents/ultramanager.md` if it is spego-generated
- **AND** the system removes `.opencode/agents/ultraworker.md` if it is spego-generated
- **AND** the system removes `.opencode/agents/ultraverifier.md` if it is spego-generated
- **AND** the generation report includes the removed paths

#### Scenario: User-owned stale paths are preserved
- **WHEN** an old OpenCode orchestration path exists without the `spego_generated: true` marker
- **THEN** the system does not remove the file
- **AND** the generation report marks that path as skipped
