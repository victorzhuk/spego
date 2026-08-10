# Derive the first seed from sessions already on disk

## Why

Every rung above the seed needs runs that have not happened yet, so on day one the board prices from whatever numbers were typed into config. Those numbers do not have to be invented: agent sessions for this project are already recorded with per-message timestamps, and the changes they delivered are in the archive. Joining the two produces a seed measured from the real harness instead of guessed.

## What Changes

- A one-off script joins recorded agent sessions to archived changes by time window and branch, sums elapsed wall-clock per change, buckets by the Size Tier those changes would be judged at, and prints a `flows` block ready to paste into workspace config.
- The script is calibration scaffolding, not product code. It reads a vendor-specific session format, which is exactly what the CLI's design keeps out of the published package.
- Its output is reviewed before use: the join is heuristic, so a maintainer confirms the per-change attributions rather than trusting them wholesale.

No spec deltas — this change adds no behavior to spego. `skip_specs: true`.

Depends on `add-change-pricing` (the `flows` config shape it prints into).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None.

## Impact

- `scripts/` — the calibration script and a short usage note.
- Nothing under `src/`; the published package is unchanged.
- Docs: a paragraph in the README explaining where the first seed comes from and why the script is not part of the CLI.

Known limits, to be stated in the script's output rather than discovered later: recorded sessions for this project begin 2026-07-12, so the join reaches roughly the last dozen changes rather than all 29 archived ones, and sessions are finer-grained than changes — eight sessions against three changes on 2026-07-30 — so attribution is a judgment the output must expose, not hide.
