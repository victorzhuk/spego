## Why

Spego should remain a local CLI and artifact/OpenSpec context layer, while OpenCode owns execution inside the active agent session. Current source mostly reflects that boundary, but generated OpenCode workflows and stale local/generated assets still leave ambiguity around daemon-backed orchestration, Claude-style tool names, and package residue.

## What Changes

- Strengthen generated OpenCode workflow commands so `/spego-apply`, `/spego-verify`, and `/spego-explore` explicitly run inside the active OpenCode instance.
- Expand `/spego-apply` into named phases that may use OpenCode subagents inside the current session, without starting or connecting to any daemon.
- Remove or migrate stale OpenCode `opsx-*`, `openspec-*`, and ultra-agent generated assets only when they are Spego-generated or repository-owned compatibility assets.
- Clean build output before compiling so stale daemon-backed orchestration files cannot remain in `dist` or be packed.
- Update docs/tests to preserve the local-only Spego API boundary and prevent regressions.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `opencode-workflow-generation`: Generated OpenCode workflows must describe current-session phases/subagents and continue to forbid daemon/API orchestration.
- `agent-skill-generation`: Regeneration must remove or update stale OpenCode assets that no longer match the Spego-local/OpenCode-current-session boundary.

## Impact

- `src/generator/opencode.ts`
- generated `.opencode/commands/spego-*.md`
- generated or repository-owned stale `.opencode/commands/opsx-*` and `.opencode/skills/openspec-*` assets
- build script/package output hygiene for `dist/`
- tests covering generated OpenCode command content, stale asset cleanup, and packaged output safety
