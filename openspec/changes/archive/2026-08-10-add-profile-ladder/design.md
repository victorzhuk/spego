# Design

## Which statistic

Median over recorded runs for a Flow and Tier, not mean. Agent sessions have a long right tail — one change that hit a rebase conflict or a failing test floor can be several times its neighbours — and a mean lets a single bad afternoon reprice every future change of that size. The median moves when the typical run moves, which is what a profile is for.

## Sample threshold

Fixed at three runs per Flow and Tier pair, in code rather than config. Below three, one outlier is the median. Above three, the config seed has usually stopped being the better guess anyway. The reasoning matches the fixed Size Tier scale: a threshold that varies per project makes two boards incomparable and makes a price depend on config read order.

Task 1.1 confirms the number before implementation; it is a constant, so changing it later is a one-line change plus test updates.

## Resolution, per Flow and Tier independently

The ladder resolves for each (Flow, Tier) pair on its own. A repo with eight recorded `s` runs and one `xl` run prices `s` from observation and `xl` from the seed on the same board. Resolving per Flow as a whole would hold back well-evidenced tiers behind sparse ones.

Runs are attributed strictly: only runs recorded under Flow F count toward F's profile. A change delivered by two Flows contributes one run to each.

## Rung reporting

The rung field added by `add-change-pricing` starts carrying a second value. Human output shows it next to the hours; `--json` carries it verbatim. Two values now, three after `add-cross-project-profile` — the contract does not change again.

## Open questions to resolve before implementing

1. **Sample threshold value** — three is proposed above; confirm.
2. **Whether the rung renders inline or as a legend.** The hours column is one column in a table whose geometry has been reworked five times; a per-cell marker may not fit. Human rendering is settled during implementation against the real panel widths, and `--json` is unaffected either way.

## Rejected alternatives

- **Weighted blend of observed and seed** — smoother, no threshold cliff, but the resulting number is reconstructible only by rerunning the code, and "why is this 3.5h" stops having an answer.
- **Mean with outlier trimming** — equivalent to the median at these sample sizes with more machinery and a trimming rule to argue about.
