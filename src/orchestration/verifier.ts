/**
 * Verifier step: run the breakdown test command, check acceptance criteria,
 * and emit a structured verdict. `passed` is true only when the test command
 * succeeds and all criteria are met. A missing test command fails the verdict
 * without consulting the backend.
 */

import { extractText } from './client.js';
import type { OpenCodeApi } from './client.js';
import { VERIFIER_SYSTEM_PROMPT, renderVerifierPrompt } from './prompts.js';
import { saveArtifact } from './artifacts.js';
import type { SubtaskResult, TaskBreakdown, Verdict } from './types.js';

export interface VerifierOptions {
  model: string;
  agentName: string;
  workDirAbs: string;
}

function coerceVerdict(raw: unknown): Verdict {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    passed: obj.passed === true,
    testOutput: typeof obj.test_output === 'string' ? obj.test_output : '',
    failingCriteria: Array.isArray(obj.failing_criteria) ? (obj.failing_criteria as string[]) : [],
    regressions: Array.isArray(obj.regressions) ? (obj.regressions as string[]) : [],
    notes: typeof obj.notes === 'string' ? obj.notes : '',
  };
}

export async function runVerifier(
  api: OpenCodeApi,
  breakdown: TaskBreakdown,
  results: SubtaskResult[],
  opts: VerifierOptions,
): Promise<Verdict> {
  if (!breakdown.testCommand.trim()) {
    const verdict: Verdict = {
      passed: false,
      testOutput: '',
      failingCriteria: [],
      regressions: [],
      notes: 'No test command provided in the breakdown; cannot verify.',
    };
    await saveArtifact(opts.workDirAbs, 'verdict.json', verdict);
    return verdict;
  }

  const payload = {
    goal: breakdown.goal,
    test_command: breakdown.testCommand,
    subtask_results: results.map((r) => ({
      id: r.subtaskId,
      success: r.success,
      summary_tail: r.summary.slice(-500),
      error: r.error,
      changed_files: r.changedFiles,
    })),
  };

  const session = await api.createSession('spego-orchestrate-verifier');
  try {
    const response = await api.sendMessage(session.id, {
      text: renderVerifierPrompt(payload),
      model: opts.model,
      agent: opts.agentName,
      system: VERIFIER_SYSTEM_PROMPT,
    });
    let parsed: unknown;
    try {
      parsed = JSON.parse(extractText(response));
    } catch {
      parsed = { passed: false, notes: 'Verifier returned non-JSON output.' };
    }
    const verdict = coerceVerdict(parsed);
    await saveArtifact(opts.workDirAbs, 'verdict.json', verdict);
    return verdict;
  } finally {
    await api.deleteSession(session.id).catch(() => undefined);
  }
}
