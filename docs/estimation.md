# Estimation

The board prices changes in hours when the workspace declares a `flows` block. Every figure is derived on render and never stored.

Vocabulary — Flow, Harness, Flow Hours, Human Hours, Size Tier, Flow Profile, Bias — is defined in [`CONTEXT.md`](../CONTEXT.md).

## Configuration

Declared in `.spego/config.yaml`. The hours below are illustrative — seed your own, or derive them from history (see [Seeding the first profile](#seeding-the-first-profile)).

```yaml
flows:
  default: zapply
  crossProject: false
  profiles:
    zapply:
      xs: 0.5
      s: 1
      m: 2
      l: 4
      xl: 8
  human:
    xs: 2
    s: 4
    m: 8
    l: 16
    xl: 32
```

- `default` names the Flow that prices changes with no per-epic override.
- `profiles` maps each declared Flow to a seed table over the fixed Size Tier scale (`xs`, `s`, `m`, `l`, `xl`). The scale is not configurable.
- `human` is one table shared across every Flow.
- `crossProject` opts into the cross-project rung and defaults to off.

Config parsing rejects a `default` naming no declared profile, a table missing a tier or declaring an unknown one, and any hours value that is negative or not finite. A workspace with no `flows` block stays valid and prices nothing.

## Pricing

For every change whose epic carries a `tier`, the board derives a Flow Estimate from the epic's `flow` profile — the workspace default when unset — and a Human Estimate from the shared table.

A change without a `tier`, or naming a `flow` absent from `flows.profiles`, renders `?` in the `hours` column and does not count toward its sprint's total; a sprint holding such pending changes renders its total with a `+?` suffix. Hours render as decimals with trailing zeros trimmed, and sprint totals sum unrounded values. Each sprint panel's title reports the remaining total Flow Estimate of its pending changes.

`--json` carries `flowEstimate`, `humanEstimate`, `rung`, and `bias` per priced change, and `flowTotal` and `unpricedPending` per sprint. A workspace with no `flows` block omits the column, the totals, and every one of those fields.

## The ladder

Each price reports the rung it came from, so a measured number is never mistaken for a guess. Rungs resolve independently per Flow and Size Tier pair — one tier can price from observation while another falls back to the seed on the same board — and runs recorded under one Flow never price another.

| Rung | Source | Condition |
|------|--------|-----------|
| `observed` | median of this repo's recorded runs | at least three runs for the pair |
| `cross-project` | median of the cross-project store | `crossProject: true`, local runs below the threshold, store holds three or more |
| `config-seed` | the declared `profiles` table | everything else |

Observed hours carry a `*` in the `hours` column, with a dim legend line whenever a rendered change is observed.

Runs arrive through `spego record <change> --flow <name> --hours <n>`, which appends to the epic's `actuals` rather than overwriting — a change delivered across several runs accumulates.

## Bias

The mirror derives a bias per Flow and Size Tier pair: the median ratio of recorded runs over the price those runs' changes carried. Seeded prices are corrected by it, clamped to `[0.5, 2]` so one pathological run cannot swing a profile. An observed price is never corrected by its own residual. `--json` carries the unclamped `bias`.

A pair whose bias falls outside `[1/1.5, 1.5]` raises the `stale-profile` warning, naming the Flow, the tier, and the direction. The repair is judgment — a wrong seed, or inconsistent tier calls — so the warning points at re-grooming, not at an automatic fix. Several drifted pairs aggregate into one human Warnings row while `--json` keeps one entry per pair.

## Cross-project history

`spego record` appends every tiered run to an append-only `runs.jsonl` under the platform configuration directory — `$XDG_CONFIG_HOME/spego` or `~/.config/spego`, `%APPDATA%\spego` on Windows, `~/Library/Application Support/spego` on macOS. Each line is one `{flow, tier, hours}` record with no repo attribution.

With `crossProject: true`, a pair whose local runs are below the sample threshold prices from the store's median once the store holds three or more runs for that pair. The flag defaults to off: a workspace that says nothing prices from repo observations and the seed alone, and its board stays reproducible from the repo. Opting in trades that reproducibility away, since the store lives outside the repo and grows with every run recorded anywhere.

`SPEGO_STORE_ROOT` overrides the store root ahead of the configuration directory, so a test suite or a reproducible run can point it somewhere hermetic; the suite sets it for every spawned CLI run. The store is plain data, not a workspace — losing it costs evidence, not correctness, and the ladder simply falls back a rung. Recording writes the epic first and the store second, so a failed store write (`WRITE_FAILED`) never costs the epic entry, and the store is written whether or not the workspace opts in.

## Seeding the first profile

The first seed does not have to be invented. `node scripts/calibrate-seed.mjs` joins the agent sessions already recorded for this project to archived changes by time window and branch, sums elapsed wall-clock per change, and prints a per-change table for review — then, given a Size Tier per change, a `flows` block holding the median hours per tier, ready to paste into `.spego/config.yaml`.

The script is calibration scaffolding, not product code: it reads a vendor-specific session format, its join is a heuristic the maintainer confirms before trusting, and it ships nowhere. It lives under `scripts/`, outside the published package, which is where the CLI's design keeps that format out of the npm artifact.

## Authoring a priced change

This project forks OpenSpec's `spec-driven` schema into `openspec/schemas/spec-driven-custom` (selected in `openspec/config.yaml`) and adds an `estimating` artifact between `proposal` and `tasks`. Once the proposal settles the scope, the author judges the change's Size Tier — sizing the change itself, not the flow machinery that will build it — and persists it through `spego sync` plus `spego update` onto the change's epic.

The generated `estimating.md` records the tier and its one-line rationale as the human-readable trace; the epic's `tier` meta is the state the board prices from, so a change arrives priced instead of waiting for the next groom run. OpenSpec owns the ritual, spego owns the state — the step writes nothing under `openspec/` beyond its own artifact file.

Changes authored without the fork are unaffected: grooming judges their tier as before. The `openspec schema` surface is experimental; if it changes, the prompt disappears and every recorded tier stays on its epic.

## Related

- [Delivery board](delivery-board.md) — where prices and sprint totals render
- [Workflows](workflows.md#groom) — groom judges each epic's `tier` during analyze
