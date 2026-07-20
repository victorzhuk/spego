## Why

OpenSpec owns change lifecycle and deliberately does not manage cross-change workflow: dependencies between changes, required supporting artifacts, sprint grouping. That state currently lives in throwaway notes. The accepted decision artifact (`decision/mirror-state-per-epic-markdown-derived-graph-groom-sole-writer`) settles the storage model: per-change `epic` artifacts plus a structured `sprint-plan` changes list, with the full graph always derived. This slice lays that state model down — without it neither `spego mirror` nor `spego-groom` has anything to read or write.

## What Changes

- New `epic` artifact type: mirrors exactly one OpenSpec change, slug = change name. Meta: `deps` (change names), `links` (supporting artifact ids), `requires` (artifact types the change needs), `gaps` (flag + note entries). No status field — change status stays derived from the OpenSpec adapter.
- `sprint-plan` meta gains a structured `changes` list (ordered change names). Existing `sprint`, dates, and `status` fields unchanged.
- Cross-artifact rule: a change may appear in at most one non-closed sprint-plan; create/update of a sprint-plan violating this fails validation.
- CLI-layer rule: creating or updating an `epic` verifies the slug names a known active OpenSpec change via the delivery adapter; when the adapter cannot resolve (no `openspec/`, CLI missing), the check is skipped with a stderr warning.
- Generic artifact CRUD (`create`/`read`/`update`/`delete`/`list`/`view`) picks the new type up unchanged.

## Capabilities

### Modified Capabilities

- `artifact-validation`: epic meta schema, sprint-plan `changes` list, one-sprint-per-change rule, epic-slug-must-name-a-change rule.

## Impact

- `src/artifacts/schemas.ts` (epic schema, sprint-plan extension), `src/artifacts/validation.ts` / engine (cross-artifact sprint membership check), CLI create/update path (epic slug check via adapter), tests.
- No OpenSpec writes; adapter used read-only for slug verification.
- Changelog: Added entries for the new type and sprint-plan structure.
