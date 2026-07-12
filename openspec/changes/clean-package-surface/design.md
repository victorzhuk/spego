## Context

Review of 0.11.0 flagged surface that misstates the product: an unused published library barrel, a three-way disagreement about valid agent names (`SUPPORTED_AGENTS` vs free-form schema vs generator registry), a legacy `orchestration` config shim with no expiry inside a `.strict()` schema, a `commands/` naming collision, non-enforcing lint warnings, and dead-code remnants of the removed orchestration feature.

## Goals / Non-Goals

- Goal: package surface tells the truth — CLI-only, registry-driven agent targets, no zombie compat paths.
- Non-goal: any behavior change to commands, generators, artifact engine semantics, or the error envelope (other than the legacy-config rejection).

## Decisions

- CLI-only over fixing the barrel: zero consumers exist (verified — no src/test import of `src/index.ts`); re-adding a curated export surface later is cheap if an embedder appears. Alternative (keep + smoke-test the barrel) rejected as maintaining an untested parallel API.
- Registry as single source of truth for agent names: schema stays `z.array(z.string())`, generation keeps warn-and-skip. Alternatives rejected: hard-validating against `availableTargets()` couples workspace config to the generator module and breaks configs naming not-yet-shipped targets; `z.enum(SUPPORTED_AGENTS)` blesses `cursor`/`amp`, which have no generator.
- Shim removal now, not version-tagged: two releases of read-compat is enough for a pre-1.0 tool; a failing parse with an instructive message is a one-line user fix. The rejection is expressed in the `project-initialization` spec so the behavior is contractual, not incidental `.strict()` fallout.
- `src/command-meta/` chosen over merging into `src/cli/`: the registry feeds the generator (agent-facing metadata), not Commander wiring; the rename states that.

## Risks / Trade-offs

- [0.10.x workspace hits parse error after upgrade] → error message names the block and the fix; changelog Removed entry; pre-1.0 minor bump per SemVer spec item 4.
- [Unknown external importer of the package API] → npm package is young and CLI-marketed; acceptable, reversible by re-publishing exports.

## Migration Plan

Single release. Users with a legacy `orchestration` block delete it from `.spego/config.yaml` (error message says exactly this). No data migration; index and artifacts untouched.

## Open Questions

None.
