/**
 * Core data models for the ultracode multi-agent orchestration pipeline.
 *
 * Internal models use camelCase. The manager emits a snake_case JSON contract
 * (see `schema.ts`) which is normalized into these shapes before execution.
 */

export type ExecutionMode = 'sequential' | 'parallel' | 'adaptive';

export interface SubTask {
  id: string;
  title: string;
  description: string;
  /** Relative paths the worker may modify. Enforced by the file gate. */
  files: string[];
  acceptanceCriteria: string[];
  dependsOn: string[];
  priority: number;
  modelOverride?: string;
}

export interface TaskBreakdown {
  goal: string;
  contextSummary: string;
  executionMode: ExecutionMode;
  testCommand: string;
  language: string;
  subtasks: SubTask[];
}

/** A single changed-file entry from an OpenCode session diff. */
export interface DiffEntry {
  path: string;
  [key: string]: unknown;
}

export interface SubtaskResult {
  subtaskId: string;
  sessionId: string;
  success: boolean;
  summary: string;
  changedFiles: string[];
  /** Files reverted by the file gate because they were outside the allow-list. */
  gateViolations: string[];
  error?: string;
}

export interface Verdict {
  passed: boolean;
  testOutput: string;
  failingCriteria: string[];
  regressions: string[];
  notes: string;
  skipped?: boolean;
}

export interface OrchestrationModels {
  manager: string;
  worker: string;
  verifier: string;
  fallback: string;
}

/** Fully resolved orchestration runtime settings (config + env overrides). */
export interface OrchestrationRuntimeConfig {
  serverUrl: string;
  models: OrchestrationModels;
  maxParallel: number;
  workDir: string;
  username?: string;
  password?: string;
}

export interface OrchestrationOutcome {
  changeName: string;
  goal: string;
  executionMode: ExecutionMode;
  tasksTotal: number;
  tasksSucceeded: number;
  results: SubtaskResult[];
  verdict: Verdict;
  warnings: string[];
}
