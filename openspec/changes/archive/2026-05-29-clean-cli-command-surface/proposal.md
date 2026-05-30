## Why

The `spego` CLI surface has accumulated drift since the dual output mode change landed:

- `src/cli.ts` is a single ~640-line file. Every command repeats the same JSON resolution, engine lifecycle, error mapping, and body-input boilerplate.
- Human output styles diverge: `init`, `status`, `list`, `view`, `read`, `update`, `commands`, `workflows`, `epics`, `tasks`, and `skills` use `renderHeader`, but `create` and `delete` print bespoke single-line strings, and `index rebuild` skips the header entirely.
- JSON success payloads are asymmetric: `create` includes `markdown`, `update`/`delete` return only a small subset, and `read` returns the full `{frontmatter, body, path}` shape.
- Validation errors (commander) emit `{ error: { code: 'VALIDATION_FAILED', message } }` with no `details`, while domain errors include `details`. Agents have to branch on shape.
- Tests duplicate execution paths (e.g. the skills dual-mode block exists in both `cli.test.ts` and `cli.skills-command.test.ts`), assert on fragile regex against table widths, and skip end-to-end coverage for `epics`, `tasks`, `read --path`, `read --revision`, `update --expected-revision`, `--body-file`, `--body-file -` (stdin), `view` filters, and the uninitialized `status` path.
- `eslint` currently fails because `test/cli-help-exit.test.ts` is missing from `eslint.config.js` `allowDefaultProject`. This is a real regression on `master`.

The CLI should remain agent-first and human-friendly: every command pretty in human mode, deterministic in `--json` mode, and covered by tests that exercise both. This change refactors the runtime into shared helpers, normalizes output styles and JSON shapes, fills the test gaps, and fixes the lint config.

## What Changes

### Command runtime
- Introduce a single shared command runtime helper that resolves `--json`, opens an `ArtifactEngine` when needed, runs the command body, emits the success payload, formats errors, and closes the engine. Replaces ~9 duplicated `try/catch/finally` blocks.
- Introduce a body-input helper used by `create` and `update` that reads from `--body`, `--body-file`, or stdin (`-`).
- Introduce shared error formatting (human and JSON) for `SpegoError`, generic `Error`, and commander validation errors. Validation errors gain a stable `details: {}` field so agents can rely on the shape.

### Output normalization
- Every command emits a consistent header in human mode using `renderHeader` plus an emoji from a small fixed set, including `create`, `delete`, and `index rebuild`. `index rebuild` keeps its summary box but gains a header line for parity.
- `read`, `update`, and `view` apply a single body-rendering helper. `view` continues to insert dividers between sections; `read` and `update` continue to print header + divider + body.
- Empty states are routed through a single helper (`No artifacts.`, `No epics.`, `No tasks for <change>.`) so wording stays uniform.

### JSON shape consistency
- `update` returns `{ frontmatter, body, path }`, mirroring `read`. Existing `id`, `revision`, `path` fields remain in the payload for backward compatibility.
- `create` keeps `id`, `type`, `slug`, `revision`, `path`, and `markdown`.
- `delete` keeps `id`, `deletedAt`, `revision`.
- All success payloads remain free of emoji and box-drawing characters.

### Delivery commands
- `epics` and `tasks` retain the `[action]` positional and the `DELIVERY_READ_ONLY` rejection for `get|list` mismatches.
- They gain end-to-end CLI coverage: human and JSON modes for empty list, single get, and the read-only rejection path.

### Tests
- Extract shared helpers (`spawnCli`, `setupInitialized`) so each test is one or two lines.
- Add registry/program parity test: every entry in `COMMAND_REGISTRY` must be reachable on the actual Commander program; every public command must declare both `markdown` and `json` output modes.
- Add missing CLI coverage for `epics`, `tasks`, `read --path`, `read --revision`, `update --expected-revision` (success and `CONFLICT`), `update --body-file -` (stdin), `create --body-file`, `view --id --revision --include-deleted`, `init --force`, `status` uninitialized JSON shape.
- Replace fragile literal counts (`expect(result.length).toBe(12)`) with set-membership assertions to reduce churn when workflows are added.
- Remove the duplicated skills block from `cli.test.ts`; keep it only in `cli.skills-command.test.ts`.

### Lint
- Add `test/cli-help-exit.test.ts` to `eslint.config.js` `allowDefaultProject` so `npm run lint` is green on `master`.

## Capabilities

### Modified Capabilities
- `agent-command-surface`: tightens the dual-output contract with consistent human headers, symmetric JSON shapes for read/update, and a stable validation error envelope. Adds end-to-end CLI coverage requirements for delivery commands.

### New Capabilities
None. This is a refinement of the existing surface.

## Impact

- Affected source files: `src/cli.ts` (decomposed into a runtime helper plus per-command modules under `src/cli/commands/`), `src/cli/render.ts` (new helpers `intersperseBundleDividers`, `renderEmpty`), `src/cli/runtime.ts` (new), `src/cli/output.ts` (new), `src/cli/body-input.ts` (new), `src/cli/errors.ts` (new). No behavior change to artifact engine, generators, workflows, or delivery adapters.
- Backward compatibility: existing JSON keys are preserved for every command; new keys are additive only. Human output gains a header line in `create`, `delete`, and `index rebuild` but keeps the existing summary line / box. The hidden `regenerate` alias remains.
- Tests: most existing tests stay; some are deleted as duplicates and replaced with table-driven equivalents. Net coverage increases.
- `eslint.config.js`: one-line addition.
- README and CHANGELOG: update the output-mode contract, validation envelope, body-input docs, and release notes.
