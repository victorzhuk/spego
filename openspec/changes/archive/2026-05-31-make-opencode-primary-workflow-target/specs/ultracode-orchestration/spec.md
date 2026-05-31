## REMOVED Requirements

### Requirement: Orchestrate a change end to end
**Reason**: Spego no longer owns daemon-backed OpenCode orchestration. OpenCode executes apply/verify/explore workflows inside the active instance through generated commands.
**Migration**: Use generated OpenCode commands `/spego-apply`, `/spego-verify`, and `/spego-explore` instead of `spego orchestrate`.

### Requirement: Decompose the requirement into a validated task breakdown
**Reason**: Task decomposition is no longer a Spego CLI runtime service. The active OpenCode agent can plan and execute work directly using OpenSpec instructions.
**Migration**: Use `/spego-apply` in OpenCode and let the active agent read `openspec instructions apply` output.

### Requirement: Schedule sub-tasks with dependency awareness
**Reason**: Spego no longer runs a worker swarm or scheduler.
**Migration**: Use the active OpenCode instance and its configured task/subagent behavior for implementation strategy.

### Requirement: Enforce a per-task file gate
**Reason**: The removed Spego orchestrator no longer owns worker sessions or file gates.
**Migration**: Keep implementation scoped through OpenSpec task context and OpenCode permissions/review.

### Requirement: Verify with the test suite and emit a verdict
**Reason**: Verification is now an OpenCode workflow, not a Spego REST orchestration phase.
**Migration**: Use `/spego-verify` to check completeness, correctness, coherence, and tests before archive.

### Requirement: Configure the orchestration backend
**Reason**: Spego no longer calls OpenCode through `opencode serve` and no longer owns model tier configuration.
**Migration**: Configure models, variants, agents, and permissions in OpenCode configuration.

### Requirement: Keep OpenSpec lifecycle state external
**Reason**: This requirement belonged to the removed orchestration capability. The replacement boundary is covered by generated OpenCode workflow guidance and the read-only delivery adapter.
**Migration**: Continue using OpenSpec commands for lifecycle state and use Spego only for local artifact and read-only delivery views.

### Requirement: Persist run artifacts
**Reason**: Spego no longer runs orchestration sessions that produce manager, worker, or verifier artifacts.
**Migration**: Preserve verification evidence through OpenCode conversation output or spego QA artifacts when needed.
