# CLI reference

Every command accepts `--cwd <dir>` to set the project root, and the global `--json` flag to switch output modes.

## Commands

| Command | Description |
|---------|-------------|
| `spego init` | Initialize a `.spego/` workspace |
| `spego status` | Report workspace status |
| `spego create --type prd --title "My PRD"` | Create an artifact |
| `spego read --id <uuid>` | Read by id, type+slug, or path |
| `spego update --id <uuid> --body "new content"` | Update with revision control |
| `spego delete --id <uuid>` | Soft-delete, preserving history |
| `spego list` | List artifacts |
| `spego view` | Overview of artifacts as a table; `--detail` exports the full markdown bundle, `--json` exports full JSON |
| `spego commands` | List command metadata |
| `spego workflows` | List workflow skill metadata |
| `spego skills` | Regenerate agent skill files |
| `spego epics [name]` | List delivery epics, or get one by change name |
| `spego tasks <change> [task]` | List tasks for a change, or get one task |
| `spego sprints` | List sprint plans in board order |
| `spego board` | Show the delivery board — sprints, change signals, drift; `--sync` reconciles first |
| `spego sync` | Reconcile the delivery mirror: create missing epics, close finished sprints, retire epics of archived changes |
| `spego record <change>` | Record one measured run (`--flow`, `--hours`) against a change's epic `actuals`; appends, never overwrites |
| `spego index rebuild` | Rebuild the SQLite index from files |

## Output modes

Every command speaks two modes.

**Human (default)** — scannable terminal output. Each command renders a section: a single emoji header (`📦 📄 🛠️ 🧭 📚 ✅ ✨ 🗑 📋 🏃 🕸️ 🧩`), a blank line, then content. Summaries render as bordered boxes (`╭─ … ─╮`), lists as aligned tables. Errors print as `⚠️  [CODE] message` on stderr.

**JSON (opt-in)** — pass `--json` for deterministic, decoration-free JSON on stdout. Errors come back on stderr as `{ "error": { "code", "message", "details" } }`, where `details` is always an object.

Agents calling spego MUST pass `--json`. Humans normally do not.

`view` defaults to an overview — a totals box plus one table per artifact type, with `epic` rows carrying delivery-derived status. `view --detail` renders the full markdown bundle instead, separating artifacts with `────` dividers.

## Artifact payloads

`read --json` and `update --json` both return artifact records with `frontmatter`, `body`, and `path`; `update` also keeps the compatibility fields `id` and `revision`.

`create` and `update` accept body content through `--body`, `--body-file <path>`, or stdin via `--body-file -`.

## Related

- [Delivery board](delivery-board.md) — what `board`, `sync`, and `epics` derive
- [Estimation](estimation.md) — what `record` feeds and how prices resolve
