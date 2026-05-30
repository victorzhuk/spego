/**
 * Manager step: send the requirement to the manager agent, validate the
 * returned breakdown against the schema, persist it, and return the model.
 */

import { extractText } from './client.js';
import type { OpenCodeApi } from './client.js';
import { parseBreakdown } from './schema.js';
import { MANAGER_SYSTEM_PROMPT } from './prompts.js';
import { saveArtifact } from './artifacts.js';
import type { TaskBreakdown } from './types.js';

export interface ManagerOptions {
  requirement: string;
  model: string;
  agentName: string;
  workDirAbs: string;
}

export async function runManager(api: OpenCodeApi, opts: ManagerOptions): Promise<TaskBreakdown> {
  const session = await api.createSession('spego-orchestrate-manager');
  try {
    const response = await api.sendMessage(session.id, {
      text: opts.requirement,
      model: opts.model,
      agent: opts.agentName,
      system: MANAGER_SYSTEM_PROMPT,
    });
    const breakdown = parseBreakdown(extractText(response));
    await saveArtifact(opts.workDirAbs, 'breakdown.json', breakdown);
    return breakdown;
  } finally {
    await api.deleteSession(session.id).catch(() => undefined);
  }
}
