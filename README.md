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
| `spego workflows` | List workflow skills metadata (JSON) |
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

- `.claude/skills/spego-<command>/SKILL.md` — skill definitions following Claude Code conventions
- `.claude/commands/spego/` — slash command wrappers

Run `spego regenerate` to update generated files without reinitializing the workspace.

## Workflow Skills

Workflow skills guide an agent through a multi-persona process inside the chat, persisting results as spego artifacts at well-defined checkpoints.

### brainstorm-party

Multi-persona collaborative brainstorming. Six roles (PM, Architect, UX, Dev, QA, Skeptic) take turns framing, expanding, challenging, and converging on ideas. Outputs a `brainstorm` artifact and optionally drafts a follow-up `prd` or `design`.

Use when exploring a problem space broadly or stress-testing a concept before committing.

### review-adversarial

Adversarial critique of an existing artifact. Five roles (Skeptic, Security, Reliability, UX, Cost) attack from different angles, surface gaps, and prioritize findings. Outputs a `qa` or `risk` artifact and optionally a `decision` or `retro`.

Use when you need rigorous review before approval or implementation.

### review-edge-cases

Method-driven edge-case enumeration. Three roles (Path-tracer, Boundary-checker, Concurrency-skeptic) mechanically trace branching paths, derive edge classes (off-by-one, unguarded inputs, missing else/default, race conditions, timeout gaps), filter already-handled cases, and report only unhandled paths. Outputs a `qa` artifact with a fenced JSON array of findings.

Use when you need to find logic defects that adversarial review may miss.

### editorial-prose

Clinical copy-edit pass. A single Copy-editor persona identifies ambiguous sentences, unnecessary jargon, long sentences, passive voice, and redundancy. Confirmed edits are applied in place via `spego update` with `--expected-revision`; declined edits are recorded as recommendations. Outputs a `qa` artifact summarizing all edits.

Use when the artifact's ideas are sound but the prose needs tightening.

### editorial-structure

Structural review without mutation. A single Structural editor persona outlines the current structure, proposes cuts/merges/reorders/splits, and produces a prioritized recommendation list. Does not modify the source artifact. Outputs a `qa` artifact with restructuring recommendations.

Use when content is correct but organization needs improvement.

### Invocation

All workflow skills are generated at `.claude/skills/spego-<workflow>/SKILL.md` during `spego init`. The agent picks them up automatically based on the skill description.

### Complementary reviews

For thorough artifact review, combine reviewers for orthogonal coverage:

- **Technical defects:** Run `review-adversarial` (attitude-driven: hunts for gaps, weak assumptions) and `review-edge-cases` (method-driven: enumerates unhandled branching paths). Together they catch almost all technical defects.
- **Communication defects:** Run `editorial-prose` (copy-edit) and `editorial-structure` (organizational review). These catch confusion, ambiguity, and poor organization that technical reviewers don't flag.
- **Recommended minimum:** At least one technical reviewer + at least one editorial reviewer before declaring an artifact ready.

## Development

```sh
npm run typecheck   # type checking
npm run lint        # eslint
npm test            # run tests (vitest)
npm run build       # compile to dist/
```

## Requirements

- Node.js >= 22.14.0 (for `node:sqlite`)
