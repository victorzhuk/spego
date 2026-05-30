/**
 * Resolve orchestration runtime settings from workspace config plus
 * environment-variable overrides.
 *
 * No fictional model identifier is committed as a default — model ids default
 * to empty and MUST be supplied via `.spego/config.yaml` or the environment.
 */

import type { WorkspaceConfig } from '../workspace/config.js';
import { SpegoError } from '../errors.js';
import type { OrchestrationRuntimeConfig } from './types.js';

type Env = Record<string, string | undefined>;

function pick(env: Env, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = env[key];
    if (value !== undefined && value !== '') return value;
  }
  return undefined;
}

export function resolveOrchestrationConfig(
  config: WorkspaceConfig,
  env: Env = process.env,
): OrchestrationRuntimeConfig {
  const block = config.orchestration;
  const maxParallelEnv = pick(env, 'SPEGO_ORCHESTRATION_MAX_PARALLEL');
  const maxParallel = maxParallelEnv ? Number(maxParallelEnv) : block.maxParallel;

  return {
    serverUrl: pick(env, 'SPEGO_ORCHESTRATION_SERVER_URL', 'OPENCODE_BASE_URL') ?? block.serverUrl,
    models: {
      manager: pick(env, 'SPEGO_ORCHESTRATION_MODEL_MANAGER') ?? block.models.manager,
      worker: pick(env, 'SPEGO_ORCHESTRATION_MODEL_WORKER') ?? block.models.worker,
      verifier: pick(env, 'SPEGO_ORCHESTRATION_MODEL_VERIFIER') ?? block.models.verifier,
      fallback: pick(env, 'SPEGO_ORCHESTRATION_MODEL_FALLBACK') ?? block.models.fallback,
    },
    maxParallel: Number.isFinite(maxParallel) && maxParallel > 0 ? Math.floor(maxParallel) : 1,
    workDir: pick(env, 'SPEGO_ORCHESTRATION_WORK_DIR') ?? block.workDir,
    username: pick(env, 'OPENCODE_SERVER_USERNAME'),
    password: pick(env, 'OPENCODE_SERVER_PASSWORD'),
  };
}

/** Throw if a model required to run the pipeline is not configured. */
export function assertModelsConfigured(rc: OrchestrationRuntimeConfig): void {
  const missing = (['manager', 'worker', 'verifier'] as const).filter((tier) => !rc.models[tier]);
  if (missing.length > 0) {
    throw new SpegoError(
      'ORCHESTRATION_NOT_CONFIGURED',
      `Orchestration model(s) not configured: ${missing.join(', ')}`,
      {
        missing,
        hint: 'Set orchestration.models in .spego/config.yaml or SPEGO_ORCHESTRATION_MODEL_* env vars',
      },
    );
  }
}
