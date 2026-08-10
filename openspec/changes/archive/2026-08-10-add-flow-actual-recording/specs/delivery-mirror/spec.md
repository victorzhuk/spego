# delivery-mirror Delta Specification

## ADDED Requirements

### Requirement: Record flow actuals
The system SHALL provide a `spego record` command that records one measured run against a change: the Flow that ran it and the Flow Hours it took, supplied by the caller rather than measured by spego. Recording SHALL append to the change's epic rather than replace what is already there, so a change delivered across several runs accumulates. The command SHALL persist through the existing artifact write path with optimistic concurrency, SHALL write nothing under `openspec/`, SHALL mutate no artifact other than the named change's epic, and SHALL fail with a named error when the change is unknown, when it has no epic, or when the supplied hours are negative or not finite. Derived output SHALL carry each change's recorded runs and their total alongside its estimates.

#### Scenario: Record a run
- **WHEN** a Flow records 1.75 hours against change `add-auth` under Flow `zapply`
- **THEN** the change's epic carries an entry naming that Flow and those hours
- **AND** `spego board --json` reports the run and a recorded total of 1.75 for the change

#### Scenario: A resumed change accumulates
- **WHEN** a second run of 0.5 hours is recorded against the same change
- **THEN** the epic carries both entries
- **AND** the reported total is 2.25

#### Scenario: Runs keep their flow attribution
- **WHEN** a change carries runs recorded under two different Flows
- **THEN** each entry reports the Flow that produced it
- **AND** the derived change reports both entries unmerged

#### Scenario: Unknown change
- **WHEN** a run is recorded against a change that does not exist, or against a change with no epic
- **THEN** the command fails with an error naming the change
- **AND** no artifact is written

#### Scenario: Invalid hours
- **WHEN** a run is recorded with negative or non-finite hours
- **THEN** the command fails with a validation error naming the value
- **AND** no artifact is written

#### Scenario: Concurrent recording
- **WHEN** two runs are recorded against one change and the second carries a stale expected revision
- **THEN** the second fails with a revision conflict
- **AND** the first run's entry is intact

#### Scenario: Recording touches nothing else
- **WHEN** a run is recorded in a workspace with several epics and sprint-plans
- **THEN** only the named change's epic is modified
- **AND** no file under `openspec/` is written
