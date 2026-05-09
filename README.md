# spego

Agent-first product orchestration: markdown-first artifact engine with SQLite indexing.

## Quick Start

```sh
npm install
npm run build
spego init --agents claude --demo false
```

## Commands

| Command | Description |
|---------|-------------|
| `spego init` | Initialize `.spego/` workspace |
| `spego status` | Report workspace status |
| `spego create --type prd --title "My PRD"` | Create an artifact |
| `spego read --id <uuid>` | Read by id, type+slug, or path |
| `spego update --id <uuid> --body "new content"` | Update with revision control |
| `spego delete --id <uuid>` | Soft-delete (preserves history) |
| `spego list` | List artifacts |
| `spego view` | Export bundle as markdown or JSON |
| `spego commands` | List command metadata (JSON) |
| `spego regenerate` | Regenerate agent skill files |
| `spego epics` | List delivery epics |
| `spego tasks --change <name>` | List tasks for a change |
| `spego index rebuild` | Rebuild SQLite index from files |

All commands accept `--json` for structured output and `--cwd <dir>` to set the project root.

## Architecture

- Markdown files are the source of truth (`.spego/artifacts/<type>/<slug>.md`)
- SQLite indexes metadata and revisions for fast lookup
- Revisions stored as snapshots (`.spego/revisions/<type>/<slug>.r<n>.md`)
- Per-type metadata schemas validated on create/update
- Index is fully rebuildable from markdown files
- Delivery adapters provide read-only epics/tasks views (default: OpenSpec)

## Artifact Types

Built-in: `prd`, `okr`, `retro`, `sprint-plan`, `brainstorm`, `usecases`, `design`, `api`, `architecture`, `decision`, `risk`, `qa`, `ceremony`

Custom types can be registered via workspace config (`extraArtifactTypes`).

## Configuration

Workspace config lives at `.spego/config.yaml`:

```yaml
version: 1
agents:
  - claude
demo: false
extraArtifactTypes: []
deliveryAdapter:
  name: openspec
  options: {}
```

## Generated Files

For Claude agent targets, `spego init` generates:

- `.claude/skills/` — skill definitions for spego commands
- `.claude/commands/spego/` — slash command wrappers

Run `spego regenerate` to update generated files without reinitializing the workspace.

## Development

```sh
npm run typecheck   # type checking
npm run lint        # eslint
npm test            # run tests (vitest)
npm run build       # compile to dist/
```

## Requirements

- Node.js >= 22.14.0 (for `node:sqlite`)
