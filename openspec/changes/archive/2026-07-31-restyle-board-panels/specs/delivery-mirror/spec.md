## MODIFIED Requirements

### Requirement: Render focused views
The system SHALL render a default human board and provide `--graph` (dependency edges) and `--gaps` (gap flags and missing artifacts) focus views, honoring the global `--json` flag with a deterministic shape in all modes. Every human view SHALL carry the `id` column. The default board SHALL group each sprint, the `Ungrouped` list, and the trailing `Warnings` table into a left-railed panel with its title embedded in the panel's top rule; the default board and `--graph` SHALL render a change's `completed` status as `archived` in the `status` column. Within a panel, a row for a change whose status is satisfied (`done` or `completed`) SHALL be struck through; a row that is merely blocked (not satisfied, with pending blockers) SHALL be dimmed instead, except when `--plain` is passed, the `NO_COLOR` env var is set, or stdout is not a TTY. The left-railed panel structure SHALL render under those same conditions regardless — only the bold/underline/strikethrough/dim decorations are gated, not the rail itself. `--json` output SHALL never carry ANSI codes and SHALL always report `completed`, not `archived`. Archived changes SHALL be excluded from the `ungrouped` list by default; the `--archived` flag SHALL restore them. This filtering SHALL NOT remove an archived change from a sprint's own `changes` list, so `archived-in-sprint` stays actionable.

#### Scenario: Gap focus
- **WHEN** an agent runs `spego board --gaps --json`
- **THEN** the output is limited to changes with gap flags or missing artifacts, plus warnings

#### Scenario: Plain output suppresses color
- **WHEN** an agent runs `spego board --plain` against a workspace with blocked changes
- **THEN** the rendered rows carry no ANSI escape codes

#### Scenario: Archived changes hidden from ungrouped by default
- **WHEN** an agent runs `spego board` in a workspace with an archived change that is not scheduled into any sprint
- **THEN** that change is absent from the `Ungrouped` list
- **AND** running `spego board --archived` includes it in `Ungrouped` again
- **AND** an archived change still scheduled into a sprint appears in that sprint's list either way

#### Scenario: Sprint sections are grouped by a left rail
- **WHEN** a user runs `spego board` in a workspace with at least one sprint
- **THEN** the sprint's title, change table, `Ungrouped` list, and `Warnings` table each render inside a left-railed panel
- **AND** the sprint's title is bolded and underlined

#### Scenario: Satisfied row is struck through
- **WHEN** a change's status is `done` or `completed`
- **THEN** its row in the human board is struck through

#### Scenario: Satisfied and blocked row is struck, not dimmed
- **WHEN** a change's status is satisfied (`done` or `completed`) and it still has pending blockers
- **THEN** its row is struck through
- **AND** its row is not additionally dimmed

#### Scenario: Human output shows the archived label, JSON keeps completed
- **WHEN** a change is archived, so its status resolves to `completed`
- **THEN** the human board and `--graph` views print `archived` in the `status` column
- **AND** the `--json` payload for the same board still reports `status: "completed"`

#### Scenario: Panel rail survives plain output
- **WHEN** an agent runs `spego board --plain` against a workspace with at least one sprint
- **THEN** the sprint section still renders inside a left-railed panel
- **AND** the panel carries no ANSI escape codes
