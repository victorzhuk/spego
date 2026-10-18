## Context

Stencil Tern loads Luau plugin packages from its plugins directory. A host-only package declares blocks in `plugin.toml` and defines them with `tern.block.define`; each running block is a pane whose state lives on the plugin's host worker, survives window closes and daemon restarts, and restores only through the JSON value its `save` returns. Every handler runs under a 2-second per-call budget. `tern.process.run` starts a program directly with no shell, uses a relative `cwd` against the plugin directory unless given an absolute one, and can raise at the call when the program cannot start.

`spego board --json` already emits `{sprints, ungrouped, warnings, next}` behind the root `--json` flag, and `spego tasks <change> --json` emits task summaries through the non-engine read path.

Two facts shape this design. Board artifact metadata comes from the SQLite index: `ArtifactEngine.open` creates and migrates the database but never rescans canonical files, so externally edited artifacts, additions, and removals stay invisible until a rebuild. And `MirrorChange` carries no task counts even though `MirrorSourceChange` does, so a board consumer cannot render progress without a second command per change.

Evidence inspected 2026-10-18: the official Tern plugin book (blocks, manifest reference, host API, plugin CLI) and SDK revision `f3f9fee82bf692166c2a477a895a347ac2a47ca2`. `tern --version` on this machine reports `tern 0.9.4 (b9ef74c)`. The plugin has not been loaded here yet, so runtime compatibility remains unproven until acceptance loads it.

## Goals

- Ship a static, host-only Tern plugin that renders the spego delivery board natively.
- Give the board a fresh read of canonical artifact state, scoped to one board invocation.
- Expose per-change task progress in board JSON without a second command.
- Keep every existing CLI consumer and spego's delivery-state ownership unchanged.

## Non-Goals

- Generated command lenses, a `tern` agent target, or registry-driven generation.
- A native TSP application, HTTP service, or daemon.
- Delivery mutation from Tern: no `sync`, `record`, `init`, `skills`, or artifact edits.
- Polling, file watching, focus-triggered refresh, or automatic retries.

## Decisions

- **Package shape.** `plugins/tern-spego/` holding `plugin.toml`, `host.luau`, and `README.md`, listed in the npm `files` array. The manifest declares `schema = 1`, `id = "spego"`, `name = "Spego"`, `version` tracking the package version, `host = "host.luau"`, and one `[[blocks]]` table: `id = "board"`, `title = "Spego Delivery Board"`, `palette = true`. No `window` entry and no lenses, so no custom palette command or keybinding is needed.
- **Data boundary.** The CLI is the only delivery-data source. Luau never parses `.spego` or OpenSpec Markdown, and never recomputes delivery rules.
- **Freshness.** New `spego board --fresh` collects one invocation-local canonical artifact metadata snapshot and ID map, reusing `readArtifactFile` and `parseArtifactFile` in `src/artifacts/storage.ts` with the existing layout, supported-type, and containment checks. Epics, non-deleted sprint plans, and linked-artifact resolution read from that snapshot; retired epics remain available for actuals; existing deleted-artifact filtering is preserved. No rebuild, no revision scan, no per-change subprocess, no new repository interface or cache layer.
- **Freshness scope.** `loadBoardState` also serves `sync`, `view`, and workspace status, so freshness is selected by this board invocation and must not change their behavior. `board --fresh --sync` is rejected with `VALIDATION_FAILED` before the engine opens.
- **Additive JSON.** `MirrorChange` gains optional `taskCount` and `tasksDone`, emitted only as a pair, from the adapter counts already carried by `MirrorSourceChange`. `group`, `planState`, status values, and every existing field keep their meaning.
- **Root identity.** The block captures the absolute `cx.cwd` at pane start as its workspace root; a valid saved root wins on restore; there is no ancestor search and no workspace picker. A missing or relative cwd produces a configuration error without spawning.
- **Process invocation.** Direct argv, never a shell: `spego --json board --fresh [--archived] --cwd <root>` and `spego --json tasks <slug> --cwd <root>`, each with `{cwd = <root>, timeout_ms = 10000}`.
- **Refresh.** Once on initialization or restoration, once per explicit user request. No timers, no watching.
- **Persistence.** `save` returns a versioned preference object only: root, selection, detail visibility, and display toggles.
- **Failure.** A failed refresh keeps the last successful board with a stale indication. Missing optional counts never imply an incompatible CLI; a binary rejecting `--fresh` does.

## Risks / Trade-offs

- A fresh read is not a filesystem transaction. Concurrent edits surface as ordinary read errors and a later manual refresh observes settled input; no locking or snapshotting is added.
- Read-only means artifact-safe with bounded `.spego/index/` cache initialization. A physically read-only index directory is not supported.
- Tern is in closed beta and its manifest and host API may change. Compatibility must be established by loading the plugin before release, not by specification validation.
- Tern declares no plugin permission model: the host half runs `spego` with the user's rights, which the plugin README must state plainly.
- Callback ordering and pane replacement are guarded but not covered by a test. Board and task reads carry separate monotonic generations; every callback re-checks its pane-state identity, its captured root, and pane liveness before rendering. The two races named in the implementation tasks (a board result arriving after a newer request, and a task result arriving after a selection change or into a reused pane ID) are not reproducible on demand from the CLI, and no Luau runtime is installed on this host to drive the guards directly. They stay recorded residuals: the guards are reviewed by reading `plugins/tern-spego/host.luau`, and any future regression there is caught by review rather than by an automated case.
