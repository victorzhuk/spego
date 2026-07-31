## Why

Every drift warning the delivery mirror reports today can only be repaired by running the
agent-side `spego-groom` workflow — even when the repair is purely mechanical, like creating an
epic for an active change that has none, or closing a sprint whose changes are all satisfied.
There is no CLI path to clear that drift deterministically, so mechanical reconciliation waits on
an agent invocation that also has to do real judgment work (deps, gaps, sprint grouping, orphan
disposition) in the same pass.

## What Changes

- A new `spego sync [--dry-run]` command derives a reconciliation plan from the same mirror state
  `spego board` already computes, and applies the mechanical subset of it:
  - **create-epic**: an active change with no epic artifact (the `ungroomed-change` condition)
    gets a new `epic` artifact, titled from the change's resolved title.
  - **close-sprint**: a non-closed sprint whose every change is satisfied (the `closable-sprint`
    condition) gets its `sprint-plan` status set to `closed`.
- Judgment calls stay with `spego-groom` and are not acted on: `orphan-epic` disposition, deps,
  gaps, `requires`/`links`, and sprint grouping are reported by `sync` as remaining work, never
  applied.
- Writes go through the same `engine.create` / `engine.update --expected-revision` path the groom
  workflow already uses — `spego sync` can write nothing groom could not, and it never touches
  `openspec/`.
- `archived-in-sprint` no longer fires for a **closed** sprint: a closed sprint holding archived
  changes is accurate history, not drift. Once `sync` closes a sprint, its archived-change
  warnings clear without deleting the sprint's own change-membership record. An archived change
  inside a still-live (non-closed) sprint keeps its warning, since that is real, actionable drift.
- The decision that the groom workflow is mirror state's "only writer" is amended: groom owns
  judgment, `spego sync` owns the mechanical subset. Both remain the only two writers; neither
  writes into `openspec/`.

## Capabilities

### Modified Capabilities

- `delivery-mirror`: a new "Synchronize mirror state" requirement defines `spego sync`'s
  reconciliation actions and idempotence; the existing "Report drift warnings" requirement is
  amended so `archived-in-sprint` does not fire for a closed sprint.
- `agent-command-surface`: a new `sync` command entry, following the same dual-output,
  no-interactive-prompt conventions as every other command.

### New Capabilities

None.

## Impact

- Affected source: `src/delivery/sync.ts` (new, pure `deriveSyncPlan`), `src/cli/commands/sync.ts`
  (new command), `src/cli.ts` (register), `src/command-meta/registry.ts` (metadata entry),
  `src/delivery/mirror.ts` (`archived-in-sprint` gated on sprint status), `src/workflows/registry.ts`
  (groom's phase 2 delegates the mechanical subset to `spego sync`).
- Behavior change: **this is not `--json`-neutral**, unlike the companion `refine-board-rendering`
  change. Suppressing `archived-in-sprint` for closed sprints changes the `warnings` array in
  every command's `--json` output, changes `MirrorChange.warnings` for affected changes, and drops
  `spego status`'s reported drift count for that code (`DRIFT_CODES` in
  `src/cli/commands/workspace.ts` already includes it). This is the intended fix for the
  warning-volume problem, but it is an agent-facing contract change and is called out here
  explicitly rather than assumed byte-for-byte stable.
- Docs: `.spego/artifacts/decision/mirror-state-per-epic-markdown-derived-graph-groom-sole-writer.md`
  amended via `spego update --expected-revision` (not hand-edited); `CONTEXT.md`'s **Groom** entry;
  `README.md`'s adapter read-only paragraph (disambiguate `spego sync` from OpenSpec's own
  `sync`/`/opsx:sync`) and its groom-confirmation paragraph (scope "sprint closes require
  confirmation" to the groom workflow; `spego sync` closes deterministically, previewable with
  `--dry-run`); `CHANGELOG.md` `[Unreleased]`.
- Tests: `test/delivery-sync.test.ts` (new), `test/cli.sync.test.ts` (new),
  `test/delivery-mirror.test.ts` (the exact-ordered-warning-code-list assertion moves to reflect
  the closed-sprint gate on `archived-in-sprint`).
