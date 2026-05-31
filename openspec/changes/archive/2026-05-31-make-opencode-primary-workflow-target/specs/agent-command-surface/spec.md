## ADDED Requirements

### Requirement: Keep public CLI command surface local-only
The public spego CLI command surface SHALL expose local artifact, workspace, delivery-view, metadata, and regeneration commands only. It SHALL NOT expose commands that start or control OpenCode execution through a daemon.

#### Scenario: Orchestrate command is not registered
- **WHEN** an agent invokes `spego commands --json`
- **THEN** the command metadata does not contain an entry named `orchestrate`

#### Scenario: Help excludes orchestrate
- **WHEN** a user invokes `spego --help`
- **THEN** the help output does not list `orchestrate`

#### Scenario: OpenCode workflows are generated commands, not spego CLI commands
- **WHEN** an agent invokes `spego commands --json`
- **THEN** the command metadata does not contain entries named `apply`, `verify`, or `explore`
- **AND** OpenCode apply, verify, and explore behavior is provided through generated `.opencode/commands/spego-*.md` files instead

### Requirement: Keep model selection outside spego command metadata
Spego command metadata and workspace config SHALL NOT define OpenCode model, variant, or reasoning-effort settings for workflow execution. Those runtime choices SHALL remain in OpenCode configuration or the active OpenCode session.

#### Scenario: Workspace config omits OpenCode runtime model tiers
- **WHEN** a new workspace config is written
- **THEN** it does not contain OpenCode orchestration model tier fields such as `manager`, `worker`, `verifier`, or `fallback`

#### Scenario: Generated OpenCode command frontmatter omits model selection
- **WHEN** OpenCode workflow commands are generated
- **THEN** their generated frontmatter does not set `model`
- **AND** their generated frontmatter does not set `agent`
