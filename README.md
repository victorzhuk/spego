# spego

Agent-first product orchestration: markdown-first artifact engine with SQLite indexing.

## Quick start

```sh
npm install --global @zhuk/spego
spego init --agents claude,opencode --demo false
```

## Commands

| Command | Purpose |
|---------|---------|
| `spego init` / `status` | Initialize a workspace, report its state |
| `spego create` / `read` / `update` / `delete` / `list` / `view` | Artifact CRUD with revision control |
| `spego epics` / `tasks` / `sprints` / `board` | Read the delivery mirror |
| `spego sync` / `record` | Reconcile the mirror; record a measured run |
| `spego commands` / `workflows` / `skills` | Inspect metadata, regenerate agent files |
| `spego index rebuild` | Rebuild the SQLite index from files |

Every command takes `--cwd <dir>` and speaks two output modes: human-readable by default, deterministic JSON under `--json`. Agents calling spego MUST pass `--json`.

Full reference: [docs/cli.md](docs/cli.md).

## Architecture

- Markdown files are the source of truth (`.spego/artifacts/<type>/<slug>.md`)
- SQLite indexes metadata and revisions for fast lookup
- Revisions stored as snapshots (`.spego/revisions/<type>/<slug>.r<n>.md`)
- Per-type metadata schemas validated on create and update
- The index is fully rebuildable from markdown files
- Delivery adapters provide read-only epics and tasks views (default: OpenSpec)

## Artifact types

Built-in: `prd`, `epic`, `okr`, `retro`, `sprint-plan`, `brainstorm`, `usecases`, `design`, `api`, `architecture`, `decision`, `risk`, `qa`, `ceremony`.

- `epic` mirrors an OpenSpec change. Its optional meta supports `deps`, `links`, `requires`, `gaps`, `status`, `track`, `tier`, `flow`, and `actuals`.
- `sprint-plan` may include ordered `changes`; a change belongs to at most one non-closed sprint-plan.

Custom types register through workspace config (`extraArtifactTypes`).

## Configuration

Workspace config lives at `.spego/config.yaml`:

```yaml
version: 1
agents:
  - claude
  - opencode
demo: false
extraArtifactTypes: []
deliveryAdapter:
  name: openspec
  options: {}
```

An optional `flows` block turns on hour estimates — see [docs/estimation.md](docs/estimation.md).

## Workflow Skills

Workflow skills guide an agent through a multi-persona process in chat, persisting results as spego artifacts: `brainstorm-party`, `brainstorm-deep`, `review-adversarial`, `review-edge-cases`, `editorial-prose`, `editorial-structure`, `elicit`, `groom`, and `help`. Each one is described in [docs/workflows.md](docs/workflows.md).

The recommended authoring loop:

1. **Orient** — `spego-help` for workspace state and recommendations.
2. **Ideate** — `spego-brainstorm-party` for breadth, or `spego-brainstorm-deep` for volume.
3. **Capture** — `spego create --type prd` (or `architecture`, `design`, …) to persist the output.
4. **Refine** — `spego-elicit` to improve the draft with structured methods.
5. **Review** — `spego-review-adversarial` and `spego-review-edge-cases` for technical coverage, `spego-editorial-prose` / `spego-editorial-structure` for communication quality.

Reviewers complement rather than replace each other. `spego-review-adversarial` is attitude-driven, hunting gaps and weak assumptions; `spego-review-edge-cases` is method-driven, enumerating unhandled branching paths. `spego-editorial-prose` and `spego-editorial-structure` catch the communication defects — ambiguity, confusion, poor organization — that the technical reviewers do not flag. Run at least one technical reviewer and at least one editorial reviewer before declaring an artifact ready.

## Documentation

- [CLI reference](docs/cli.md) — commands, output modes, JSON contract
- [Delivery board](docs/delivery-board.md) — statuses, conflict tracks, drift warnings, rendering
- [Estimation](docs/estimation.md) — Size Tiers, flow profiles, the pricing ladder, bias
- [OpenSpec adapter](docs/openspec-adapter.md) — the read-only delivery view
- [Workflow skills](docs/workflows.md) — every skill, the groom phases, combined OpenSpec lanes
- [Agent targets](docs/agent-targets.md) — generated Claude and OpenCode files
- [`CONTEXT.md`](CONTEXT.md) — project glossary

## Development

```sh
npm run typecheck   # type checking
npm run lint        # eslint
npm test            # run the suite
npm run build       # compile to dist/
```

## Requirements

- Node.js >= 22.14.0 (for `node:sqlite`)
