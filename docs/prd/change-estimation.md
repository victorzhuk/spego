# Change Estimation — PRD

## Problem statement

The board answers what to pick up and what is blocking it, but never how long anything takes. A maintainer planning a Sprint cannot say when it will be done, cannot tell whether a Sprint holds two days of work or two weeks, and cannot tell whether the heavier delivery Flow is earning its overhead — `zapply` runs a planning fan-out, an isolated worktree, a review fan-out, and a test floor where a plain apply runs none of that, and nobody knows what that costs.

Estimates borrowed from hand-coding do not transfer. A Change that would take a day by hand may merge in forty minutes under an agent Flow, and the same Change prices differently under two Flows, so a single absolute number is meaningless. Worse, nothing records what any Change actually took: 29 archived Changes have shipped and the next estimate is no better informed than the first. Git cannot fill the gap — Changes land as one squashed commit and consecutive Changes sit days apart on the calendar, which reads as 24-120 hours for what were one-to-two-hour sessions.

## Solution

Estimation collapses to one judgment. Groom records a **Size Tier** per Change and nothing else; every hour figure is derived from it, so re-calibrating re-prices every open Change at once without touching a single Epic.

The CLI prices a Tier against the **Flow Profile** of the Flow that will execute the Change, resolved down a ladder — this repo's recorded **Flow Actuals** first, then the same Flow's cross-project history, then a declared seed — with every price naming the rung it came from. Flows report their own elapsed time when a Change merges, so actuals accumulate without anyone tracking time by hand. **Bias** between priced and observed hours, rolled up per Tier per Flow, feeds straight back into the ladder: overrunning does not merely get reported, it corrects the next estimate.

Alongside the Flow figure sits a **Human Estimate** from a fixed per-Tier table — the counterfactual hand-coding cost, held stable so that the leverage between the two moves only when the Flow's real cost moves. The board carries a price per Change and a remaining total per Sprint, which makes a Sprint a capacity plan for the first time.

The first numbers come from history that already exists: a one-off calibration joins recorded agent sessions to Changes and prints a Tier table to paste into config. That scaffolding stays outside the package.

## User stories

1. As a maintainer, I want every pending Change priced in hours under the Flow that will run it, so that I know what picking it up costs before I start.
2. As a maintainer, I want each Sprint to show its remaining hours over pending Changes, so that "when is this Sprint done" is answered without me adding anything up.
3. As a maintainer, I want groom to record one Size Tier per Change and nothing more, so that estimation does not become a per-Change guessing ritual with no shared scale.
4. As a maintainer, I want a re-calibrated profile to re-price every open Change at once, so that improving the numbers never means re-touching Epics one by one.
5. As a maintainer, I want each price to name the rung it came from, so that I can tell a measured number from a seeded guess and trust the board accordingly.
6. As a maintainer, I want a new project to price Changes from my cross-project history for that Flow, so that a fresh repo is not planned on nothing.
7. As a maintainer, I want the Flow to report its own elapsed time at merge, so that actuals accumulate without me running a stopwatch.
8. As a maintainer, I want a Change delivered across several runs to accumulate its Flow Actual rather than overwrite it, so that resumed work is not undercounted.
9. As a maintainer, I want Bias per Tier per Flow folded back into future estimates, so that the system gets more accurate on its own rather than through maintenance.
10. As a maintainer, I want a warning when Bias grows large enough to mean the profile is wrong, so that a systematic error surfaces instead of correcting silently forever.
11. As a maintainer, I want a Human Estimate beside the Flow Estimate, so that I can see and report what the agent Flow is actually buying.
12. As a maintainer, I want the workspace to declare its default Flow with a per-Epic override, so that the common case costs no configuration and the exception is still expressible.
13. As a maintainer, I want to price the same Change under a different Flow by changing one field on its Epic, so that choosing the heavier Flow is a visible, deliberate spend.
14. As a maintainer, I want the first profile seeded from my real session history rather than invented, so that day-one estimates describe my actual Harness.
15. As an agent, I want `--json` to carry all three numbers, the source rung, and the Bias, so that downstream workflows consume delivery cost without recomputing it.
16. As an agent, I want an estimating step in Change authoring that prompts for the Tier and persists it through the spego CLI, so that a Change arrives priced instead of waiting for the next groom run.

## Implementation decisions

- `epic` meta gains three fields: the Size Tier, an optional Flow override, and accumulated Flow Actuals. Exact shape of the actuals field — one running total against a run count, or a list of recorded runs — is pinned during design; Bias needs enough structure to roll up per Flow.
- Workspace config gains a Flows block: per-Flow seed tables mapping Tier to hours, the workspace default Flow name, and the Human Hours per-Tier table. All three are declared values, validated on load like the rest of the config.
- Prices, Sprint totals, and Bias are derived on render and never stored, the same rule that already governs Blockers and the Mirror as a whole.
- Profile resolution is a precedence ladder — repo actuals when the sample count suffices, else the Flow's cross-project history, else the config seed — and the resolved rung travels with the price into both human and JSON output.
- Flow Actuals arrive from outside the workspace: a Flow reports its own elapsed hours and its Flow name on a successful merge. This is a new writing surface that fits neither existing writer, since `spego sync` derives from filesystem signals and groom persists judgment. Writer ownership is pinned during design.
- Bias is computed per Size Tier per Flow from recorded actuals against the prices those Changes carried, and surfaced as a new Mirror warning once it crosses a threshold. Bias also corrects future prices, but which rungs it corrects is pinned during design: on the seed and cross-project rungs the correction is well defined, while on the repo-actuals rung the price already derives from the same observations Bias measures.
- The board renders a price per Change and a remaining total per Sprint, counting pending Changes only. Column budget is tight — board panels have been reworked across five changes — so the rendering keeps to one column plus a per-panel total.
- The OpenSpec read-only contract holds unchanged. The estimating step lives in a project-local forked OpenSpec schema (`openspec schema fork`) that prompts for the Tier and writes it through the spego CLI; spego reads nothing new out of `openspec/`. If that experimental surface changes, the prompt is lost and the data is not.
- The seed is produced by one-off calibration scaffolding that joins recorded agent sessions to Changes and prints a Tier table. It is not product code and no transcript parser ships in the published package.
- The cross-project rung reads history from outside the repo, so pricing stops being reproducible from the repo alone. Its location and the override that keeps the test suite hermetic are pinned during design.
- Vocabulary per `CONTEXT.md`: Flow, Harness, Flow Hours, Human Hours, Flow Estimate, Human Estimate, Flow Actual, Size Tier, Flow Profile, Bias. Decisions recorded in `decision/change-estimation-groom-judged-tier-cli-priced-hours-flow-calibrated`.

## Testing decisions

- Flow: hybrid — TDD (red-green, table-driven) for the pure pricing module, where expected values come from hand-computed Tier tables rather than from the implementation; e2e CLI specs written after the board columns and the recording command shape stabilize. Existing-service-strict depth.
- Seams: primary — module-level tests for ladder resolution, Tier pricing, Bias rollup, accumulation, and Sprint totals, following `test/delivery-mirror.test.ts` prior art; secondary — the e2e CLI spawn seam (`spawnCli`/`setupInitialized` in `test/_cli-helpers.ts`) asserting the `--json` contract of the priced board and the recording command, following `test/cli.board.test.ts` and `test/cli.sync.test.ts`.
- Good tests cover: rung selection at and around the sample threshold, a repo with zero actuals, a Flow with no seed, Bias arithmetic including the warning boundary, actuals accumulating across repeated runs of one Change, Sprint totals excluding done and completed Changes, a per-Epic Flow override changing the price, config validation rejecting a malformed Flows block, and the `--json` shape carrying numbers, rung, and Bias.
- Determinism floor: e2e runs must not read cross-project history from the developer's real home directory. The isolation mechanism is pinned during design and is a prerequisite for the first e2e spec.

## Out of scope

- Velocity, burndown, and time tracking beyond the three recorded numbers — a Sprint gains remaining hours, not a chart.
- In-flight overrun detection. Nothing is observable while a Change is running, because Flows report only at merge.
- Human actuals. The Human Estimate is unfalsifiable by construction and stays a declared reference.
- A shipped transcript parser or any Harness-specific reader inside the CLI.
- Mechanically inferring a Size Tier from task counts or spec deltas; the Tier stays a judgment.
- Estimating anything that is not a Change — no per-task, per-artifact, or per-Sprint-goal pricing.
- Monetary cost and token accounting, even though the same session records could supply them.
- Delivery adapters other than OpenSpec.

## Further notes

Open questions carried out of grilling, all decomposition- or design-time calls rather than unresolved product decisions:

- Size Tier scale — the bucket set was never pinned. Five buckets (`xs`/`s`/`m`/`l`/`xl`) or fewer, and whether the scale is fixed or configurable.
- Sample threshold — how many recorded actuals before the repo rung outranks cross-project history.
- Bias threshold — how far off before the warning fires, and whether Bias is capped so one pathological Change cannot swing a profile.
- Writer ownership for merge-time actual reporting, which fits neither `spego sync` nor groom as they are currently defined.
- Location of the cross-project profile and the home-directory override the e2e suite needs.
- Whether the forked OpenSpec schema ships with this work or follows once the data path is proven.
- What a Change with no Size Tier renders as, and whether it counts toward its Sprint's remaining total. A total that silently omits untiered Changes reads as a complete plan when it is not.
- Which ladder rungs Bias corrects. On the seed and cross-project rungs the correction is well defined; on the repo-actuals rung the price already derives from the observations Bias measures, so applying it there needs a rule.

Known limits of the seed, worth stating before anyone trusts the first numbers: recorded sessions for this project start 2026-07-12, so a calibration reaches roughly the last dozen Changes rather than all 29 archived ones, and sessions are finer-grained than Changes — eight sessions against three Changes on 2026-07-30 — so the join is heuristic and the seed inherits that uncertainty. The ladder is built to outgrow it.

This PRD reverses one line of `docs/prd/delivery-mirror.md:47`, which excluded estimates on the grounds that Sprints are grouping units rather than capacity plans. That line stands for velocity, burndown, and time tracking; it no longer stands for hours.
