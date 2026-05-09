## 1. Adapter Contract

- [x] 1.1 Define delivery adapter interfaces for epics, tasks, status, and typed errors.
- [x] 1.2 Add spego config fields for adapter selection and adapter options.
- [x] 1.3 Implement default adapter resolution to OpenSpec.
- [x] 1.4 Reject unknown adapters with structured configuration errors.

## 2. OpenSpec Discovery

- [x] 2.1 Implement OpenSpec workspace detection from `openspec/config.yaml`.
- [x] 2.2 Implement active change discovery under `openspec/changes/`, excluding archive entries.
- [x] 2.3 Implement OpenSpec CLI status integration when available.
- [x] 2.4 Implement filesystem fallback when CLI status is unavailable.

## 3. OpenSpec Mapping

- [x] 3.1 Map OpenSpec changes to delivery epic link summaries.
- [x] 3.2 Parse `proposal.md` for titles and summaries.
- [x] 3.3 Parse `tasks.md` checklist items into task summaries.
- [x] 3.4 Classify task status from checked and unchecked checklist items.
- [x] 3.5 Report missing `tasks.md` as planning-incomplete status.

## 4. spego Commands

- [x] 4.1 Implement `/spego:epics list` and get behavior through the CLI/API.
- [x] 4.2 Implement `/spego:tasks list` and get behavior through the CLI/API.
- [x] 4.3 Return read-only rejection errors for delivery mutation attempts.
- [x] 4.4 Render adapter responses in markdown and JSON formats.

## 5. Tests

- [x] 5.1 Add tests for adapter selection and unknown adapter errors.
- [x] 5.2 Add tests for OpenSpec discovery success and missing-workspace errors.
- [x] 5.3 Add tests for change-to-epic mapping and task checklist parsing.
- [x] 5.4 Add tests for CLI status preference and filesystem fallback warnings.
