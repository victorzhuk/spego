## Context

The groom workflow is a phased instruction set in `src/workflows/registry.ts`; its `plan` phase is one instruction string, rendered into the generated `spego-groom` skill and mirrored in `docs/workflows.md`. The board already renders changes without a sprint as `Ungrouped`, so a backlog needs no new state. The registry test pins each workflow's shape (personas, phase names, inputs, outputs, safety) but not phase text.

## Goals / Non-Goals

**Goals:**
- One sprint scheduled per groom session by default; every other pending change stays a backlog epic.
- The next sprint is formed at the groom after the scheduled one closes; more sprints in one session only on explicit request.
- The registry text, the generated skill and the docs say the same thing, pinned by a test.

**Non-Goals:**
- No CLI, board, sync or schema change. No new artifact field. No change to how a sprint-plan is written or closed.

## Decisions

- **Pin the default with substring assertions on the plan instruction**, inside the existing `groom has expected shape` case, read through `getWorkflowByName('groom')`. Alternative: a separate test file — rejected, the shape test is where every other groom invariant lives.
- **Rewrite the instruction, keep its tail.** The persistence sentence (`spego --json create --type sprint-plan` / `--expected-revision`) and the "closed mechanically by `spego sync`" sentence stay verbatim; only the grouping sentence changes.
- **No red stage.** The apply harness seals `_test.go` files only, so a TypeScript red stage cannot be sealed; `ts-coder` writes the assertions first, runs them red, then edits the instruction, and the narrowed runner is the red/green evidence. Both seams carry `NO-RED-WAIVER` and `NO-TESTER-WAIVER` with that reason.
- **Two parallel chunks.** Registry + test in the integration worktree; docs + changelog on shard `docs`. Disjoint files, merged back before the floor.

## Risks / Trade-offs

- The five asserted substrings must be reproduced character for character (backticked `sprint-plan`, ASCII apostrophe in `user's`); the target instruction text is spelled in the contract so the coder copies, not paraphrases.
- The retained tail sentences are not asserted; they are forbidden-to-drop in the contract and checked by reading the diff at review.
- `npm test` runs a build first (`pretest`); chunk verify calls the runner binary directly so the loop never rebuilds `dist`.

## Implementation plan

Base `584f9edc` on `master`. Tier **light** (four open tasks, two of them one-line prose edits, four files, no risk signal). Mode **existing-service-strict**. Lenses: `spec`. Coder rules for a foreign agent: work only in the worktree named in the prompt, never in the primary checkout; commit with a Conventional Commits subject ≤72 chars and body lines ≤100; never touch `openspec/`; a contract assertion once written is read-only for the code task.

**c1-registry** — tasks 1.1, 1.2 — `parallel`, integration worktree — coder `ts-coder` — seam `groom-plan-instruction`.
- Sites: `test/workflows.registry.test.ts` / `groom has expected shape` / anchor `expect(safety).toContain('--expected-revision');` — bind `const plan = wf.phases.find((p) => p.name === 'plan')!.instruction;` after it and add five `expect(plan).toContain(...)` assertions. `src/workflows/registry.ts` / `GROOM.phases[3].instruction` / anchor `'Propose sprint grouping as releasable, testable units. Create or update `sprint-plan` artifacts via` — replace the whole string.
- Contract: the assertions check, verbatim, `one sprint by default`, `the first releasable, testable unit`, ``stays in the backlog as an epic without a `sprint-plan` ``, `only on the user's explicit request`, `after the scheduled sprint closes`. Target instruction: *Schedule one sprint by default: the first releasable, testable unit. Every other pending change stays in the backlog as an epic without a `sprint-plan`. Form the next sprint at the groom after the scheduled sprint closes; offer more than one sprint in the same session only on the user's explicit request. Create or update `sprint-plan` artifacts via `spego --json create --type sprint-plan` or `spego --json update --id <sprint-plan id> --expected-revision <current revision>` after user confirmation. Finished sprints are closed mechanically by `spego sync`, not here.* Forbidden: dropping either tail sentence; touching GROOM's phases, personas, inputs, outputs, safety; reading the instruction other than through `getWorkflowByName('groom')`.
- Order: assertions first (run red), then the instruction (run green). Waivers: `NO-RED-WAIVER` / `NO-TESTER-WAIVER` — harness seals `_test.go` only.
- Red evidence: the coder packet quotes the failing narrowed run (five assertions) before task 1.2; the registry literal is single-quoted, so the apostrophe in `user's` is written `\'`.
- Verify: `timeout 5m npx vitest run test/workflows.registry.test.ts --maxWorkers=50% && timeout 5m npx eslint src/workflows/registry.ts test/workflows.registry.test.ts --max-warnings 0`

**c2-docs** — tasks 2.1, 2.2 — `parallel`, shard `docs` — coder `zpatcher` — seam `groom-plan-docs-changelog`.
- Sites: `docs/workflows.md` / groom list item 4 / anchor ``4. `plan` — propose releasable, testable sprint groupings and create or update `sprint-plan` artifacts after confirmation.`` — replace the line with: *4. `plan` — schedule one sprint by default, the first releasable, testable unit, and create or update its `sprint-plan` after confirmation; every other pending change stays in the backlog as an epic without a `sprint-plan`. The next sprint is formed at the groom after that sprint closes; more than one sprint in the same session only on the user's explicit request.* `CHANGELOG.md` / anchor `## [Unreleased]` — insert `### Changed` and one bullet: *The groom `plan` phase schedules one sprint by default — the first releasable, testable unit — and leaves every other pending change in the backlog as an epic without a `sprint-plan`. The next sprint is formed at the groom after that sprint closes; more than one sprint in the same session only on the user's explicit request.*
- Waivers: `NO-RED-WAIVER` / `NO-TESTER-WAIVER` — mechanical prose, no runtime reader.
- Verify: `grep -c 'one sprint by default' docs/workflows.md && sed -n '/^## \[Unreleased\]/,/^## \[0.24.0\]/p' CHANGELOG.md | grep -c 'one sprint by default'`

**Floor:** `timeout 5m npm run lint && timeout 5m npm run typecheck && timeout 10m npm test -- --maxWorkers=50%`

**Requirements map:** the three new SHALL clauses of the modified `Groom delivery mirror state` requirement (schedule one sprint by default; leave every other pending change in the backlog; further sprints at a later groom or on explicit request) → `groom has expected shape`.

**Plan review:** pass, zarchitect, one round, no blockers; nine warnings folded in above (scoped changelog verify, red evidence in the coder packet, apostrophe escaping, timeouts on verify, two extra SHALL rows).

## Plan appendix

```json
{
  "v": 2,
  "change": "groom-one-sprint-default",
  "baseSha": "584f9edc39a2be43741ebae2bff2e9374cfa6dc2",
  "generatedAt": "2026-09-05T18:00:00Z",
  "tier": "light",
  "mode": "existing-service-strict",
  "lenses": [
    "spec"
  ],
  "chunks": [
    {
      "id": "c1-registry",
      "taskIds": [
        "1.1",
        "1.2"
      ],
      "prev": null,
      "sharedPkg": null,
      "parallel": true,
      "seam": "groom-plan-instruction",
      "shard": "",
      "pkgDirs": [
        "test"
      ],
      "pkgs": [],
      "sites": [
        {
          "task": "1.1",
          "file": "test/workflows.registry.test.ts",
          "symbol": "groom has expected shape",
          "anchor": "expect(safety).toContain('--expected-revision');",
          "change": "After this line, inside the same case: bind `const plan = wf.phases.find((p) => p.name === 'plan')!.instruction;` and add five `expect(plan).toContain(...)` assertions with the exact substrings from the seam contract. Red before 1.2."
        },
        {
          "task": "1.2",
          "file": "src/workflows/registry.ts",
          "symbol": "GROOM.phases[3].instruction",
          "anchor": "'Propose sprint grouping as releasable, testable units. Create or update `sprint-plan` artifacts via",
          "change": "Replace the whole single-quoted instruction string with the target text in the seam contract (transition 'all five assertions above'), keeping the persistence and sync sentences. Green after."
        }
      ],
      "contract": {
        "states": [
          "instruction-current: the checked-in plan instruction ('Propose sprint grouping as releasable, testable units. …')",
          "instruction-target: the rewritten instruction containing the five asserted substrings plus the retained persistence and sync sentences",
          "test-case: `groom has expected shape` extended with the plan-instruction assertions"
        ],
        "transitions": [
          {
            "input": "assertion `expect(plan).toContain('one sprint by default')`",
            "state": "instruction-current",
            "effect": "forced",
            "evidence": "red — substring absent from src/workflows/registry.ts plan instruction; spec delta 'SHALL schedule one sprint by default — the first releasable, testable unit'"
          },
          {
            "input": "assertion `expect(plan).toContain('the first releasable, testable unit')`",
            "state": "instruction-current",
            "effect": "forced",
            "evidence": "red — the current text says 'as releasable, testable units'"
          },
          {
            "input": "assertion `expect(plan).toContain('stays in the backlog as an epic without a `sprint-plan`')`",
            "state": "instruction-current",
            "effect": "forced",
            "evidence": "red — 'backlog' absent; spec delta 'SHALL leave every other pending change in the backlog as an epic without a `sprint-plan`'"
          },
          {
            "input": "assertion `expect(plan).toContain(\"only on the user's explicit request\")`",
            "state": "instruction-current",
            "effect": "forced",
            "evidence": "red — 'explicit request' absent; spec delta 'or in the same session only on the user's explicit request'"
          },
          {
            "input": "assertion `expect(plan).toContain('after the scheduled sprint closes')`",
            "state": "instruction-current",
            "effect": "forced",
            "evidence": "red — absent; spec delta 'further sprints SHALL be formed at a later groom, after the scheduled sprint closes'"
          },
          {
            "input": "all five assertions above",
            "state": "instruction-target",
            "effect": "set",
            "evidence": "task 1.2 rewrites the instruction to: 'Schedule one sprint by default: the first releasable, testable unit. Every other pending change stays in the backlog as an epic without a `sprint-plan`. Form the next sprint at the groom after the scheduled sprint closes; offer more than one sprint in the same session only on the user's explicit request. Create or update `sprint-plan` artifacts via `spego --json create --type sprint-plan` or `spego --json update --id <sprint-plan id> --expected-revision <current revision>` after user confirmation. Finished sprints are closed mechanically by `spego sync`, not here.'"
          },
          {
            "input": "existing assertions in `groom has expected shape` (personas, phase names, optional inputs, epic and sprint-plan outputs, safety substrings)",
            "state": "instruction-target",
            "effect": "no-op",
            "evidence": "test/workflows.registry.test.ts — only an instruction string changes"
          },
          {
            "input": "existing cross-workflow cases (13 registered workflows, ≥3 phases each with a terminal phase)",
            "state": "instruction-target",
            "effect": "no-op",
            "evidence": "test/workflows.registry.test.ts — no phase added or removed"
          }
        ],
        "forbidden": [
          "a plan instruction that drops the persistence sentence (`spego --json create --type sprint-plan`, `--expected-revision <current revision>`, 'after user confirmation')",
          "a plan instruction that drops 'Finished sprints are closed mechanically by `spego sync`, not here.'",
          "any change to GROOM's phase names, order, personas, inputs, outputs or safety",
          "any change to another workflow's phases or to WORKFLOW_REGISTRY order",
          "reading the instruction in the test through anything but `getWorkflowByName('groom')`",
          "an unescaped apostrophe inside the single-quoted registry literal — write `user\\'s` (or switch that one literal to double quotes); the runtime string must still contain \"only on the user's explicit request\""
        ],
        "seeding": [
          "instruction-current: the checked-in src/workflows/registry.ts as is; the coder runs the narrowed runner after writing the five assertions and quotes the red result (5 failed assertions in `groom has expected shape`) in its packet before touching the instruction",
          "instruction-target: task 1.2 edits only the instruction string literal; the same command passes",
          "test-case: `const plan = wf.phases.find((p) => p.name === 'plan')!.instruction;` inserted after the `--expected-revision` safety assertion, followed by the five `expect(plan).toContain(...)` lines"
        ],
        "budgets": [
          "sprints scheduled per groom session by default: 1",
          "new assertions in `groom has expected shape`: 5",
          "files touched by the seam: 2",
          "WORKFLOW_REGISTRY length stays 13; GROOM phases stay 5",
          "narrowed runner run: under 45000 ms per test, workers capped at 50%"
        ]
      },
      "redTasks": [],
      "codeTasks": [
        "1.1",
        "1.2"
      ],
      "redTests": [],
      "redRun": "",
      "verify": "timeout 5m npx vitest run test/workflows.registry.test.ts --maxWorkers=50% && timeout 5m npx eslint src/workflows/registry.ts test/workflows.registry.test.ts --max-warnings 0",
      "coder": "ts-coder"
    },
    {
      "id": "c2-docs",
      "taskIds": [
        "2.1",
        "2.2"
      ],
      "prev": null,
      "sharedPkg": null,
      "parallel": true,
      "seam": "groom-plan-docs-changelog",
      "shard": "docs",
      "pkgDirs": [],
      "pkgs": [],
      "sites": [
        {
          "task": "2.1",
          "file": "docs/workflows.md",
          "symbol": "groom phase list item 4",
          "anchor": "4. `plan` — propose releasable, testable sprint groupings and create or update `sprint-plan` artifacts after confirmation.",
          "change": "Replace this one line with the docs-target text in the seam contract; keep the `N. \\`phase\\` — sentence.` list shape."
        },
        {
          "task": "2.2",
          "file": "CHANGELOG.md",
          "symbol": "[Unreleased]",
          "anchor": "## [Unreleased]",
          "change": "Insert after the heading: blank line, `### Changed`, the one bullet from the seam contract's changelog-target, blank line before `## [0.24.0]`."
        }
      ],
      "contract": {
        "states": [
          "docs-current: docs/workflows.md groom item 4 reads 'propose releasable, testable sprint groupings and create or update `sprint-plan` artifacts after confirmation.'",
          "docs-target: docs/workflows.md groom item 4 reads '4. `plan` — schedule one sprint by default, the first releasable, testable unit, and create or update its `sprint-plan` after confirmation; every other pending change stays in the backlog as an epic without a `sprint-plan`. The next sprint is formed at the groom after that sprint closes; more than one sprint in the same session only on the user's explicit request.'",
          "changelog-current: `## [Unreleased]` followed directly by `## [0.24.0] - 2026-09-04` (empty section)",
          "changelog-target: `### Changed` under `## [Unreleased]` with one bullet: '- The groom `plan` phase schedules one sprint by default — the first releasable, testable unit — and leaves every other pending change in the backlog as an epic without a `sprint-plan`. The next sprint is formed at the groom after that sprint closes; more than one sprint in the same session only on the user's explicit request.'"
        ],
        "transitions": [
          {
            "input": "task 2.1 edit",
            "state": "docs-current",
            "effect": "set",
            "evidence": "docs/workflows.md groom item 4 → docs-target; spec delta MODIFIED requirement"
          },
          {
            "input": "task 2.2 edit",
            "state": "changelog-current",
            "effect": "set",
            "evidence": "CHANGELOG.md [Unreleased] → changelog-target; Keep a Changelog shape as in the 0.24.0 entry"
          },
          {
            "input": "full floor (lint, typecheck, test)",
            "state": "docs-target",
            "effect": "no-op",
            "evidence": "package.json — eslint scope is `src test`; markdown is neither linted nor imported"
          }
        ],
        "forbidden": [
          "touching any docs/workflows.md line other than the groom item 4",
          "adding the changelog bullet under a released version heading, or bumping package.json version",
          "a changelog bullet describing CLI, board or sync behavior changes — none exist"
        ],
        "seeding": [
          "docs-target: single-line replacement of the groom item 4",
          "changelog-target: insert `### Changed` + bullet between `## [Unreleased]` and the blank line before `## [0.24.0]`"
        ],
        "budgets": [
          "docs lines changed: 1",
          "changelog lines added: 3 (blank, heading, bullet)",
          "changelog bullets added: 1"
        ]
      },
      "redTasks": [],
      "codeTasks": [
        "2.1",
        "2.2"
      ],
      "redTests": [],
      "redRun": "",
      "verify": "grep -c 'one sprint by default' docs/workflows.md && sed -n '/^## \\[Unreleased\\]/,/^## \\[0.24.0\\]/p' CHANGELOG.md | grep -c 'one sprint by default'",
      "coder": "zpatcher"
    }
  ],
  "seams": [
    {
      "id": "groom-plan-instruction",
      "tasks": [
        "1.1",
        "1.2"
      ],
      "summary": "NO-RED-WAIVER: TypeScript seam — the harness seals only _test.go and lists tests through go test, so there is no sealed red stage; ts-coder writes the five assertions first, runs the narrowed runner red, then rewrites the registry instruction. NO-TESTER-WAIVER: closure is the chunk's literal verify command (narrowed runner + eslint on the two files) plus the floor. The plan phase instruction states the one-sprint default, the backlog rule and the explicit-request exception; asserted by substring on getWorkflowByName('groom')!.phases.find((p) => p.name === 'plan')!.instruction inside `groom has expected shape`.",
      "contract": {
        "states": [
          "instruction-current",
          "instruction-target",
          "test-case"
        ],
        "transitions": [],
        "forbidden": [],
        "seeding": []
      },
      "redTasks": [],
      "codeTasks": [
        "1.1",
        "1.2"
      ]
    },
    {
      "id": "groom-plan-docs-changelog",
      "tasks": [
        "2.1",
        "2.2"
      ],
      "summary": "NO-RED-WAIVER: mechanical prose in docs/workflows.md and CHANGELOG.md with no runtime reader. NO-TESTER-WAIVER: verified by the chunk's grep command, the diff read at review, and the full floor.",
      "contract": {
        "states": [
          "docs-current",
          "docs-target",
          "changelog-current",
          "changelog-target"
        ],
        "transitions": [],
        "forbidden": [],
        "seeding": []
      },
      "redTasks": [],
      "codeTasks": [
        "2.1",
        "2.2"
      ]
    }
  ],
  "requirements": [
    {
      "shall": "During plan, the workflow SHALL schedule one sprint by default",
      "tests": [
        "groom has expected shape"
      ]
    },
    {
      "shall": "SHALL leave every other pending change in the backlog as an epic without a `sprint-plan`",
      "tests": [
        "groom has expected shape"
      ]
    },
    {
      "shall": "further sprints SHALL be formed at a later groom, after the scheduled sprint closes",
      "tests": [
        "groom has expected shape"
      ]
    }
  ],
  "testHarness": [
    "WORKFLOW_REGISTRY — src/workflows/registry.ts:424 — `export const WORKFLOW_REGISTRY: WorkflowMeta[]` (13 entries; GROOM at 369-422)",
    "getWorkflowByName — src/workflows/registry.ts:440 — `export function getWorkflowByName(name: string): WorkflowMeta | undefined`",
    "listWorkflowNames — src/workflows/registry.ts:444 — `export function listWorkflowNames(): string[]`",
    "ARTIFACT_META_SCHEMAS — src/artifacts/schemas.ts — imported at test/workflows.registry.test.ts:3 for the known-artifact-type check",
    "test/workflows.registry.test.ts imports only vitest, ../src/workflows/registry.js, ../src/artifacts/schemas.js — nothing from test/helpers.ts"
  ],
  "floor": "timeout 5m npm run lint && timeout 5m npm run typecheck && timeout 10m npm test -- --maxWorkers=50%",
  "planRulings": [
    "Tier light with four open tasks: two are one-line prose edits, four files, no risk signal — the ≤3 rule's intent, not its letter.",
    "No red stage on either seam: the kernel's seal/guard covers _test.go only, so a TypeScript red stage cannot be sealed; ts-coder authors the assertions in the same chunk and the narrowed runner is the red/green evidence.",
    "Two parallel chunks: c1-registry in the integration worktree, c2-docs on shard `docs` — disjoint files, merged back before the floor.",
    "Red evidence without a sealed red stage: the c1 coder packet quotes the failing narrowed run (five assertions) before task 1.2; a packet without it is an incomplete chunk at verify."
  ],
  "planReview": {
    "verdict": "pass",
    "reviewer": "zarchitect",
    "rounds": 1
  }
}
```
