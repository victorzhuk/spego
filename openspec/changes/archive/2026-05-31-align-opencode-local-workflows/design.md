## Context

Spego has already moved away from daemon-backed OpenCode orchestration in source: the public CLI no longer registers `spego orchestrate`, `src/orchestration/` has been removed, and new workspace config no longer writes server/model orchestration settings. The remaining work is boundary hardening: generated OpenCode commands should clearly run inside the active OpenCode instance, stale local command/skill assets should not teach the old or Claude-specific workflow, and builds should not package stale daemon files left in `dist`.

## Goals / Non-Goals

**Goals:**

- Make `/spego-apply`, `/spego-verify`, and `/spego-explore` explicitly current-session OpenCode workflows.
- Make `/spego-apply` define phases and allow OpenCode-native subagents inside the same OpenCode session.
- Remove daemon/REST/orchestrate terminology from current generated assets and repository-owned OpenCode compatibility assets.
- Ensure clean builds cannot leave removed orchestration output in the published `dist/` package.
- Add regression tests around generated content and package/build output.

**Non-Goals:**

- Reintroducing a Spego-owned OpenCode daemon, REST client, or execution service.
- Adding `spego apply`, `spego verify`, or `spego explore` CLI commands.
- Changing the OpenSpec CLI contract or OpenCode runtime configuration.
- Removing legacy config parsing for already-initialized workspaces.

## Decisions

1. Keep commands as static OpenCode workflow prompts.

   The OpenCode generator should continue writing `.opencode/commands/spego-*.md` as plain command prompts. This keeps Spego a local file/CLI generator and avoids a runtime plugin, MCP server, or daemon. The command bodies will carry the orchestration logic as instructions for the active OpenCode instance.

2. Model phases in prompt text, not Spego runtime code.

   `/spego-apply` will describe phases such as select, load context, plan, execute, verify, mark tasks, and summarize. Where parallelism helps, the prompt can instruct OpenCode to use current-session subagents for independent investigation or review. Spego will not spawn processes or choose models.

3. Treat stale OpenCode assets as generated cleanup targets only when safe.

   The generator can remove known stale paths when files carry `spego_generated: true` or are repository-owned compatibility assets. User-owned files without a Spego marker must be preserved and reported as skipped.

4. Clean `dist` before TypeScript builds.

   TypeScript does not remove output files whose source files were deleted. A pre-build clean prevents stale `dist/orchestration` and `dist/cli/commands/orchestrate.*` files from being included by `npm pack`.

## Risks / Trade-offs

- [Risk] Removing stale `.opencode` assets can surprise users who customized generated files. Mitigation: only remove marked generated files by default; preserve unmarked user files.
- [Risk] Prompt-only phase orchestration is less enforceable than runtime code. Mitigation: add tests that assert generated command text includes required guardrails and phase language.
- [Risk] Build-clean changes may delete local build artifacts unexpectedly. Mitigation: only clean `dist`, which is already ignored and generated.

## Migration Plan

1. Update generator templates and cleanup paths.
2. Regenerate current repository OpenCode assets with `spego skills` after implementation.
3. Add tests for generated prompt content, cleanup behavior, and stale build output removal.
4. Run strict OpenSpec validation plus project lint/typecheck/test/build/package dry-run.

Rollback is limited to reverting generated prompt and build-script changes. No persisted artifact schema migration is required.

## Open Questions

None.
