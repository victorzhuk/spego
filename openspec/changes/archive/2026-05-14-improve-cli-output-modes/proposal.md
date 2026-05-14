## Why

Today the `spego` CLI is inconsistent about who its output is for:

- `init`, `status`, `list`, `read`, `epics`, `tasks`, `index rebuild`, `create`, `update`, `delete`, `view` honor the global `--json` flag and have a humanish text fallback, but the human fallback is **plain text** with no structure — easy for an agent to ignore, hard for a human to scan.
- `commands` and `workflows` print **JSON only**. There is no human mode, even though humans frequently want a quick glance at "what can I run?".
- `view` carries its own `--format markdown|json` flag that overlaps with the global `--json`, creating two ways to ask for JSON and silent confusion when both are passed.
- `read` and `update` print full markdown bodies in human mode but raw `body` strings in JSON mode — neither shape uses any visual cue (header, separator, frontmatter rendering) that helps a human reader.

Two audiences, one CLI: every command should pick a clean default for humans (pretty, scannable, with light visual cues) and a clean opt-in for agents (deterministic JSON). No command should be JSON-only. No command should require remembering a per-subcommand format flag.

## What Changes

### Output mode contract
- The global `--json` flag (already present) becomes the **single** way to request JSON output. The default for every command is human output.
- Every command — including `commands`, `workflows`, `index rebuild`, and any future command — SHALL implement both modes. The behavior MUST be:
  - Default (human): pretty, structured, scannable.
  - `--json`: deterministic, parseable, no decoration.
- Errors follow the same contract: human errors are short and prefixed with a clear marker; `--json` errors are the existing `{ error: { code, message, ... } }` envelope.

### Pretty human output
- `status` and `init` render a small bordered summary box (workspace path, agents, artifacts root, index path) using rounded box-drawing characters.
- `list`, `epics`, `tasks` render an aligned plain-text table with a header row; long values truncate with `…`. No color codes, no emoji in body cells (color/emoji confuse copy-paste and break in non-TTY).
- Section headers across commands use a single light emoji prefix (`📦` artifacts, `🧭` workflows, `🛠️` commands, `📚` epics, `✅` tasks, `⚠️` errors). Emoji are restricted to top-of-section markers, never embedded in tabular data.
- `commands` and `workflows` gain a human renderer: a grouped table (by `category` for commands; by phase count for workflows) plus a one-line description per row.
- `view` renders its markdown bundle as today, but adds a small ASCII separator (`────`) between artifacts so a reader can see boundaries.
- `read` (human mode) prints a header line `<type>/<slug>  rev <n>  (<id>)` followed by a divider, then the body.
- All multi-line outputs end with a single trailing newline; no trailing whitespace.

### Format flag cleanup
- Remove `view --format <fmt>` in favor of the global `--json`. Add a deprecation message that prints to stderr (human mode only) when `--format` is used, and continue to honor it for one release.
- Document the contract in the README under a new "Output modes" section.

## Capabilities

### Modified Capabilities

- `agent-command-surface`: every command MUST support both human and JSON output; pretty rendering rules are made part of the contract; the `commands` and `workflows` commands MUST emit human output by default.

### New Capabilities

None. This is a refinement of the existing surface.

## Impact

- Affected source files: `src/cli.ts` (every action handler), and a new `src/cli/render.ts` housing the pretty renderers (boxes, tables, headers).
- `commands` and `workflows` change from JSON-only to human-by-default — agents that pipe their output MUST now pass `--json` (this is a behavior change, called out in the README and CHANGELOG).
- `view --format` becomes deprecated; `--format json` continues to work for one release with a stderr warning.
- No artifact schema changes. No generator changes (the generated `SKILL.md` files already instruct agents to pass `--json`; we audit them in tasks).
- Tests: every command gains a "default human output is non-empty and contains the expected header" assertion plus a "with `--json` output parses as JSON" assertion.
