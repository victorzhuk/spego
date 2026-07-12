## Context

`cli/errors.ts` centralizes error → envelope/exit-code mapping and promises exit 2 for validation failures regardless of source. Three CLI input paths bypass it: `JSON.parse(opts.meta)` (`artifact.ts:39`), `fs.readFile(opts.bodyFile)` (`body-input.ts:29`), and `Number(opts.revision)` (`artifact.ts:79`, `view.ts:43`). `view.ts` additionally duplicates `runEngineCommand`'s lifecycle because the helper cannot accept the deprecated `--format` flag as a json source, and `create` reaches past the engine facade into `artifacts/storage.js` for `renderArtifactFile`.

## Goals / Non-Goals

- Goal: every input failure at the CLI boundary maps to `VALIDATION_FAILED`/exit 2; all commands route through `runEngineCommand`; CLI imports engine facade only.
- Non-goal: changing the error envelope shape, exit-code table, or any happy-path output.

## Decisions

- Wrap at the CLI boundary, not inside the engine: `--meta`/`--body-file`/`--revision` are transport concerns; the engine keeps receiving already-validated values. Alternative (engine-side zod coercion) rejected — it would blur the documented boundary in `cli/errors.ts`.
- `--revision` validated with `z.coerce.number().int().positive()` to match the existing `--expected-revision` schema treatment.
- `runEngineCommand` gets an optional json override (value or resolver callback) so `view` can feed `--json || --format json` into the shared helper; helper stays the single lifecycle owner.
- `create`'s JSON payload comes from the record returned by the engine (or a small facade accessor) instead of re-serializing via `renderArtifactFile` — serialization stays a storage-layer detail.

## Risks / Trade-offs

- [Behavior change for scripts matching on exit 1/INTERNAL for these mistakes] → they were relying on a documented-as-wrong behavior; changelog notes the fix under Fixed.

## Migration Plan

None; bugfix release.

## Open Questions

None.
