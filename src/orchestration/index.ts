/**
 * Public surface for the ultracode multi-agent orchestration capability.
 */

export { orchestrateChange, AGENT_MANAGER, AGENT_WORKER, AGENT_VERIFIER } from './engine.js';
export type { OrchestrateOptions } from './engine.js';
export { OpenCodeClient, extractText } from './client.js';
export type { OpenCodeApi, OpenCodeClientOptions, SendMessageInput, OpenCodeMessageResponse } from './client.js';
export { resolveOrchestrationConfig, assertModelsConfigured } from './config.js';
export { parseBreakdown, stripJsonFences } from './schema.js';
export { buildDependencyTiers } from './tiers.js';
export type { DependencyTiers } from './tiers.js';
export { runSwarm } from './scheduler.js';
export type { SwarmOptions, SwarmOutcome } from './scheduler.js';
export { detectFileGateViolations, enforceFileGate } from './file-gate.js';
export type { FileGateResult } from './file-gate.js';
export { ORCHESTRATION_AGENT_ASSETS } from './agents.js';
export type { OrchestrationAsset } from './agents.js';
export type {
  ExecutionMode,
  SubTask,
  TaskBreakdown,
  SubtaskResult,
  Verdict,
  OrchestrationModels,
  OrchestrationRuntimeConfig,
  OrchestrationOutcome,
} from './types.js';
