## Why

spego is agent-first, so its user-facing surface is generated skills and slash commands rather than an interactive app. Generated skills should be thin, inspectable wrappers that call spego for structured instructions and artifact operations.

## What Changes

- Add target-agent configuration during `spego init`.
- Generate skill and command files for supported agents, starting with Claude Code and leaving adapters for Cursor and other tools.
- Expose `/spego:*` commands for artifact operations, project views, and bootstrap tasks.
- Make generated skills non-interactive after init; inputs are explicit JSON, markdown fragments, or command arguments.
- Return markdown by default and JSON when requested.
- Keep generated files deterministic so agents can diff and regenerate them safely.

## Capabilities

### New Capabilities

- `agent-skill-generation`: Generates agent-specific skill and command files from spego capability metadata.
- `agent-command-surface`: Defines the `/spego:*` command behavior, inputs, and outputs.

### Modified Capabilities

None.

## Impact

- Adds skill manifest templates and target-agent generators.
- Adds CLI/API commands consumed by generated skills.
- Depends on the core artifact engine for artifact reads, writes, rendering, and validation.
