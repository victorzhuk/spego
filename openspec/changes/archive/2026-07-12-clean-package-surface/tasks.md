## 1. Package surface

- [x] 1.1 Remove `main` and `types` from package.json; delete `src/index.ts`
- [x] 1.2 Verify build/`files` output still packs correctly with `bin` only (`npm pack --dry-run`)

## 2. Config truth

- [x] 2.1 Delete `SUPPORTED_AGENTS`/`SupportedAgent` from `src/workspace/config.ts`
- [x] 2.2 Remove the legacy `orchestration` block from `workspaceConfigSchema`; add a pre-parse check producing a validation error that names the block and instructs deleting it
- [x] 2.3 Update `test/init.test.ts` legacy-config cases to assert rejection instead of acceptance

## 3. Naming and lint

- [x] 3.1 Rename `src/commands/` → `src/command-meta/`; update all import sites
- [x] 3.2 Change lint script to `eslint src test --max-warnings 0`

## 4. Dead code and housekeeping

- [x] 4.1 Delete `ArtifactEngine.frontmatterFromRecord` (`src/artifacts/engine.ts`)
- [x] 4.2 Replace `'issues' in err` duck-typing with `instanceof z.ZodError` (`src/artifacts/validation.ts`)
- [x] 4.3 Extract local `formatIndexError` for the duplicated expression (`src/index/indexer.ts`)
- [x] 4.4 Remove empty dirs `src/orchestration/`, `openspec/specs/ultracode-orchestration/`
- [x] 4.5 Changelog: Removed entries for library surface and legacy orchestration config; Fixed/Changed entries as appropriate

## 5. Verification

- [x] 5.1 Full suite green (`npm test`), lint clean at zero warnings, `npm pack --dry-run` lists only intended files
