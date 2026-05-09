## Context

spego starts from a product spec and a BMAD-derived artifact catalog, but the implementation should follow OpenSpec's change/spec model. Artifacts are readable project files first. SQLite accelerates lookup and tracks revisions, but it can be rebuilt from files.

## Goals / Non-Goals

**Goals:**

- Store PRD, OKR, retro, sprint plan, brainstorm, use case, design, API, architecture, ADR, risk, QA, and ceremony artifacts as markdown files.
- Keep artifact metadata machine-readable through frontmatter and an indexed SQLite cache.
- Support deterministic CRUD, revision, validation, and export operations from a local CLI/API.
- Keep outputs markdown-first with JSON available for agents.

**Non-Goals:**

- No hosted service, multi-user auth, or remote sync in the MVP.
- No detailed epic/task implementation ownership; that belongs to the delivery adapter.
- No rich UI beyond generated markdown/JSON views.

## Decisions

### Markdown is the source of truth

Artifacts live under `.spego/artifacts/<type>/<slug>.md`. Each file has YAML frontmatter for `id`, `type`, `title`, `createdAt`, `updatedAt`, `revision`, and `meta`. SQLite mirrors this state for listing, filtering, search, and revision lookup.

Alternative considered: SQLite as source of truth with generated markdown exports. That gives stronger transactional storage but conflicts with the OpenSpec-style file workflow and makes manual review harder.

### Revisions are file snapshots indexed by SQLite

On each write, spego records a revision entry and stores either a snapshot file under `.spego/revisions/` or a content-addressed copy. The latest markdown file remains canonical.

Alternative considered: only use git history. Git is useful, but agents need a tool-level `revision` contract independent of repository state.

### Artifact operations go through one engine

CLI commands call a shared artifact engine that handles path resolution, validation, write semantics, revision recording, index refresh, and rendering. Generated skills and adapters do not write files directly.

Alternative considered: each command owns file handling. That would duplicate validation and make revisions inconsistent.

## Risks / Trade-offs

- File/SQLite drift → provide `spego index rebuild` and update the index after every successful write.
- Concurrent writes → use atomic file writes and SQLite transactions; reject stale revision updates.
- Frontmatter schema drift → validate before write and during index rebuild.
- Large artifacts → keep MVP search metadata-oriented; full-text search can come later.

## Migration Plan

No production migration exists. `spego init` creates `.spego/`, artifact directories, config, and the SQLite index. Existing markdown can be imported by adding valid frontmatter and running index rebuild.

## Open Questions

None for MVP planning.
