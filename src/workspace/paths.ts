import path from 'node:path';

/**
 * `.spego/` workspace layout. Markdown files are the source of truth;
 * SQLite under `index/` is a rebuildable cache.
 */
export const WORKSPACE_DIR_NAME = '.spego';
export const ARTIFACTS_DIR_NAME = 'artifacts';
export const REVISIONS_DIR_NAME = 'revisions';
export const INDEX_DIR_NAME = 'index';
export const CONFIG_FILE_NAME = 'config.yaml';
export const INDEX_DB_FILE_NAME = 'spego.db';

export interface WorkspacePaths {
  /** Absolute project root (the directory containing `.spego/`). */
  projectRoot: string;
  /** Absolute path to `.spego/`. */
  workspaceRoot: string;
  /** Absolute path to `.spego/config.yaml`. */
  configPath: string;
  /** Absolute path to `.spego/artifacts/`. */
  artifactsRoot: string;
  /** Absolute path to `.spego/revisions/`. */
  revisionsRoot: string;
  /** Absolute path to `.spego/index/`. */
  indexRoot: string;
  /** Absolute path to `.spego/index/spego.db`. */
  indexDbPath: string;
}

export function resolveWorkspacePaths(projectRoot: string): WorkspacePaths {
  const root = path.resolve(projectRoot);
  const workspaceRoot = path.join(root, WORKSPACE_DIR_NAME);
  return {
    projectRoot: root,
    workspaceRoot,
    configPath: path.join(workspaceRoot, CONFIG_FILE_NAME),
    artifactsRoot: path.join(workspaceRoot, ARTIFACTS_DIR_NAME),
    revisionsRoot: path.join(workspaceRoot, REVISIONS_DIR_NAME),
    indexRoot: path.join(workspaceRoot, INDEX_DIR_NAME),
    indexDbPath: path.join(workspaceRoot, INDEX_DIR_NAME, INDEX_DB_FILE_NAME),
  };
}

export function artifactTypeDir(paths: WorkspacePaths, type: string): string {
  return path.join(paths.artifactsRoot, type);
}

export function artifactFilePath(paths: WorkspacePaths, type: string, slug: string): string {
  return path.join(paths.artifactsRoot, type, `${slug}.md`);
}

export function revisionFilePath(
  paths: WorkspacePaths,
  type: string,
  slug: string,
  revision: number,
): string {
  return path.join(paths.revisionsRoot, type, `${slug}.r${revision}.md`);
}
