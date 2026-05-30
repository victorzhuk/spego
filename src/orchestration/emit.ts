/**
 * Emit the OpenCode orchestration assets (agent prompts + the orchestrate
 * command) under `.opencode/`. Reuses the generator's marker-aware writer so
 * user-authored files are never clobbered and regeneration is deterministic.
 */

import path from 'node:path';
import { writeGeneratedFile } from '../generator/write.js';
import { GENERATOR_VERSION } from '../generator/types.js';
import type { GenerationReport, GeneratedFile } from '../generator/types.js';
import { ORCHESTRATION_AGENT_ASSETS } from './agents.js';

export async function emitOrchestrationAssets(projectRoot: string): Promise<GenerationReport> {
  const files: GeneratedFile[] = [];
  for (const asset of ORCHESTRATION_AGENT_ASSETS) {
    const absPath = path.join(projectRoot, asset.relPath);
    const action = await writeGeneratedFile(absPath, asset.content);
    files.push({ path: absPath, action });
  }
  return { target: 'opencode-orchestration', files, version: GENERATOR_VERSION };
}
