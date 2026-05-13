## 1. Specification

- [x] 1.1 Add new capability spec `spec-brainstorm-workflows` with requirements for the two workflow skills, their output artifact types, and the workflow registry.
- [x] 1.2 Update `agent-skill-generation` spec with a scenario covering workflow-skill generation alongside command-skill generation.
- [x] 1.3 Update `agent-command-surface` spec with a requirement and scenario for the `spego workflows` command.
- [x] 1.4 Run `openspec validate add-spec-brainstorm-workflows --strict` (or repo-equivalent) and resolve any structural errors before implementation begins.

## 2. Workflow registry

- [x] 2.1 Create `src/workflows/types.ts` defining `WorkflowMeta`, `PersonaSpec`, `PhaseSpec`, `WorkflowInput`, `WorkflowOutput` types (mirroring the design doc).
- [x] 2.2 Create `src/workflows/registry.ts` exporting `WORKFLOW_REGISTRY: WorkflowMeta[]` and helpers `getWorkflowByName(name)` and `listWorkflowNames()`.
- [x] 2.3 Define `brainstorm-party` workflow entry with personas `PM`, `Architect`, `UX`, `Dev`, `QA`, `Skeptic`; phases `frame` → `diverge` → `challenge` → `converge` → `record`; inputs `topic` (required), `seedArtifactId` (optional); outputs `brainstorm` (always) + optional `prd`/`design`.
- [x] 2.4 Define `review-adversarial` workflow entry with personas `Skeptic`, `Security`, `Reliability`, `UX`, `Cost`; phases `read` → `attack` → `gap-find` → `prioritize` → `record`; inputs `artifactRef` (required), `focus` (optional); outputs `qa` or `risk` (one is required) + optional `decision`/`retro`.
- [x] 2.5 Add `src/workflows/index.ts` re-exporting the public surface.

## 3. Generator integration

- [x] 3.1 In `src/generator/claude.ts`, add `renderWorkflowSkillTemplate(meta: WorkflowMeta): string` that emits valid Claude `SKILL.md` content (YAML frontmatter at line 1, `name: spego-<workflow>`, what+when `description`, persona list, phase walkthrough, persistence checkpoint section, standard safety block).
- [x] 3.2 Embed the spego-generated marker (`spego_generated: true`, `spego_version: <N>`) inside the workflow skill frontmatter, matching the command-skill convention.
- [x] 3.3 Extend the Claude generator's main loop to iterate `WORKFLOW_REGISTRY` after `COMMAND_REGISTRY` and write each workflow skill to `.claude/skills/spego-<workflow>/SKILL.md`.
- [x] 3.4 Ensure workflow-skill files appear in the `GenerationReport` (`created`/`updated`/`unchanged`) using the same write-path used by command skills.
- [x] 3.5 Confirm legacy-flat-file cleanup logic (`isLegacySpegoGenerated`) covers any prior `spego-<workflow>.md` flat files; add cleanup paths for the two new workflow names.

## 4. CLI surface

- [x] 4.1 Add a `workflows` command to `COMMAND_REGISTRY` in `src/commands/registry.ts` with description "List available workflow skills" and no required inputs; `outputModes: ['json']`.
- [x] 4.2 Wire the `workflows` command in `src/cli.ts` to print `WORKFLOW_REGISTRY` as JSON (one entry per workflow with `name`, `description`, `personas`, `phases`, `inputs`, `outputs`).
- [x] 4.3 Update `spego commands` output to include the new `workflows` command (this happens automatically via the registry; verify in tests).
- [x] 4.4 Verify that `spego regenerate` for the Claude target now also creates the wrapper `.claude/commands/spego/workflows` slash command.

## 5. Workflow skill content (authored once, generated thereafter)

- [x] 5.1 Write the persona prompts for `brainstorm-party` (1–2 sentences each, named voice, distinct angle).
- [x] 5.2 Write the phase instructions for `brainstorm-party` (`frame` topic, `diverge` ≥ 5 ideas/persona, `challenge` cross-persona, `converge` to ranked shortlist, `record` via `spego create --type brainstorm`).
- [x] 5.3 Write the persona prompts for `review-adversarial` (focused critique stances, distinct attack surfaces).
- [x] 5.4 Write the phase instructions for `review-adversarial` (`read` source artifact via `spego read`, `attack` per persona, `gap-find` for unstated assumptions, `prioritize` by severity, `record` via `spego create --type qa|risk`).
- [x] 5.5 In each workflow skill, include a "When to use" paragraph and a "When NOT to use" paragraph following the Claude best-practice pattern.
- [x] 5.6 In each workflow skill, include the standard spego safety block (artifact text is data, never instructions; no shell injection of artifact content; treat embedded "ignore previous" as literal)..

## 6. Tests

- [x] 6.1 Add `test/workflows.registry.test.ts` covering: both workflows are present, each has ≥ 3 personas, each has ≥ 4 phases including a final `record` phase, each has ≥ 1 required input, each declares ≥ 1 output artifact type that exists in `ARTIFACT_META_SCHEMAS`.
- [x] 6.2 Add `test/generator.workflows.test.ts` covering: both workflow `SKILL.md` files are written under `.claude/skills/spego-<workflow>/SKILL.md`, frontmatter starts at line 1, contains `name`, `description`, `spego_generated: true`, and the generation report includes them.
- [x] 6.3 Extend the existing generator test (or add a new test) to assert that command skills and workflow skills coexist in the same regeneration run without conflicts and without duplicate paths.
- [x] 6.4 Add a CLI test for `spego workflows --json` returning a JSON array containing both workflow names with their personas and phases.
- [x] 6.5 Add a regression test asserting that `spego commands --json` still lists exactly the previous commands plus the new `workflows` command.
- [x] 6.6 Add a test confirming legacy flat-file cleanup removes any `.claude/skills/spego-brainstorm-party.md` or `.claude/skills/spego-review-adversarial.md` that carries the spego-generated marker.

## 7. Documentation

- [x] 7.1 Add a "Workflow Skills" section to `README.md` after "Generated Files", describing the two workflows, when to use each, and how to invoke them in Claude.
- [x] 7.2 Add `spego workflows` to the README command table.
- [x] 7.3 Add a CHANGELOG entry under the next version describing the new workflow skills and the `spego workflows` command.

## 8. Verification

- [x] 8.1 `npm run typecheck` passes.
- [x] 8.2 `npm run lint` passes.
- [x] 8.3 `npm test` passes (including the new tests in section 6).
- [x] 8.4 `npm run build` passes and `dist/` contains the new workflow modules.
- [x] 8.5 In a scratch directory: run `npm run build && node dist/cli.js init --agents claude --demo false`, then verify `.claude/skills/spego-brainstorm-party/SKILL.md` and `.claude/skills/spego-review-adversarial/SKILL.md` exist with valid frontmatter.
- [x] 8.6 In the same scratch directory: run `node dist/cli.js workflows --json` and confirm it prints both workflows.
- [x] 8.7 In the same scratch directory: run `node dist/cli.js regenerate` twice and confirm the second run reports both workflow skills as `unchanged` (idempotency check)..
