## MODIFIED Requirements

### Requirement: Provide help workflow skill
The system SHALL ship a `help` workflow skill that inspects workspace state via the existing read-only CLI commands and recommends the next required and optional steps.

#### Scenario: Active OpenSpec changes are prioritized
- **WHEN** the generated `spego-help` skill is rendered
- **AND** the inspected `spego epics --json` output includes active OpenSpec changes
- **THEN** its recommendation rubric includes combined OpenSpec and spego workflows before unrelated artifact-creation recommendations
- **AND** it maps brainstorm, review, verification-report, and retro needs to `spego-change-brainstorm`, `spego-change-review`, `spego-change-verify-report`, and `spego-change-retro`
- **AND** it preserves artifact-centric recommendations when no active OpenSpec changes exist
