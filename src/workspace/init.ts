import fs from 'node:fs/promises';
import path from 'node:path';
import { resolveWorkspacePaths, type WorkspacePaths } from './paths.js';
import { defaultConfig, readConfig, writeConfig, type WorkspaceConfig } from './config.js';
import { BUILTIN_ARTIFACT_TYPES } from '../artifacts/types.js';
import { openIndexDb, ensureIndexSchema, closeIndexDb } from '../index/db.js';
import { generateAll } from '../generator/index.js';
import type { GenerationReport } from '../generator/types.js';

export interface InitOptions {
  /** Project root containing (or to contain) `.spego/`. Defaults to cwd. */
  projectRoot?: string;
  /** Agents to register skills for (informational in MVP). */
  agents?: string[];
  /** Seed demo content (placeholder for future demo bundle). */
  demo?: boolean;
  /** Re-create files even if they exist. Does not delete user artifacts. */
  force?: boolean;
}

export interface InitSummary {
  projectRoot: string;
  workspaceRoot: string;
  configPath: string;
  artifactsRoot: string;
  revisionsRoot: string;
  indexPath: string;
  createdPaths: string[];
  alreadyInitialized: boolean;
  config: WorkspaceConfig;
  generationReports: GenerationReport[];
}

async function ensureDir(dir: string, created: string[]): Promise<void> {
  try {
    await fs.mkdir(dir, { recursive: false });
    created.push(dir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'EEXIST') return;
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      // Parent does not exist yet; create recursively then mark.
      await fs.mkdir(dir, { recursive: true });
      created.push(dir);
      return;
    }
    throw err;
  }
}

export async function initWorkspace(options: InitOptions = {}): Promise<InitSummary> {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
  const paths = resolveWorkspacePaths(projectRoot);
  const created: string[] = [];

  // Detect prior workspace state before any side effects.
  let existingConfig: WorkspaceConfig | null = null;
  try {
    existingConfig = await readConfig(paths.configPath);
  } catch {
    existingConfig = null;
  }

  // Workspace + subdirs.
  await ensureDir(paths.workspaceRoot, created);
  await ensureDir(paths.artifactsRoot, created);
  await ensureDir(paths.revisionsRoot, created);
  await ensureDir(paths.indexRoot, created);

  // Per-type directories so a fresh workspace is browsable.
  for (const type of BUILTIN_ARTIFACT_TYPES) {
    await ensureDir(path.join(paths.artifactsRoot, type), created);
    await ensureDir(path.join(paths.revisionsRoot, type), created);
  }

  // Config: write only if missing or force.
  let config: WorkspaceConfig;
  if (existingConfig && !options.force) {
    config = existingConfig;
  } else {
    config = defaultConfig({
      agents: options.agents ?? existingConfig?.agents ?? ['claude'],
      demo: options.demo ?? existingConfig?.demo ?? false,
      extraArtifactTypes: existingConfig?.extraArtifactTypes ?? [],
    });
    await writeConfig(paths.configPath, config);
    if (!existingConfig) created.push(paths.configPath);
  }

  // SQLite index: create file + schema.
  const db = openIndexDb(paths.indexDbPath);
  try {
    ensureIndexSchema(db);
  } finally {
    closeIndexDb(db);
  }
  // We can't easily detect "newly created" for the db file without a stat
  // beforehand; treat its presence as informational rather than tracked.

  let generationReports: GenerationReport[] = [];
  if (config.agents.length > 0) {
    generationReports = await generateAll(projectRoot, config.agents);
  }

  return {
    projectRoot: paths.projectRoot,
    workspaceRoot: paths.workspaceRoot,
    configPath: paths.configPath,
    artifactsRoot: paths.artifactsRoot,
    revisionsRoot: paths.revisionsRoot,
    indexPath: paths.indexDbPath,
    createdPaths: created,
    alreadyInitialized: existingConfig !== null,
    config,
    generationReports,
  };
}

export interface WorkspaceStatus {
  initialized: boolean;
  projectRoot: string;
  workspaceRoot: string;
  configPath?: string;
  artifactsRoot?: string;
  indexPath?: string;
  agents?: string[];
  /** Hint command to run when not initialized. */
  initCommand?: string;
}

export async function workspaceStatus(projectRoot: string = process.cwd()): Promise<WorkspaceStatus> {
  const paths: WorkspacePaths = resolveWorkspacePaths(projectRoot);
  try {
    const config = await readConfig(paths.configPath);
    await fs.stat(paths.artifactsRoot);
    await fs.stat(paths.indexDbPath);
    return {
      initialized: true,
      projectRoot: paths.projectRoot,
      workspaceRoot: paths.workspaceRoot,
      configPath: paths.configPath,
      artifactsRoot: paths.artifactsRoot,
      indexPath: paths.indexDbPath,
      agents: config.agents,
    };
  } catch {
    return {
      initialized: false,
      projectRoot: paths.projectRoot,
      workspaceRoot: paths.workspaceRoot,
      initCommand: 'spego init',
    };
  }
}
