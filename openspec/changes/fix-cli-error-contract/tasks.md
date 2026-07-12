## 1. Boundary validation

- [ ] 1.1 Wrap `JSON.parse(opts.meta)` in `create`/`update` and rethrow as `SpegoError('VALIDATION_FAILED', ...)` naming `--meta` (`src/cli/commands/artifact.ts`)
- [ ] 1.2 Wrap `fs.readFile(opts.bodyFile)` failures in `resolveBody` as `VALIDATION_FAILED` naming the path (`src/cli/body-input.ts`)
- [ ] 1.3 Validate `--revision` with `z.coerce.number().int().positive()` in `read` and `view` before calling `readRevision`

## 2. Runtime consolidation

- [ ] 2.1 Add optional json override to `runEngineCommand` (`src/cli/runtime.ts`)
- [ ] 2.2 Route `view` through `runEngineCommand`, deleting its hand-rolled open/try/catch/finally (`src/cli/commands/view.ts`)

## 3. Facade integrity

- [ ] 3.1 Remove the `renderArtifactFile` import from `src/cli/commands/artifact.ts`; produce the create JSON payload via the `ArtifactEngine` record

## 4. Tests

- [ ] 4.1 `create --meta '{'` → exit 2, `VALIDATION_FAILED`
- [ ] 4.2 `create --body-file /nonexistent` → exit 2, `VALIDATION_FAILED`
- [ ] 4.3 `read`/`view` with `--revision abc` and `--revision -1` → exit 2, `VALIDATION_FAILED`, no `rNaN.md` lookup
- [ ] 4.4 `view --format json` still honored through the shared runtime (deprecation warning preserved)
