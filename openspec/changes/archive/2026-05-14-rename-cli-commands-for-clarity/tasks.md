## 1. Specification

- [x] 1.1 Update the `agent-command-surface` capability spec with the new `skills` command and the alias contract.
- [x] 1.2 Update the `agent-skill-generation` capability spec with the new generated-path naming and the legacy-path cleanup.
- [x] 1.3 Run `openspec validate rename-cli-commands-for-clarity --strict` and resolve any structural errors before any code lands.

## 2. CLI command surface

- [x] 2.1 In `src/cli.ts`, add a new `skills` command with the same description and action handler as the current `regenerate` command.
- [x] 2.2 In `src/cli.ts`, retain `regenerate` as a hidden command (`.command('regenerate', { hidden: true })`) that delegates to the same action handler and emits a single deprecation warning to stderr in human mode (`deprecated: 'spego regenerate' is now 'spego skills'`).
- [x] 2.3 In `src/cli.ts`, ensure `--help` does not list `regenerate`.
- [x] 2.4 In `src/cli.ts`, ensure both commands honor the global `--json` flag and emit identical output payloads.

## 3. Command registry

- [x] 3.1 In `src/commands/registry.ts`, replace the existing `regenerate` entry (if any) with a `skills` entry: `name: 'skills'`, `slashName: '/spego:skills'`, `category: 'workspace'`, `outputModes: ['markdown', 'json']`.
- [x] 3.2 Confirm `spego commands` lists `skills` and does not list `regenerate`.

## 4. Generator updates

- [x] 4.1 In `src/generator/*.ts`, update the Claude target so the regenerated paths are `.claude/skills/spego-skills/SKILL.md` and `.claude/commands/spego/skills.md`.
- [x] 4.2 Add a cleanup pass: on every generation run, remove `.claude/skills/spego-regenerate/SKILL.md` and `.claude/commands/spego/regenerate.md` if they exist and carry the `spego_generated: true` marker.
- [x] 4.3 Cleanup MUST report the removed paths in the generation report under an `removed` action so the human and JSON output show the rename took effect.

## 5. Tests

- [x] 5.1 Add `test/cli.skills-command.test.ts` covering: (a) `spego skills` runs end-to-end and matches the previous `regenerate` output; (b) `spego regenerate` still works and writes the deprecation warning to stderr; (c) `spego --help` does not list `regenerate`; (d) `spego commands` lists `skills` and does not list `regenerate`.
- [x] 5.2 Add a generator test asserting the renamed paths exist after running `spego skills` and the legacy paths are removed when present.
- [x] 5.3 Add a regression test asserting that running the generator twice in a row reports the legacy paths as removed only on the first run.

## 6. Documentation

- [x] 6.1 Update README sections that mention `spego regenerate` to use `spego skills`.
- [x] 6.2 Add a CHANGELOG entry under "Changed" announcing the rename and the alias removal target (next minor release).
- [x] 6.3 Audit any in-repo skill or workflow files that reference `spego regenerate` and update them to `spego skills`.
