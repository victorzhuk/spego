## 1. Specification

- [x] 1.1 Update the `agent-command-surface` capability with the dual-mode contract, the pretty-rendering rules, and the deprecation of `view --format`.
- [x] 1.2 Run `openspec validate improve-cli-output-modes --strict` and resolve any structural errors before any code lands.

## 2. Renderer module

- [x] 2.1 Add `src/cli/render.ts` exporting:
  - `renderBox(title: string, rows: Array<[string, string]>): string` — bordered key/value summary using `╭ ─ ╮ │ ╰ ╯`.
  - `renderTable(columns: string[], rows: string[][], opts?: { maxWidth?: number }): string` — left-aligned, header row separated by `─`, long cells truncated with `…`.
  - `renderHeader(emoji: string, label: string): string` — single-line section header.
  - `renderDivider(width?: number): string` — `────` divider for `view`.
  - Internal helper `truncate(value: string, width: number): string` and `padRight(value: string, width: number): string`.
- [x] 2.2 Renderers MUST be pure (string in, string out), MUST NOT read process.env, MUST NOT detect TTY, MUST NOT emit ANSI color codes.
- [x] 2.3 Add `test/cli.render.test.ts` covering box drawing alignment, table truncation, header formatting, and divider width.

## 3. Wire renderers into commands

- [x] 3.1 `init`: human output uses `renderHeader('📦', 'spego workspace ready')` + `renderBox('Workspace', [...])` listing config, artifacts, index, agents.
- [x] 3.2 `status`: human output uses `renderBox('Workspace status', [...])` when initialized; renders a single-line "no workspace; run: spego init" message when not.
- [x] 3.3 `list`: human output uses `renderHeader('📦', 'Artifacts')` + `renderTable(['type/slug','rev','status','title','id'], rows)`. Empty state prints `No artifacts.`.
- [x] 3.4 `read`: human output prints `📄 <type>/<slug>  rev <n>  (<id>)\n────\n<body>`.
- [x] 3.5 `update`: same header line as `read`, then the new body. Keep JSON shape identical to today.
- [x] 3.6 `create`: human output prints `✨ Created <type>/<slug>  rev <n>` followed by the rendered file path.
- [x] 3.7 `delete`: human output prints `🗑  Deleted <id> at <deletedAt>`.
- [x] 3.8 `view`: human output prints `renderHeader('📦', 'Artifact bundle')` then the existing markdown body, with `renderDivider()` between artifacts. Continue to honor `--format json` for one release with a stderr deprecation warning.
- [x] 3.9 `epics`: human output uses `renderHeader('📚', 'Epics')` + `renderTable(['id','status','progress','title'], rows)`.
- [x] 3.10 `tasks`: human output uses `renderHeader('✅', 'Tasks: <change>')` + `renderTable(['done','title'], rows)` where `done` is `[x]` or `[ ]`.
- [x] 3.11 `index rebuild`: human output uses `renderBox('Index rebuild', [['scanned', n], ['indexed', n], ['invalid', n]])`. Invalid files render below as a small table.
- [x] 3.12 `commands`: add human renderer — `renderHeader('🛠️', 'Commands')` then a per-`category` block (workspace, artifact, view, planning) with a small table `['name','description']`.
- [x] 3.13 `workflows`: add human renderer — `renderHeader('🧭', 'Workflows')` then `renderTable(['name','phases','description'], rows)`.

## 4. Error rendering

- [x] 4.1 In human mode, a `SpegoError` prints `⚠️  [<code>] <message>` to stderr.
- [x] 4.2 In `--json` mode, the existing `{ error: { code, message, details? } }` envelope is preserved unchanged.
- [x] 4.3 No emoji in JSON. No JSON in human mode unless the user passes `--json`.

## 5. View format flag deprecation

- [x] 5.1 Continue to accept `view --format markdown|json`.
- [x] 5.2 When `--format` is supplied in human mode, emit `deprecated: --format is deprecated; use the global --json flag` to stderr.
- [x] 5.3 Update README "Output modes" section to call out the deprecation and the removal target (one minor release away).

## 6. Tests

- [x] 6.1 For every command, add a "default output is human" assertion: stdout is non-empty, is not valid JSON, and contains the expected emoji header (where applicable).
- [x] 6.2 For every command, add a "with `--json` output parses as JSON" assertion against the same input.
- [x] 6.3 Add a regression test asserting `spego commands` and `spego workflows` no longer require `--json` to produce output (they used to be JSON-only).
- [x] 6.4 Add a test for `view --format json` that asserts the deprecation warning is written to stderr but exit code is 0 and stdout is still valid JSON.
- [x] 6.5 Add a test that error output in `--json` mode is parseable and contains `error.code` and `error.message`; in human mode it starts with `⚠️ `.

## 7. Documentation

- [x] 7.1 Add an "Output modes" section to the README explaining the contract: human by default, `--json` for agents.
- [x] 7.2 Add a CHANGELOG entry under "Changed" for the `commands`/`workflows` default-mode flip and the `view --format` deprecation.
- [x] 7.3 Audit the generator templates: every generated `SKILL.md` that calls a `spego` command MUST pass `--json` so agents continue to receive parseable output.
