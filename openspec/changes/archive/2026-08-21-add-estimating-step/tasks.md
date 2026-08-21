# Tasks

## 1. Fork the schema

- [x] 1.1 Fork `spec-driven` into a project-local schema and confirm `openspec schema which` resolves to the project copy rather than the package
- [x] 1.2 Verify the forked schema validates unchanged before adding anything to it

## 2. Add the estimating step

- [x] 2.1 Add the estimating artifact to the forked schema: what a Size Tier means, that it sizes the change rather than the machinery, and that it is persisted through `spego update` onto the change's epic
- [x] 2.2 Require the step after the proposal, so the tier is judged once scope is settled and before tasks are written
- [x] 2.3 Validate the schema and author one change through it end to end, confirming the tier lands on the epic and the board prices it

## 3. Keep it optional

- [x] 3.1 Confirm a change authored without the fork still grooms normally and gets its tier from grooming
- [x] 3.2 Update the README authoring section and CHANGELOG `[Unreleased]`
