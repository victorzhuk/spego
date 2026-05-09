## Why

spego should orchestrate product artifacts without owning detailed delivery execution. OpenSpec is the default execution plane, so spego needs an adapter that exposes epics and tasks as linked delivery metadata while leaving implementation state in OpenSpec.

## What Changes

- Add a pluggable delivery adapter contract.
- Add an OpenSpec adapter as the default implementation.
- Support list/get operations for epics, tasks, and related delivery metadata.
- Store adapter links and summaries in spego artifacts without copying full delivery state.
- Prevent spego from mutating detailed OpenSpec task implementation state in the MVP.
- Provide clear adapter errors when OpenSpec is missing, invalid, or has no matching change/spec.

## Capabilities

### New Capabilities

- `delivery-adapters`: Defines the read-oriented adapter contract for external delivery systems.
- `openspec-integration`: Reads OpenSpec changes, specs, tasks, and status for spego epics/tasks views.

### Modified Capabilities

None.

## Impact

- Adds adapter interfaces and an OpenSpec adapter module.
- Adds CLI/API commands for `/spego:epics` and `/spego:tasks`.
- Depends on OpenSpec files and CLI-compatible project layout.
- Keeps detailed implementation workflow under OpenSpec ownership.
