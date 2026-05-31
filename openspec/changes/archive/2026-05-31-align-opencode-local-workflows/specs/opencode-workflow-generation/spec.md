## MODIFIED Requirements

### Requirement: Keep OpenCode execution inside the active instance
The generated OpenCode workflow commands SHALL instruct the active OpenCode instance to execute or explore the change directly and SHALL NOT shell out to `spego orchestrate`, start `opencode serve`, call the OpenCode REST API, or connect to any OpenCode daemon.

#### Scenario: Apply command uses current instance workflow
- **WHEN** `.opencode/commands/spego-apply.md` is generated
- **THEN** its body describes how to select an OpenSpec change, read OpenSpec instructions, implement pending tasks, and update task checkboxes
- **AND** it does not include `spego orchestrate`
- **AND** it does not include `opencode serve`
- **AND** it does not include OpenCode REST API configuration

#### Scenario: Apply command defines current-session phases
- **WHEN** `.opencode/commands/spego-apply.md` is generated
- **THEN** its body names phases for selecting the change, loading context, planning tasks, executing work, verifying results, updating task checkboxes, and summarizing status
- **AND** its body allows using OpenCode subagents only inside the current OpenCode session when useful for independent investigation, implementation review, or verification
- **AND** its body does not instruct Spego to spawn agents, select models, or create external sessions

#### Scenario: Verify command uses current instance workflow
- **WHEN** `.opencode/commands/spego-verify.md` is generated
- **THEN** its body describes how to verify completeness, correctness, and coherence against OpenSpec artifacts
- **AND** it does not include `spego orchestrate`
- **AND** it does not include OpenCode REST API configuration
- **AND** it does not instruct OpenCode to connect to a daemon

#### Scenario: Explore command stays read-only for implementation
- **WHEN** `.opencode/commands/spego-explore.md` is generated
- **THEN** its body states that explore mode may read and investigate but MUST NOT implement code
- **AND** it may offer to capture decisions in OpenSpec artifacts when the user asks
- **AND** it does not instruct OpenCode to connect to a daemon

## ADDED Requirements

### Requirement: Generated OpenCode workflows use OpenCode-native wording
The generated OpenCode workflow commands SHALL use OpenCode-native or tool-neutral wording for user prompts, task tracking, skills, and subagents.

#### Scenario: Generated commands avoid Claude-specific tool names
- **WHEN** `.opencode/commands/spego-apply.md`, `.opencode/commands/spego-verify.md`, or `.opencode/commands/spego-explore.md` is generated
- **THEN** the body does not contain `AskUserQuestion tool`
- **AND** the body does not contain `TodoWrite tool`
- **AND** the body does not contain `subagent_type: "general-purpose"`
- **AND** the body does not contain `Skill tool`

### Requirement: Build output remains free of retired OpenCode daemon assets
The build process SHALL remove stale compiled output before emitting `dist` so removed daemon-backed orchestration modules cannot be packed or executed.

#### Scenario: Clean build removes stale orchestration output
- **WHEN** stale files exist under `dist/orchestration/` or `dist/cli/commands/orchestrate.*`
- **AND** the user runs the project build command
- **THEN** the resulting `dist` tree does not contain the stale orchestration directory
- **AND** the resulting `dist` tree does not contain `dist/cli/commands/orchestrate.js`
- **AND** the package dry-run does not list stale OpenCode daemon orchestration files
