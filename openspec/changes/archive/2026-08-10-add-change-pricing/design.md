# Design

## Where pricing lives

Pricing is derivation, so it belongs beside the rest of the mirror's derived state: `deriveMirror` already computes blockers, groups, gaps, and missing artifacts from stored inputs and returns them on `MirrorChange` / `MirrorSprint`. Prices join that set rather than becoming a separate pass, which keeps one traversal and one place where "derived, never stored" is enforced.

Config is the second input. `deriveMirror` currently takes changes, epics, sprints, linked artifacts, and warnings; it gains the resolved `flows` configuration. Passing the resolved block rather than reading config inside the derivation keeps the function pure and the e2e seam unchanged.

## Config shape

```yaml
flows:
  default: zapply
  profiles:
    zapply:
      xs: 0.5
      s: 1
      m: 2
      l: 4
      xl: 8
  human:
    xs: 2
    s: 6
    m: 16
    l: 40
    xl: 80
```

The numbers above are placeholders — real seeds come from `add-seed-calibration`. `human` sits outside `profiles` because a Human Estimate is Flow-independent by definition; duplicating it per Flow would invite two tables disagreeing.

Validation rejects a `default` naming no profile, a profile whose tiers do not match the tier scale, and negative or non-finite hours.

## Size Tier scale

The scale is fixed in code, not configurable: five tiers, `xs` / `s` / `m` / `l` / `xl`. A configurable scale would make every profile table's validity depend on config read order and would let two projects disagree about what `m` means, which defeats a shared judgment scale. Adding a tier later is a schema change, which is the right amount of friction.

## Rung reporting

Every price carries the rung that produced it. In this slice exactly one rung exists — the config seed — so the value is constant, but the field ships now so that `add-profile-ladder` and `add-cross-project-profile` add rungs without changing the output contract twice.

## Open questions to resolve before implementing

Both are recorded as gaps in `docs/prd/change-estimation.md` and neither was decided during grilling. Task 1.1 confirms them with the user and updates the spec deltas before any code is written.

1. **Untiered changes.** What the `hours` cell shows for a change whose epic has no `tier`, and whether such a change counts toward its sprint's remaining total. A total that silently omits untiered changes reads as a complete plan when it is not. The board's existing convention for unset metadata is `?` (a pending change with no `track`), which is the obvious candidate but is not a decision anyone has made.
2. **Rounding and display unit.** Whether hours render as decimals, quarter-hours, or minutes below one hour, and whether a sprint total rounds after summing or sums rounded values.

## Rejected alternatives

- **Storing prices on the epic.** Would make a re-priced profile require touching every epic, which is exactly what tier-based pricing exists to avoid.
- **Pricing inside the board command.** Would leave `spego epics --json` and any future consumer unpriced, and would put arithmetic in the rendering layer.
