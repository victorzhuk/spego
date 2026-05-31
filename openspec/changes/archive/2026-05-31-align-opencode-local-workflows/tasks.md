## 1. OpenCode Workflow Templates

- [x] 1.1 Update `src/generator/opencode.ts` so `/spego-apply` describes current-session phases for change selection, context loading, task planning, execution, verification, task checkbox updates, and summary.
- [x] 1.2 Add OpenCode-native subagent guidance to `/spego-apply` that only allows subagents inside the active OpenCode session and forbids Spego-owned agent spawning, model selection, external sessions, daemons, and REST calls.
- [x] 1.3 Update `/spego-verify` and `/spego-explore` templates to consistently forbid daemon/API connections and use OpenCode-native or tool-neutral wording.
- [x] 1.4 Regenerate current `.opencode/commands/spego-*.md` assets after template updates.

## 2. Stale OpenCode Asset Cleanup

- [x] 2.1 Extend OpenCode generator cleanup paths to remove stale generated `.opencode/commands/opsx-*.md` and `.opencode/skills/openspec-*/SKILL.md` assets when they carry `spego_generated: true`.
- [x] 2.2 Preserve unmarked user-owned OpenCode command, skill, and agent files and report them as `skipped` in generation output.
- [x] 2.3 Normalize repository-owned OpenCode compatibility assets that remain in the repo so they do not mention `AskUserQuestion tool`, `TodoWrite tool`, `Skill tool`, or `subagent_type: "general-purpose"`.
- [x] 2.4 Remove or rewrite `ultracode/` daemon-oriented documentation/sample assets so current docs no longer teach `opencode serve`, OpenCode REST, or ultra-agent orchestration as Spego workflow setup.

## 3. Build and Package Hygiene

- [x] 3.1 Add a build clean step that removes `dist` before TypeScript compilation.
- [x] 3.2 Add verification that stale `dist/orchestration/` and `dist/cli/commands/orchestrate.*` files are absent after `npm run build`.
- [x] 3.3 Run `npm pack --dry-run` and verify the package does not include stale daemon-backed OpenCode orchestration files.

## 4. Regression Tests and Docs

- [x] 4.1 Add or update generator tests asserting generated OpenCode command bodies include current-session phase/subagent language and exclude `spego orchestrate`, `opencode serve`, OpenCode REST API configuration, daemon wording, and Claude-specific tool names.
- [x] 4.2 Add or update cleanup tests for stale generated OpenCode commands/skills and user-owned preservation.
- [x] 4.3 Update README/CHANGELOG wording if needed so the public docs consistently describe Spego as a local CLI and OpenCode workflows as active-instance commands.
- [x] 4.4 Run `openspec validate align-opencode-local-workflows --strict`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and `npm pack --dry-run`.
