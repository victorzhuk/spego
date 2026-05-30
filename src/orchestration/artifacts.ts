/**
 * Run-artifact persistence. The breakdown, per-sub-task results, swarm log,
 * and final verdict are written under the configured work dir so a run can be
 * inspected after completion.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

export async function ensureWorkDir(projectRoot: string, workDir: string): Promise<string> {
  const abs = path.isAbsolute(workDir) ? workDir : path.join(projectRoot, workDir);
  await fs.mkdir(abs, { recursive: true });
  return abs;
}

export async function saveArtifact(workDirAbs: string, name: string, data: unknown): Promise<void> {
  const payload = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  await fs.writeFile(path.join(workDirAbs, name), payload, 'utf8');
}

export async function appendLog(workDirAbs: string, line: string): Promise<void> {
  await fs.appendFile(path.join(workDirAbs, 'swarm.log'), `${line}\n`, 'utf8');
}
