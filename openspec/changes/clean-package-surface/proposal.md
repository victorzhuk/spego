## Why

The 0.11.0 review found the package carries surface it does not honor: `main`/`types` point at a barrel (`src/index.ts`) no code or test imports and whose docstring is false; `SUPPORTED_AGENTS` disagrees with both the config schema (free-form) and the generator registry (the actual truth); the retired orchestration feature still leaves a read-compat config shim with no expiry plus empty directories; `src/commands/` collides with `src/cli/commands/`; and warn-level lint rules can never fail CI. Spego is agent-first and CLI-only — the surface should say so.

## What Changes

- **BREAKING** Drop the library surface: remove `main`/`types` from package.json and delete `src/index.ts`; spego is distributed as a CLI (`bin`) only.
- **BREAKING** Retire the legacy `orchestration` config shim: `.spego/config.yaml` containing an `orchestration` block now fails parsing with an error instructing to delete the block (was: silently accepted since 0.11.0).
- Delete `SUPPORTED_AGENTS`/`SupportedAgent`; the generator registry stays the single source of truth for agent targets (unknown names keep warn-and-skip behavior).
- Rename `src/commands/` → `src/command-meta/` to end the collision with `src/cli/commands/`.
- Enforce lint: `eslint src test --max-warnings 0`.
- Remove dead code: `ArtifactEngine.frontmatterFromRecord`; replace duck-typed zod error check with `instanceof z.ZodError`; extract local `formatIndexError` for the duplicated expression in `src/index/indexer.ts`.
- Delete leftover empty dirs `src/orchestration/`, `openspec/specs/ultracode-orchestration/`.

## Capabilities

### Modified Capabilities

- `project-initialization`: legacy `orchestration` config blocks are rejected with a clear error instead of remaining readable.

## Impact

- `package.json`, `eslint.config.js`, `src/index.ts` (deleted), `src/workspace/config.ts`, `src/commands/` → `src/command-meta/` (~6 import sites), `src/artifacts/engine.ts`, `src/artifacts/validation.ts`, `src/index/indexer.ts`.
- Breaking for: programmatic importers of `@zhuk/spego` (none known; barrel has zero internal/test consumers) and workspaces still carrying a 0.10.x `orchestration` block (fixed by deleting the block once).
- Changelog: Removed entries for both breaking items; release as a minor bump (pre-1.0).
