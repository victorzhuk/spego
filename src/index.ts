/**
 * Public API for embedding the spego artifact engine in other tools.
 * The CLI in `cli.ts` is built on top of these exports.
 */
export { ArtifactEngine } from './artifacts/engine.js';
export type { EngineOptions } from './artifacts/engine.js';
export {
  artifactFrontmatterSchema,
  BUILTIN_ARTIFACT_TYPES,
} from './artifacts/types.js';
export type {
  ArtifactFrontmatter,
  ArtifactRecord,
  ArtifactType,
  BuiltinArtifactType,
} from './artifacts/types.js';
export {
  initWorkspace,
  workspaceStatus,
} from './workspace/init.js';
export type { InitOptions, InitSummary, WorkspaceStatus } from './workspace/init.js';
export {
  resolveWorkspacePaths,
  artifactFilePath,
  artifactTypeDir,
  revisionFilePath,
  WORKSPACE_DIR_NAME,
  ARTIFACTS_DIR_NAME,
  REVISIONS_DIR_NAME,
  INDEX_DIR_NAME,
  CONFIG_FILE_NAME,
  INDEX_DB_FILE_NAME,
} from './workspace/paths.js';
export type { WorkspacePaths } from './workspace/paths.js';
export {
  defaultConfig,
  knownArtifactTypes,
  readConfig,
  writeConfig,
  workspaceConfigSchema,
} from './workspace/config.js';
export type { WorkspaceConfig, SupportedAgent } from './workspace/config.js';
export type { CreateArtifactInput, UpdateArtifactInput } from './artifacts/validation.js';
export type { IndexedArtifact, RebuildReport } from './index/indexer.js';
export { viewArtifacts, renderMarkdownBundle, renderJsonBundle } from './export/view.js';
export type {
  ViewOptions,
  ViewResult,
  MarkdownBundle,
  JsonBundle,
  JsonArtifact,
} from './export/view.js';
export { SpegoError } from './errors.js';
export type { SpegoErrorCode } from './errors.js';
export { validateMetaForType, hasTypeSchema, ARTIFACT_META_SCHEMAS } from './artifacts/schemas.js';
export { COMMAND_REGISTRY, getCommandByName } from './commands/registry.js';
export type { CommandMeta, InputField } from './commands/registry.js';
export { generateAll, registerGenerator, getGenerator, availableTargets } from './generator/index.js';
export { ClaudeGenerator } from './generator/claude.js';
export type { TargetGenerator, GenerationReport, GeneratedFile, FileAction } from './generator/types.js';
export { SPEGO_GENERATED_YAML_KEY, isSpegoGenerated, isLegacySpegoGenerated, wrapWithMarker } from './generator/markers.js';
export { resolveAdapter } from './delivery/index.js';
export type {
  DeliveryAdapter,
  DeliveryEpicLink,
  DeliveryItemStatus,
  DeliveryStatus,
  DeliveryTaskSummary,
} from './delivery/index.js';
export { WORKFLOW_REGISTRY, getWorkflowByName, listWorkflowNames } from './workflows/index.js';
export type { WorkflowMeta, PersonaSpec, PhaseSpec, WorkflowInput, WorkflowOutput } from './workflows/index.js';
