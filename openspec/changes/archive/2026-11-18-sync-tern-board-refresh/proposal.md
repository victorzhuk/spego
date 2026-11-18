## Why

The Tern board can show missing epics and finished sprints that still need reconciliation. Manual refresh should apply the same mechanical fixes as the CLI.

## What Changes

- Run `spego sync` before manual refresh from the toolbar or `r`.
- Report sync failures and reload the fresh board to show any completed writes.

## Capabilities

### Modified Capabilities

- `tern-delivery-board`: Manual refresh reconciles the delivery mirror before reading it.

## Impact

The Tern host, plugin documentation, and Luau scenarios change. Explicit refresh can write Spego artifacts.
