## Why

`spego view` today prints the full markdown body of every matching artifact, unconditionally. A workspace with a handful of `epic` artifacts already scrolls hundreds of lines before a reader learns how many artifacts exist or what state they're in — the command reads as an export pipe, not a view.

Worse, the one signal a reader actually wants — per-artifact status — never surfaces in human output at all. Status lives in per-type `meta.status` enums and only `--json` exposes `meta`; `spego list` has a `status` column, but it reports lifecycle (`active`/`deleted`), not workflow status. For `epic` artifacts the gap is sharper: real status is derived from `tasks.md` by the delivery adapter and never stored on the artifact itself, so an artifact-only reading shows nothing for the type readers check most.

## What Changes

- `spego view` without `--json` now defaults to a one-screen **overview**: a bordered totals box, then one aligned table per artifact type with columns `slug, rev, status, lines, updated, title`.
  - `status` is the artifact's own `meta.status` for every type except `epic`; `epic` rows resolve status through the delivery mirror (the same source `spego board` uses), falling back to `meta.status` when the workspace has no OpenSpec adapter or the epic is orphaned.
  - `lines` is the artifact body's line count — a signal only `view` can provide cheaply, since it already reads bodies.
  - A `state` column (`active`/`deleted`) is added only when `--include-deleted` is passed.
- A new `--detail` flag restores today's full markdown-bundle rendering (dividers between artifact bodies).
- `--id` implies `--detail`: `spego view --id <id>` (with or without `--revision`) still prints the full artifact, since a one-row summary table would be a regression on the existing single-artifact read flow.
- `--json` output is unchanged byte-for-byte. `--detail` only affects human rendering; agents keep the exact contract they already parse against.

## Capabilities

### Modified Capabilities

- `agent-command-surface`: the "Expose project view command" requirement gains an overview-by-default behavior and a `--detail` escape hatch; the "Human output uses pretty rendering primitives" requirement's view scenario is replaced with the new overview/detail/id scenarios.

### New Capabilities

None.

## Impact

- Affected source: `src/export/view.ts` (new `OverviewRow`/`OverviewGroup`/`OverviewBundle` model, `renderOverviewBundle`), `src/cli/commands/view.ts` (new `--detail` flag, overview renderer, delivery-status join), `src/command-meta/registry.ts` (add `detail` to `view`'s `inputSchema`, revise its description).
- Behavior change: default human output for `spego view` no longer shows artifact bodies. `--json` is unaffected — no agent-facing contract changes.
- Tests: `test/view.test.ts` gains overview-model cases; `test/cli.test.ts`'s existing default-view assertions move to `--detail`; new cases cover `--id` implying detail and the epic delivery-status join, including graceful fallback when no OpenSpec workspace exists.
- Docs: `README.md` command table and output-modes paragraph; `CHANGELOG.md` `[Unreleased]`.
