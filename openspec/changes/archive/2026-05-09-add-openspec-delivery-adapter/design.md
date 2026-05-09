## Context

spego owns product orchestration artifacts. OpenSpec owns change proposals, delta specs, tasks, implementation, verification, sync, and archive. The adapter lets spego reference delivery work without becoming a second task tracker.

## Goals / Non-Goals

**Goals:**

- Define a read-oriented delivery adapter contract.
- Implement OpenSpec as the default adapter.
- Expose `/spego:epics` and `/spego:tasks` as list/get views over adapter data.
- Store stable external references in spego artifacts.

**Non-Goals:**

- No task mutation in OpenSpec through spego in the MVP.
- No replacement for `/opsx:apply`, `/opsx:verify`, `/opsx:archive`, or OpenSpec validation.
- No support for non-OpenSpec adapters until the contract is proven.

## Decisions

### Adapter contract is read-oriented

The MVP adapter supports `listEpics`, `getEpic`, `listTasks`, and `getTask`. Status is embedded in epic and task summaries rather than exposed as a separate method. Writes remain in the owning delivery tool.

Alternative considered: full CRUD adapter. That increases scope and risks conflicting task state between tools.

### OpenSpec mapping uses change folders

OpenSpec changes map to spego epic links. `tasks.md` sections map to task summaries. Specs and proposal/design files provide context links.

Alternative considered: invent a separate epics file in spego. That duplicates OpenSpec's change context.

### Failures are explicit

The adapter returns typed errors for missing OpenSpec config, invalid change folders, missing tasks, and validation failures. spego commands surface those errors as markdown or JSON.

Alternative considered: silently return empty lists. That hides broken delivery state from agents.

## Risks / Trade-offs

- OpenSpec task format changes → parse conservatively and prefer CLI/status output where available.
- Change folders are not always epics → expose them as delivery links/summaries, not canonical product epics.
- Read-only MVP may feel limited → preserve write operations for future adapter versions after the read contract stabilizes.

## Migration Plan

No migration exists. The adapter discovers `openspec/` in the current project and can be disabled or replaced in spego config.

## Open Questions

None for MVP planning.
