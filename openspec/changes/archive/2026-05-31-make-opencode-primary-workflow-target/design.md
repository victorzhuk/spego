## Context

Spego currently has two separate ideas mixed together: local artifact/OpenSpec context commands, and a daemon-backed OpenCode orchestration pipeline exposed as `spego orchestrate`. The desired boundary is simpler: spego provides local state, generated guidance, and read-only OpenSpec context; OpenCode runs apply, verify, and explore workflows inside the active OpenCode instance.

OpenCode discovers markdown commands and agents from `.opencode/commands` and `.opencode/agents` through its config load. That makes generated static command files the stable integration point. Runtime-created command or agent files are not a reliable way to influence the current running instance.

## Goals / Non-Goals

**Goals:**
- Treat `opencode` as a first-class generator target.
- Add `opencode` to this workspace's `.spego/config.yaml` agent list.
- Generate static OpenCode commands named `spego-apply`, `spego-verify`, and `spego-explore`.
- Remove the public daemon-backed `spego orchestrate` command and stop generating its OpenCode assets.
- Keep legacy config files readable if they still contain an `orchestration` block.
- Keep model, variant, and runtime behavior in OpenCode config, not in spego config.

**Non-Goals:**
- Do not generate or depend on runtime-created OpenCode agents.
- Do not add `spego apply`, `spego verify`, or `spego explore` CLI commands.
- Do not control OpenCode through `opencode serve` or the OpenCode REST API.
- Do not mutate OpenSpec lifecycle state through `spego epics` or `spego tasks`.

## Decisions

1. **Use a new `OpencodeGenerator` registered as target `opencode`.**
   This keeps target generation symmetric with `ClaudeGenerator` and makes `spego skills` respect the configured `agents` list instead of emitting OpenCode assets unconditionally.

2. **Generate static OpenCode command files only.**
   Commands go under `.opencode/commands/spego-apply.md`, `.opencode/commands/spego-verify.md`, and `.opencode/commands/spego-explore.md`. Their frontmatter should use OpenCode-supported fields such as `description`; model and agent selection stay in OpenCode config or the user's active session.

3. **Remove REST orchestration from the public API.**
   `spego orchestrate` is removed from `src/cli.ts`, `COMMAND_REGISTRY`, README, generated Claude skills/commands, and public exports. The old `src/orchestration/` implementation can be deleted if no remaining source imports it.

4. **Clean up generated stale assets, never user-owned files.**
   Generator cleanup should remove only files marked with `spego_generated: true`. User-authored files at old paths are reported as skipped and preserved.

5. **Accept but ignore legacy `orchestration` config.**
   New default config output omits the orchestration block. The schema remains tolerant of old files so existing workspaces do not fail validation only because they contain stale config.

## Risks / Trade-offs

- [Risk] Removing `spego orchestrate` is breaking for users relying on the old daemon path. Mitigation: document the replacement OpenCode commands and remove generated stale wrappers so users do not keep invoking a dead path.
- [Risk] OpenCode command semantics can change. Mitigation: keep generated command frontmatter minimal and rely on documented markdown command discovery.
- [Risk] Cleanup could remove user customization. Mitigation: only remove files with the spego-generated marker.
- [Risk] Existing tests are anchored to orchestration. Mitigation: replace them with generator, config, and command-surface tests that assert the new boundary.

## Migration Plan

1. Add `opencode` to `.spego/config.yaml` for this repository.
2. Add and register `OpencodeGenerator`.
3. Stop unconditional OpenCode asset emission from init and skills regeneration.
4. Remove the public orchestrate CLI/registry/API exports and tests.
5. Add cleanup for old generated orchestration assets.
6. Update documentation and OpenSpec specs.
7. Run strict OpenSpec validation and project tests.

## Open Questions

None. The implementation should remove `spego orchestrate` immediately rather than keeping a hidden stub, because the desired architecture explicitly excludes Spego-owned daemon orchestration.
