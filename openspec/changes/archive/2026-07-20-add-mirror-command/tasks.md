## 1. Derivation module (TDD)

- [x] 1.1 Failing tests: blocker matrix — dep done/pending × same/earlier/later/unscheduled sprint; unscheduled uncompleted dep blocks
- [x] 1.2 Failing tests: warning taxonomy — dangling-dep, dep-cycle (no infinite loop), ungroomed-change, orphan-epic (archived vs missing), archived-in-sprint, closable-sprint
- [x] 1.3 Failing tests: missing artifacts = requires − resolvable links; unresolvable link counts as missing
- [x] 1.4 Failing tests: next-change — active-sprint list order, skip blocked, fall back to first planned sprint, none → no suggestion
- [x] 1.5 Failing tests: empty workspace degrades to adapter view + ungroomed warnings
- [x] 1.6 Implement derivation module; all green

## 2. CLI command

- [x] 2.1 `spego mirror --json`: deterministic shape (sprints, ungrouped, warnings, next)
- [x] 2.2 Human board render; `--graph` and `--gaps` focus views
- [x] 2.3 Register in command metadata registry; human/JSON parity

## 3. E2E (tests-after)

- [x] 3.1 `spawnCli` specs: fixture workspace board, `--json` shape incl. warnings, `--graph`/`--gaps`, empty workspace, workspace without `openspec/`

## 4. Docs

- [x] 4.1 README commands table + mirror section; CHANGELOG `[Unreleased]` Added entry
