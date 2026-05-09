## Why

spego needs a durable artifact system before agents can create PRDs, OKRs, architecture notes, QA plans, and other product documents. The MVP should follow OpenSpec's file-first model: markdown artifacts are the source of truth, while SQLite indexes metadata and revision history.

## What Changes

- Add project initialization for a `.spego/` workspace and markdown artifact directories.
- Add artifact CRUD for supported product artifact types.
- Add markdown-first persistence with optional JSON sidecar/frontmatter metadata.
- Add SQLite indexing for artifact metadata, search, and revisions without making SQLite the primary source of truth.
- Add artifact rendering and export for all artifacts or filtered artifact bundles.
- Add artifact schema validation for agent-safe reads and writes.

## Capabilities

### New Capabilities

- `project-initialization`: Creates and validates the spego workspace layout.
- `artifact-management`: Creates, reads, updates, deletes, and versions markdown-first artifacts.
- `artifact-export`: Renders artifact bundles as markdown or JSON for agents.
- `artifact-validation`: Validates artifact types, metadata, and content shape before persistence.

### Modified Capabilities

None.

## Impact

- Adds the core TypeScript CLI/service surface.
- Adds a file-backed artifact workspace under the project root.
- Adds a local SQLite index/cache for metadata and revisions.
- Establishes the persistence contract used by generated agent skills and delivery adapters.
