## Why

The current `spego` command surface is mostly clean (`init`, `status`, `create`, `read`, `update`, `delete`, `list`, `view`, `epics`, `tasks`, `commands`, `workflows`, `index rebuild`) — these names are short, domain-aligned, and CRUD-aligned where appropriate. One command stands out as not following the rest of the surface:

- **`regenerate`** — vague verb; the user has to read `--help` to learn what is being regenerated. The command actually emits agent toolchain files: skill files (one per command, one per workflow) and command files (slash commands) under `.claude/skills/` and `.claude/commands/`. The dominant artifact is the *skill*, and the user-facing concept is "the skills my agent uses to drive spego". The verb is implicit (regenerate ≈ rebuild ≈ sync ≈ generate). A noun command (`spego skills`) is shorter, more discoverable, and matches the way humans and agents already talk about the output ("my spego skills").

This change renames `regenerate` → `skills`. We also audit every other command name and confirm none need to move (audit findings are in the design notes below).

We keep the old name as a hidden alias for one minor release so existing scripts, hooks, and docs do not break overnight.

## What Changes

### Rename
- Add a new top-level command `spego skills` that performs the existing regeneration flow.
- Keep `spego regenerate` working as a hidden alias that:
  - Calls the same action handler.
  - Writes a single deprecation line to stderr in human mode: `deprecated: 'spego regenerate' is now 'spego skills'`.
  - Is hidden from `--help` output and from `spego commands`.
- Remove the alias in the next minor version (tracked in CHANGELOG).

### Registry and metadata
- Update `COMMAND_REGISTRY` so the entry is `name: 'skills'`, `slashName: '/spego:skills'`, `category: 'workspace'`.
- Regenerated agent files under `.claude/skills/` and `.claude/commands/` reflect the new name on the next `spego skills` run.
- Add a "removed legacy generated files" cleanup pass for `.claude/skills/spego-regenerate/SKILL.md` and `.claude/commands/spego/regenerate.md` so old toolchain installs do not retain stale aliases.

### Audit of remaining commands

The audit confirmed all other commands stay:

| Command | Verdict | Reason |
|---|---|---|
| `init`, `status` | keep | Standard workspace verbs. |
| `create`, `read`, `update`, `delete`, `list` | keep | CRUD; aligns with artifact engine. |
| `view` | keep | Distinct from `read` (bundle vs. single artifact); short, domain-aligned. |
| `epics`, `tasks` | keep | Plain plural nouns of the planning domain. |
| `commands`, `workflows` | keep | Plain plural nouns of the meta-introspection surface. |
| `index rebuild` | keep | `index` is the noun, `rebuild` is the only verb today; matches `git remote add` style. |

No other rename in this change. If we later need to split `view` into `bundle` / `export`, that is a separate change.

## Capabilities

### Modified Capabilities

- `agent-command-surface`: rename the "regenerate" command to "skills"; document the alias and its removal window.
- `agent-skill-generation`: the generated artifacts under `.claude/skills/` and `.claude/commands/` change name from `spego-regenerate` to `spego-skills`; the cleanup pass MUST remove the legacy paths.

## Impact

- Affected source files:
  - `src/cli.ts` — register `skills` and a hidden `regenerate` alias.
  - `src/commands/registry.ts` — replace the registry entry.
  - `src/generator/*.ts` — emit `spego-skills` paths; clean up `spego-regenerate` legacy files.
- Agent skill files regenerate on the next `spego skills` run. Users who never run regeneration keep the old files until they do; the next run replaces them and removes the legacy paths.
- README, CHANGELOG, and any in-repo skills that mention `spego regenerate` are updated to `spego skills`.
- Tests: registry rename, alias forwarding, deprecation warning, generator path swap, legacy cleanup.

This change has a soft dependency on `improve-cli-output-modes` only for the deprecation warning conventions (human mode prints the warning line; JSON mode is silent). The two changes are otherwise independent and can land in any order.
