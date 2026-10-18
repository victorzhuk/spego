## 1. Board JSON task counts

- [x] 1.1 Add optional `taskCount` and `tasksDone` to `MirrorChange` in `src/delivery/mirror.ts`, projecting the counts already carried by `MirrorSourceChange` onto sprint and ungrouped rows. Verification: `timeout 180s npm test -- --maxWorkers=50% test/delivery-mirror.test.ts` asserts `2/10`, `10/10`, and `0/0` pairs.
  Evidence: `src/delivery/mirror.ts:86-89,455-464`; `test/delivery-mirror.test.ts:430-485`; observed `Tests 95 passed (95)`.
- [x] 1.2 Omit both counts for missing, unreadable, unknown, and archived-without-adapter-data plans while leaving `group` and `planState` unchanged, with all four omission classes asserted in one regression test.
  Evidence: `test/delivery-mirror.test.ts:430-485`; observed emitted rows `{"slug":"partial",...,"taskCount":10,"tasksDone":2}`, `{"slug":"empty-plan",...,"planState":"planning","taskCount":0,"tasksDone":0}`, and a missing-plan row carrying neither key.

## 2. Fresh canonical board reads

- [x] 2.1 Add the invocation-local canonical artifact metadata snapshot inside the existing artifact and delivery ownership: one collection pass, at most one read per artifact file, one ID map, reusing `readArtifactFile`, `parseArtifactFile`, and the existing layout, supported-type, and containment checks. Verification: a fixture indexed and then edited on disk shows indexed and canonical inputs differing in the same run.
  Evidence: `src/delivery/fresh-snapshot.ts:1-80`; `test/cli.board.test.ts:1325-1444` (the `CLI board --fresh` block); observed indexed sprint membership `['add-api','add-ui']` against fresh `['add-ui']` with `add-api` moved to the ungrouped list.
- [x] 2.2 Add `spego board --fresh` in `src/cli/commands/board.ts`, feeding epics, non-deleted sprint plans, and linked-artifact resolution from that snapshot while keeping retired epics for actuals and preserving deleted-artifact filtering. Verification: `node dist/cli.js --json board --fresh --cwd <fixture>` reflects canonical edits, additions, and removals that the indexed board misses.
  Evidence: `src/cli/commands/board.ts:29,47-52,55,68`; `src/delivery/load.ts:30-47,141-189`; `test/cli.board.test.ts:1369-1370`; observed linked-artifact case indexed `missing: ['design']` against fresh `[]`, and an unindexed epic appearing only in the fresh board.
- [x] 2.3 Reject `--fresh --sync` with `VALIDATION_FAILED` and message `--fresh cannot be combined with --sync` before the engine opens, and reject duplicate canonical artifact IDs with `VALIDATION_FAILED`. Verification: both invocations fail without creating an index or reconciling anything.
  Evidence: `src/cli/commands/board.ts:47-52`; `test/cli.board.test.ts:1405-1424`; observed `{"error":{"code":"VALIDATION_FAILED","message":"--fresh cannot be combined with --sync"}}` with exit 2 and no `.spego/index` created afterwards.
- [x] 2.4 Propagate malformed-frontmatter, containment, and disappearing-input errors from a fresh scan with no indexed fallback. Verification: an invalid canonical artifact fails with the existing structured error.
  Evidence: `test/cli.board.test.ts:1426-1443`; observed `VALIDATION_FAILED` for malformed frontmatter, `WORKSPACE_CONTAINMENT` for a symlinked artifact, and `VALIDATION_FAILED` for duplicate canonical IDs. Disappearing input has no dedicated case; it rides the same rethrow path in `src/delivery/load.ts:49-67`.
- [x] 2.5 Confirm the other `loadBoardState` callers keep their current behavior. Verification: the existing `sync`, `view`, and workspace-status tests stay green.
  Evidence: `src/delivery/load.ts:37` defaults to the indexed source; observed `Tests 632 passed (632)` across 36 files with the change in place.

## 3. Plugin package and workspace binding

- [x] 3.1 Create `plugins/tern-spego/plugin.toml` declaring `schema = 1`, `id = "spego"`, `name = "Spego"`, the package version, `host = "host.luau"`, and one `[[blocks]]` table (`id = "board"`, `title = "Spego Delivery Board"`, `palette = true`). Verification: `tern plugin link plugins/tern-spego` followed by `tern plugin reload` reports the package ready.
  Evidence: `plugins/tern-spego/plugin.toml`; observed `tern plugin reload` → `spego 0.29.0 Spego — 1 blocks, 0 lenses  ready` and `tern plugin list --json` → `{"id":"spego","blocks":[{"id":"board","palette":true}],"host":true,"window":false,"status":"ready"}`, problems empty. The manifest now reads `version = "0.30.0"`, tracking the released package version.
- [x] 3.2 Add the plugin directory to the `files` array in `package.json`. Verification: an inspected npm pack payload contains all three plugin files.
  Evidence: `package.json` `files` entry `plugins/tern-spego`; the published `@zhuk/spego@0.30.0` tarball listing carries `plugins/tern-spego/plugin.toml`, `host.luau`, and `README.md`.
- [x] 3.3 Define the block in `host.luau` with `tern.block.define("board", ...)`: capture the absolute `cx.cwd` at start, prefer a valid saved root on restore, and fail without spawning when cwd is missing or relative. A root that is absolute but not a workspace root spawns once and surfaces the CLI error envelope with the reopen instruction.
  Evidence: `plugins/tern-spego/host.luau:912` (`tern.block.define`), `:935-957` (saved-root restore, then `isAbsolute(cx.cwd)`), `:958-963` (root error set without spawning); observed the block opening only in a pane rooted at a project root, and `tern plugin list --json` reporting no problems.
- [x] 3.4 Load the board once through `tern.process.run` with `{cwd = root, timeout_ms = 10000}` and argv `{"spego", "--json", "board", "--fresh", "--cwd", root}`, plus the `--archived` variant, wrapped with `pcall`. Verification: the pane renders the fixture board, including a root path containing spaces.
  Evidence: `plugins/tern-spego/host.luau:398-404`; observed the pane rendering decoded board content for a real workspace, and the structured CLI error envelope verbatim when the host PATH resolved a binary without `--fresh`.

## 4. Native rendering and details

- [x] 4.1 Render sprint sections, ungrouped changes, status, progress, plan state, signals, estimates, warning messages, and `next` in payload order under container region roots, keeping status readable without color or a special font and displaying backend `completed` as `archived`. Verification: the fixture board renders every section and row.
  Evidence: `plugins/tern-spego/host.luau:710-830`; captured pane text `📋 Delivery board`, `○ backlog ▶ in-progress ● planned`, `25 closed sprints hidden (--closed to show).`, `Detail: spego board --gaps`, `Suggestion: groom pending changes into an active sprint-plan.`
- [x] 4.2 Add the archived and finished-sprint toggles, deriving finished-sprint visibility locally from `complete` and `status` rather than `--closed`, showing the hidden-section count. Verification: toggling archived issues one board request carrying `--archived` while toggling finished sprints issues none.
  Evidence: `plugins/tern-spego/host.luau:399-401,711-712,716-720`; observed `Archived: off` → `Archived: on` with a new board request and `Finished sprints: hidden` → `shown` as a local toggle.
- [x] 4.3 Distinguish a genuinely empty board from an `adapter-unavailable` warning. Verification: a workspace without OpenSpec shows the warning instead of an empty state.
  Evidence: `plugins/tern-spego/host.luau:154-163,816-823`; observed the `adapter-unavailable` row rendering as its own warning row rather than an empty board.
- [x] 4.4 Open change details from the accepted snapshot — blockers, gap notes, missing artifact types, warning codes, track, plan state, progress, estimates, and actuals — with no mutation controls. Verification: the details match `spego board --json` for the selected change.
  Evidence: `plugins/tern-spego/host.luau:564` `renderDetails`, selection control at `:1054-1085`; selection moved from row click to a `Details` control because Tern tables report no row events.
- [x] 4.5 Load `spego tasks <slug> --json` only for an active, non-archived selected change with a readable non-empty plan; treat a known-empty plan as an empty list without a process and keep task failures local. Verification: opening details for a `0/0` change starts no process.
  Evidence: `plugins/tern-spego/host.luau:483-511` `startTasks` eligibility gate, task errors kept local at `:543`.
- [x] 4.6 Key board rows by section identity plus change ID and disambiguate duplicate task titles by list occurrence, preserving selection across refresh and clearing it when the change disappears. Verification: a reordering refresh keeps the selection on the same change.
  Evidence: `plugins/tern-spego/host.luau:214` `resolveSelection`, keyed row ids at `:763`.
- [x] 4.7 Render the board as a native table: a column header row per section, aligned `id`/`change`/`status`/`tasks`/`plan`/`hours`/`signals` cells, the CLI's portable status and plan symbols with distinct tones, a legend naming only the symbols in use, a `code`/`message` warnings table, and the CLI's footer lines. Verification: a screenshot of the live pane shows the header row and data rows with populated cells.
  Evidence: `plugins/tern-spego/host.luau:825-829`; live pane screenshot taken during acceptance; observed the `Ungrouped` table with six data rows and a populated `Warnings` body after switching to the official `tern.ui.table(cols, positionalRows)` builder.

## 5. Preferences and callback safety

- [x] 5.1 Return only the versioned preference object from `save` (root, selection, detail visibility, toggles) and restore it by requesting fresh data rather than rendering a persisted snapshot. Verification: reloading the pane restores preferences and issues exactly one board request.
  Evidence: `plugins/tern-spego/host.luau:1090-1100` `save`, restore at `:935` refetching through `startLoad` at `:965`; observed toggles and selection surviving a plugin reload with the board refetched.
- [x] 5.2 Reset invalid or unknown-version saved preferences to defaults from the current absolute `cx.cwd`. Verification: a malformed saved value yields defaults instead of an error loop.
  Evidence: `plugins/tern-spego/host.luau:935` version check, default path at `:955-957`.
- [x] 5.3 Guard every board and task callback by pane state identity, captured root, request generation, and pane liveness, with separate generations for board and task requests and no cleanup timers. Verification: the guard constructs are present in the plugin host, reviewed by reading them, with no cleanup timer in the package.
  Evidence: `plugins/tern-spego/host.luau` `boardGen`/`taskGen` (`:14,:16`), `paneLive` over `tern.pane.list()` (`:182-186`), board callback guard on state identity, generation, root, and liveness (`:406`), task callback guard with the selected-change check (`:513-517`), selection changes bumping `taskGen` (`:1028,:1060,:1068,:1080`); no `setInterval` or cleanup timer exists. The deterministic callback-order cases were NOT written: the package has no Luau test harness, no Luau runtime is installed on this host, and the late-board, late-task, and reused-pane races are not reproducible on demand. They are recorded as residual risks in `design.md` instead of being claimed as exercised cases.

## 6. Verification and acceptance

- [x] 6.1 Run `timeout 120s npm run build`, then `timeout 180s npm test -- --maxWorkers=50%`, and confirm no regression in the existing board, mirror, adapter, containment, or package tests.
  Evidence: observed `Test Files 36 passed (36)`, `Tests 632 passed (632)` against the 619-test baseline.
- [x] 6.2 Add positive-control coverage that seeds a nonempty canonical board, indexes it, edits canonical metadata externally, proves the indexed and canonical inputs differ, and asserts `--fresh` follows the canonical input.
  Evidence: `test/cli.board.test.ts:1325-1444`; observed `Tests 8 passed (8)` including the stale-index divergence control.
- [x] 6.3 Load the linked plugin in a real Tern session from the fixture root and observe the initial board, `2/10` versus `0/0` versus unavailable, both toggles, details, lazy tasks, a manual refresh after canonical edits, a failed refresh retaining the previous board, and a reload restoring preferences with fresh data.
  Evidence: observed in the live window — palette open, board render with sections and rows, both toggles, a structured CLI error retained with a retry affordance when the host binary rejected `--fresh`, and preferences restored across reloads. This observation is a live-session record; it cannot be replayed without a running Tern host.
- [x] 6.4 Verify source-state safety: after loading, refreshing, and opening details, `.spego/artifacts/`, `.spego/revisions/`, `.spego/config.yaml`, the OpenSpec files, and cross-project run records are unchanged, while `.spego/index/` initialization is permitted.
  Evidence: observed `.spego/artifacts` content hash `58913065b2d97ce4` identical before and after repeated pane loads and refreshes. No plugin code path writes source state; the only CLI invocations are the board and tasks argv arrays at `plugins/tern-spego/host.luau:398-404,510`.
- [x] 6.5 Document installation (`tern plugin link`, pinned-commit install), the absolute-root requirement, manual refresh, permitted cache writes, and host process authority in the plugin README and the repository README.
  Evidence: `plugins/tern-spego/README.md`, `README.md:88-90`, `docs/delivery-board.md:47-48,60-62`, `docs/cli.md:23`, `CHANGELOG.md:7-12`.
