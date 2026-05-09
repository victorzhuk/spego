## 1. Project Setup

- [x] 1.1 Create TypeScript project scaffold with CLI entrypoint and test runner.
- [x] 1.2 Add dependencies for markdown/frontmatter parsing, YAML, SQLite, schema validation, and filesystem utilities.
- [x] 1.3 Define `.spego/` workspace layout constants and path resolution helpers.
- [x] 1.4 Implement `spego init` with non-interactive options and idempotent workspace validation.

## 2. Artifact Storage

- [x] 2.1 Define supported artifact types and metadata schema.
- [x] 2.2 Implement markdown artifact read/write with YAML frontmatter.
- [x] 2.3 Implement slug and path generation for `.spego/artifacts/<type>/<slug>.md`.
- [x] 2.4 Add atomic file writes and stale revision conflict checks.
- [x] 2.5 Implement soft delete while preserving revision history.

## 3. Index and Revisions

- [x] 3.1 Create SQLite schema for artifacts, revisions, and index metadata.
- [x] 3.2 Implement index update after successful artifact writes.
- [x] 3.3 Implement revision snapshot storage and retrieval.
- [x] 3.4 Implement index rebuild from markdown files with validation reporting.

## 4. Validation and Rendering

- [x] 4.1 Implement artifact type and frontmatter validation.
- [x] 4.2 Implement create/read/update/delete service methods with structured errors.
- [x] 4.3 Implement markdown bundle rendering for `spego view`.
- [x] 4.4 Implement JSON output mode for artifact reads and exports.

## 5. Tests

- [x] 5.1 Add tests for init, idempotent init, and missing workspace status.
- [x] 5.2 Add tests for artifact CRUD, stale revision rejection, and soft delete.
- [x] 5.3 Add tests for revision retrieval and index rebuild.
- [x] 5.4 Add tests for markdown and JSON export filters.
