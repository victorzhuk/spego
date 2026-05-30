/**
 * Top-level orchestration entrypoint.
 *
 * Reads a named OpenSpec change read-only, then runs the manager → swarm →
 * verifier pipeline through the OpenCode REST API and returns a structured
 * outcome. OpenSpec lifecycle state (apply/verify/sync/archive) is never
 * mutated; only the working tree may change as workers implement sub-tasks.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { resolveWorkspacePaths } from '../workspace/paths.js';
import { readConfig } from '../workspace/config.js';
import { discoverChanges } from '../delivery/openspec-discover.js';
import { SpegoError } from '../errors.js';
import { OpenCodeClient } from './client.js';
import type { OpenCodeApi } from './client.js';
import { resolveOrchestrationConfig, assertModelsConfigured } from './config.js';
import { ensureWorkDir, saveArtifact, appendLog } from './artifacts.js';
import { runManager } from './manager.js';
import { runWorker } from './worker.js';
import { runVerifier } from './verifier.js';
import { runSwarm } from './scheduler.js';
import type { ExecutionMode, OrchestrationOutcome, Verdict } from './types.js';

export const AGENT_MANAGER = 'ultramanager';
export const AGENT_WORKER = 'ultraworker';
export const AGENT_VERIFIER = 'ultraverifier';

export interface OrchestrateOptions {
  projectRoot: string;
  changeName: string;
  mode?: ExecutionMode;
  skipVerify?: boolean;
  /** Inject a backend for testing; defaults to a real {@link OpenCodeClient}. */
  client?: OpenCodeApi;
  env?: Record<string, string | undefined>;
}

async function readMaybe(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return '';
  }
}

async function buildRequirement(projectRoot: string, relPath: string): Promise<string> {
  const dir = path.join(projectRoot, relPath);
  const proposal = await readMaybe(path.join(dir, 'proposal.md'));
  const design = await readMaybe(path.join(dir, 'design.md'));
  const tasks = await readMaybe(path.join(dir, 'tasks.md'));

  let specSections = '';
  try {
    const specsDir = path.join(dir, 'specs');
    const entries = await fs.readdir(specsDir, { recursive: true });
    const mdFiles = (entries as string[]).filter((e) => e.endsWith('.md')).sort();
    if (mdFiles.length > 0) {
      const parts = await Promise.all(
        mdFiles.map(async (f) => {
          const content = await readMaybe(path.join(specsDir, f));
          return content.trim()
            ? `### ${path.basename(f, '.md')}\n\n${content.trim()}`
            : '';
        }),
      );
      specSections = parts.filter(Boolean).join('\n\n');
    }
  } catch {
    // specs dir may not exist
  }

  return [
    '# Change requirement',
    proposal.trim(),
    design.trim() ? `## Design\n\n${design.trim()}` : '',
    specSections ? `## Specs\n\n${specSections}` : '',
    tasks.trim() ? `## Planned tasks\n\n${tasks.trim()}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

export async function orchestrateChange(opts: OrchestrateOptions): Promise<OrchestrationOutcome> {
  const projectRoot = path.resolve(opts.projectRoot);
  const wsPaths = resolveWorkspacePaths(projectRoot);
  const config = await readConfig(wsPaths.configPath);
  const rc = resolveOrchestrationConfig(config, opts.env);

  const changes = await discoverChanges(projectRoot);
  const change = changes.find((c) => c.name === opts.changeName && !c.archived);
  if (!change) {
    throw new SpegoError('CHANGE_NOT_FOUND', `OpenSpec change "${opts.changeName}" not found`, {
      changeName: opts.changeName,
    });
  }

  assertModelsConfigured(rc);

  const requirement = await buildRequirement(projectRoot, change.relPath);
  const workDirAbs = await ensureWorkDir(projectRoot, path.join(rc.workDir, change.name));
  await saveArtifact(workDirAbs, 'requirement.md', requirement);

  const client =
    opts.client ??
    new OpenCodeClient({ baseUrl: rc.serverUrl, username: rc.username, password: rc.password });

  await client.health();

  const breakdown = await runManager(client, {
    requirement,
    model: rc.models.manager,
    agentName: AGENT_MANAGER,
    workDirAbs,
  });
  await appendLog(workDirAbs, `manager: ${breakdown.subtasks.length} sub-tasks (mode=${breakdown.executionMode})`);

  const swarm = await runSwarm(breakdown, {
    mode: opts.mode,
    maxParallel: rc.maxParallel,
    runTask: (task) =>
      runWorker(client, task, breakdown, {
        model: rc.models.worker,
        agentName: AGENT_WORKER,
        projectRoot,
        workDirAbs,
      }),
  });
  for (const warning of swarm.warnings) await appendLog(workDirAbs, `warning: ${warning}`);

  let verdict: Verdict;
  if (opts.skipVerify) {
    verdict = {
      passed: swarm.results.every((r) => r.success),
      testOutput: '',
      failingCriteria: [],
      regressions: [],
      notes: 'Verification skipped.',
      skipped: true,
    };
    await saveArtifact(workDirAbs, 'verdict.json', verdict);
  } else {
    verdict = await runVerifier(client, breakdown, swarm.results, {
      model: rc.models.verifier,
      agentName: AGENT_VERIFIER,
      workDirAbs,
    });
  }

  const tasksSucceeded = swarm.results.filter((r) => r.success).length;
  await appendLog(
    workDirAbs,
    `done: ${tasksSucceeded}/${swarm.results.length} succeeded; verdict=${verdict.passed ? 'PASS' : 'FAIL'}`,
  );

  return {
    changeName: change.name,
    goal: breakdown.goal,
    executionMode: opts.mode ?? breakdown.executionMode,
    tasksTotal: swarm.results.length,
    tasksSucceeded,
    results: swarm.results,
    verdict,
    warnings: swarm.warnings,
  };
}
