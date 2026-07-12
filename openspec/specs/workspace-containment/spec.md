# workspace-containment Specification

## Purpose
TBD - created by archiving change harden-workspace-symlink-containment. Update Purpose after archive.
## Requirements
### Requirement: Workspace root is resolved and symlink-free
The system SHALL resolve the workspace root via realpath when opening a workspace and SHALL reject a `.spego` directory, or any directory component under it, that is a symbolic link, returning a structured validation error naming the offending path.

#### Scenario: Symlinked .spego directory rejected at open
- **WHEN** `.spego` or `.spego/artifacts` or `.spego/artifacts/<type>` is a symbolic link and any engine command opens the workspace
- **THEN** the command fails with a structured error identifying the symlinked path
- **AND** no file inside or outside the workspace is created or modified

#### Scenario: Symlinked .spego rejected at init
- **WHEN** `spego init` runs in a project where `.spego` or one of its subdirectories exists as a symbolic link
- **THEN** init fails with a structured error identifying the symlinked path instead of silently reusing it

### Requirement: Writes stay inside the workspace root
The system SHALL verify, before every artifact or index write, that the fully resolved target path is contained within the resolved workspace root, and SHALL refuse the write with a structured error when the target escapes the root.

#### Scenario: Escaping write refused
- **WHEN** a write target resolves outside the workspace root (for example through a symlinked directory component)
- **THEN** the operation fails with a structured containment error
- **AND** no file is written outside the workspace root

### Requirement: Reads reject symlinked artifact entries
The system SHALL NOT follow symbolic links when reading artifact or revision files: symlinked entries under `.spego/artifacts` and `.spego/revisions` MUST be refused on direct reads and reported as invalid files during index rebuild rather than followed.

#### Scenario: Symlinked artifact file on read
- **WHEN** `spego read` or `spego view` targets an artifact whose on-disk file is a symbolic link
- **THEN** the command fails with a structured validation error and does not return the link target's content

#### Scenario: Symlinked entry during rebuild
- **WHEN** `spego index-rebuild` encounters a symlinked file under `.spego/artifacts` or `.spego/revisions`
- **THEN** rebuild continues, does not read through the link, and lists the entry in `invalidFiles` with a symlink-specific error

### Requirement: Failed atomic writes leave no temp files
The system SHALL remove its temporary file when an atomic write fails at any step before rename, not only when the rename itself fails.

#### Scenario: Write or fsync failure
- **WHEN** writing or syncing the temporary file fails during an atomic artifact write
- **THEN** the temporary file is removed before the error propagates

