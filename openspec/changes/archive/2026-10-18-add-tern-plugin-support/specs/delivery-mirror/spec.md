## MODIFIED Requirements

### Requirement: Render the task progress column
The default board's change table SHALL carry exactly the columns `id`, `change`, `status`, `tasks`, `plan`, `hours`, and `signals`, with `tasks` and `plan` between `status` and `hours`. The `tasks` column SHALL carry progress as `done/total` — `0/5` when nothing is checked, `5/5` when all are, `0/0` for a known-empty plan, `—` when the plan is missing or unreadable. It SHALL replace `group` in the sprint tables and the `Ungrouped` list. `--json` SHALL still report the conflict track as `group`, preserving its existing meaning. `--json` SHALL also report optional `taskCount` and `tasksDone` numbers for each change when both counts are known and the task plan is readable, including `0` and `0` for a known-empty plan; both fields MUST be omitted when the plan is missing, unreadable, unknown, or archived without adapter data. Existing fields and their meanings are preserved; the two counts are an additive JSON extension.

#### Scenario: Tasks column shows progress, JSON keeps the track
- **WHEN** a pending change's epic carries `track: api-contract` and its task plan holds two checked items out of ten
- **THEN** the human board's `tasks` column reads `2/10`
- **AND** no `group` column appears in the sprint table or in the `Ungrouped` list
- **AND** no wave code (`g001`) or letter label (`A`) appears in human output
- **AND** the `--json` payload reports `group: "api-contract"` for the same change, preserving its existing meaning
- **AND** the `--json` payload reports `taskCount: 10` and `tasksDone: 2`

#### Scenario: Known-empty and unavailable task plans
- **WHEN** one change's task plan exists but holds no items
- **AND** another change has no readable task plan
- **THEN** the `tasks` cells read `0/0` and `—`
- **AND** the unavailable count never reads as zero progress
- **AND** the known-empty change reports `taskCount: 0` and `tasksDone: 0`
- **AND** the unreadable change omits both count fields

#### Scenario: JSON task counts cover omission classes
- **WHEN** `spego board --json` runs for changes with partial, complete, known-empty, missing, unreadable, unknown, and archived-without-adapter-data plans
- **THEN** partial and complete changes report both counts, including `0` and `0` for known-empty
- **AND** missing, unreadable, unknown, and archived-without-data changes omit both counts

## ADDED Requirements

### Requirement: Read fresh board inputs
spego board --fresh MUST read current canonical artifact metadata for that invocation instead of trusting indexed rows. It MUST preserve existing ordering, warnings, dependencies, estimates, and next derivation. It MUST NOT rebuild, synchronize, repair, or populate the persistent index.

#### Scenario: External metadata edit is reflected
- **WHEN** an epic's metadata changes on disk after the index was built
- **AND** `spego board --fresh --json` runs
- **THEN** the board reflects the edited metadata
- **AND** the indexed board from the same invocation does not

#### Scenario: Addition and removal are reflected
- **WHEN** a new epic or sprint plan is added or an existing one is removed on disk after indexing
- **AND** `spego board --fresh --json` runs
- **THEN** the board includes the addition and excludes the removal

#### Scenario: Soft deletion and links are reflected
- **WHEN** an epic's `deletedAt` changes or a sprint's `links` change on disk after indexing
- **AND** `spego board --fresh --json` runs
- **THEN** the board applies the changed deletion and link resolution

#### Scenario: Stale phantom index row is ignored
- **WHEN** the index contains a row for an artifact that no longer exists on disk
- **AND** `spego board --fresh --json` runs
- **THEN** that phantom change does not appear in the output

#### Scenario: Absent or empty index works
- **WHEN** `.spego/index/` is absent or empty
- **AND** `spego board --fresh --json` runs
- **THEN** the board derives the same content as when the index exists

#### Scenario: Malformed canonical input fails
- **WHEN** a canonical artifact file has invalid frontmatter or escapes its containment root
- **AND** `spego board --fresh --json` runs
- **THEN** the command fails with the existing structured error
- **AND** no indexed fallback is returned

#### Scenario: Duplicate canonical IDs fail
- **WHEN** two canonical artifact files declare the same artifact id
- **AND** `spego board --fresh --json` runs
- **THEN** the command fails with VALIDATION_FAILED

#### Scenario: Incompatible flag combination fails
- **WHEN** `spego board --fresh --sync --json` runs
- **THEN** the command fails with VALIDATION_FAILED and message `--fresh cannot be combined with --sync`
- **AND** no index is created or synchronized
