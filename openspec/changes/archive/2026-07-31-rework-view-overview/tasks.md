## 1. Specification

- [x] 1.1 Update the `agent-command-surface` capability: overview-by-default, `--detail` escape hatch, `--id` implies detail, epic delivery-status join.
- [x] 1.2 Run `openspec validate rework-view-overview --strict` and resolve any structural errors before any code lands.

## 2. Overview model (`src/export/view.ts`)

- [x] 2.1 Add `OverviewRow { type, slug, revision, status, lines, updated, title, deleted }`, `OverviewGroup { type, rows }`, `OverviewBundle { format: 'overview', count, latestUpdated, groups }`.
- [x] 2.2 Add `renderOverviewBundle(items, opts?: { statusBySlug?: ReadonlyMap<string, string> })`:
  - Groups sorted by type (`localeCompare`), rows keep existing SQL order.
  - `status`: for `type === 'epic'`, `statusBySlug.get(slug)` falling back to `meta.status`; for every other type, `meta.status` when a non-empty string; `—` otherwise. Never normalize across the per-type enums.
  - `lines`: 0 for an empty/whitespace-only body, else `body.trimEnd().split('\n').length`.
  - `updated`: `updatedAt.slice(0, 10)`.
  - `latestUpdated`: max `updatedAt` across all items, sliced to a date, `null` when there are no items.
- [x] 2.3 `ViewResult` gains `overview: OverviewBundle`; `viewArtifacts` accepts and forwards `statusBySlug` to `renderOverviewBundle`.

## 3. Human renderer + delivery-status join (`src/cli/commands/view.ts`)

- [x] 3.1 Default (no `--detail`, no `--id`): render `renderSection('📦', 'Artifact bundle', box, ...groupBlocks)` where `box` is `renderBox('Overview', rows)` with `artifacts`, `types`, `latest`, and (when `--type` is set) a `filter` row; each group block is `${type} (${n})` followed by `renderTable(['slug','rev','status','lines','updated','title'], rows, { maxWidth: 28 })`, with a `state` column inserted only when `--include-deleted` is passed. `maxWidth: 28` (not the initially planned 48) keeps a 6-column row inside ~95 columns — 48 produced 130+ column lines on real content, defeating the one-screen goal.
- [x] 3.2 Empty overview: `renderSection('📦', 'Artifact bundle', 'No artifacts.')`.
- [x] 3.3 `--detail` or `--id` present: keep today's rendering — `renderSection('📦', 'Artifact bundle', intersperseBundleDividers(view.markdown.content))`.
- [x] 3.4 Delivery-status join: when the collected set contains at least one `epic`, call `loadBoardState(engine, opts.cwd)` and build `statusBySlug` from `state.input.changes`. Swallow `DELIVERY_ADAPTER_ERROR` (no OpenSpec workspace) and fall back to `meta.status` for every epic — `view` must never fail for lacking an OpenSpec adapter.
- [x] 3.5 `--json` behavior and payload are unchanged: still `view.json` verbatim, regardless of `--detail`/`--id`.

## 4. Flag + metadata wiring

- [x] 4.1 `src/cli/commands/view.ts`: add `.option('--detail', 'print full artifact bodies', false)`.
- [x] 4.2 `src/command-meta/registry.ts`: add `detail` to `view`'s `inputSchema`; update its `description` to reflect the overview default.

## 5. Tests

- [x] 5.1 `test/view.test.ts`: overview groups sorted by type; `status` verbatim from `meta.status`; `—` when unset; `statusBySlug` overriding for `epic` and falling back when the slug is absent; `lines` count including a zero-body case; `latestUpdated`; `deleted` flag surfacing under `includeDeleted`; empty set → `count: 0`.
- [x] 5.2 `test/cli.test.ts`: rewrite the existing "view human output begins with the bundle header and inserts dividers" case — assert a distinctive body token is absent from default output and present in `--detail` output; assert the default output contains `╭─ Overview`.
- [x] 5.3 `test/cli.test.ts`: new case — `view --id <id>` without `--detail` still prints the full body.
- [x] 5.4 `test/cli.epic-sprint.test.ts`: new case — an `epic` artifact's overview row shows the delivery-derived status; a second case — a workspace with an `epic` artifact but no `openspec/` directory still renders the overview (status falls back to `—` or `meta.status`, no thrown error).
- [x] 5.5 Confirm `test/cli.gap-fill.test.ts`'s existing `--json view` cases (191, 205, 221, 227, 361) still pass unmodified — proof the JSON contract held.

## 6. Documentation

- [x] 6.1 README command table row for `view`: overview-by-default, `--detail` for the full bundle.
- [x] 6.2 README "Output modes" paragraph: replace the `view` divider description with the overview description; note `--detail` restores dividers.
- [x] 6.3 CHANGELOG `[Unreleased]` → `Changed`: default `spego view` human output is now an overview; `--detail` prints the full bundle; `--json` unchanged.
