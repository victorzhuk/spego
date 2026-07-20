# Design — mirror state model

## Epic meta schema

```yaml
deps: [add-sessions]          # change names this change depends on
links: [<artifact-id>]        # supporting spego artifacts (prd, design, decision, ...)
requires: [design, decision]  # artifact types groom judged necessary
gaps:
  - flag: weak-spec           # freeform slug
    note: "acceptance criteria missing for error paths"
tags: []
```

- `deps` entries are change names, not validated against existing changes at write time — a dep may target a change groomed moments later; dangling deps surface as `spego mirror` warnings (next slice).
- `requires` entries are non-empty strings, not restricted to built-in types — custom artifact types are legal.
- No `status`, no `sprint` on the epic: change status is adapter-derived, sprint membership is sprint-plan-owned (CONTEXT.md).

## Enforcement split

| Rule | Where | When it fires |
|------|-------|---------------|
| Epic slug names an active change | CLI command layer, via delivery adapter | create/update of type `epic`; skipped with stderr warning when adapter unavailable |
| Change in at most one non-closed sprint | Engine, via SQLite index lookup | create/update of type `sprint-plan` |
| Meta shape (deps/links/requires/gaps) | zod schema like every other type | create/update |

The engine stays adapter-free: the slug check lives in the CLI layer so the artifact engine keeps zero delivery coupling. Closed sprints are excluded from the membership rule so history doesn't block re-planning.

## Testing

Hybrid per PRD: schema and cross-artifact rules TDD table-driven at module level (prior art `test/artifact-crud.test.ts`, `test/delivery.test.ts`); `--json` CLI contracts via `spawnCli` e2e after.
