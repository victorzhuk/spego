/**
 * Worker step: run one sub-task in an isolated session, parse the status
 * marker, collect the session diff, and enforce the file gate. Out-of-scope
 * edits are reverted and fail the sub-task.
 */

import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import { unlink } from 'node:fs/promises';
import { extractText } from './client.js';
import type { OpenCodeApi } from './client.js';
import { renderWorkerPrompt } from './prompts.js';
import { enforceFileGate } from './file-gate.js';
import { saveArtifact } from './artifacts.js';
import type { SubTask, SubtaskResult, TaskBreakdown } from './types.js';

const execFile = promisify(execFileCb);

const SUCCESS_MARKER = 'ULTRAWORKER_STATUS: SUCCESS';
const FAILURE_MARKER = 'ULTRAWORKER_STATUS: FAILED';

export interface WorkerOptions {
  model: string;
  agentName: string;
  projectRoot: string;
  workDirAbs: string;
  /** Override for the revert mechanism (defaults to `git checkout --`). */
  revert?: (path: string) => Promise<void> | void;
}

function extractFailureReason(text: string): string {
  const idx = text.indexOf(FAILURE_MARKER);
  if (idx === -1) return 'unknown';
  return text
    .slice(idx + FAILURE_MARKER.length)
    .replace(/^[\s—-]+/, '')
    .trim()
    .slice(0, 300);
}

async function revertFile(projectRoot: string, filePath: string): Promise<void> {
  await execFile('git', ['checkout', 'HEAD', '--', filePath], { cwd: projectRoot }).catch(() => undefined);
  try {
    await execFile('git', ['ls-files', '--error-unmatch', filePath], { cwd: projectRoot });
  } catch {
    await unlink(filePath).catch(() => undefined);
  }
}

export async function runWorker(
  api: OpenCodeApi,
  task: SubTask,
  breakdown: TaskBreakdown,
  opts: WorkerOptions,
): Promise<SubtaskResult> {
  const session = await api.createSession(`spego-orchestrate-worker-${task.id}`);
  const revert = opts.revert ?? ((p: string) => revertFile(opts.projectRoot, p));

  let result: SubtaskResult;
  try {
    const response = await api.sendMessage(session.id, {
      text: renderWorkerPrompt(task, breakdown),
      model: task.modelOverride ?? opts.model,
      agent: opts.agentName,
    });
    const text = extractText(response);
    const reportedSuccess = text.includes(SUCCESS_MARKER);

    const diff = await api.getSessionDiff(session.id);
    const changedFiles = diff.map((d) => d.path).filter((p): p is string => typeof p === 'string');

    const { violations } = await enforceFileGate({ changedPaths: changedFiles, allowed: task.files, revert });

    const success = reportedSuccess && violations.length === 0;
    const error = success
      ? undefined
      : violations.length > 0
        ? `file gate violations: ${violations.join(', ')}`
        : extractFailureReason(text);

    result = {
      subtaskId: task.id,
      sessionId: session.id,
      success,
      summary: text.slice(-2000),
      changedFiles: changedFiles.filter((p) => !violations.includes(p)),
      gateViolations: violations,
      error,
    };
  } catch (err) {
    result = {
      subtaskId: task.id,
      sessionId: session.id,
      success: false,
      summary: '',
      changedFiles: [],
      gateViolations: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }

  await saveArtifact(opts.workDirAbs, `result_${task.id}.json`, result);
  return result;
}
