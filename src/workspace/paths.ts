import fs from 'node:fs/promises';
import { SpegoError } from '../errors.js';

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

/** Resolve the real (symlink-free) root. Falls back to path.resolve on non-existent paths. */
export async function resolveRealRoot(projectRoot: string): Promise<string> {
 try {
  return await fs.realpath(path.resolve(projectRoot));
 } catch (err) {
  if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
   return path.resolve(projectRoot);
  }
  throw err;
 }
}

/** Reject if target path exists and is a symbolic link; no-op if missing. */
export async function rejectIfSymlink(targetPath: string): Promise<void> {
 let stat;
 try {
  stat = await fs.lstat(targetPath);
 } catch (err) {
  if ((err as NodeJS.ErrnoException).code === 'ENOENT') return;
  throw err;
 }
 if (stat.isSymbolicLink()) {
  throw new SpegoError(
   'WORKSPACE_CONTAINMENT',
   `Symlink detected at ${targetPath}`,
   { path: targetPath },
  );
 }
}

/** Assert a resolved path is strictly inside the workspace root. */
export function assertContained(resolvedRoot: string, targetPath: string): void {
 const target = path.resolve(targetPath);
 const root = resolvedRoot.endsWith(path.sep) ? resolvedRoot : resolvedRoot + path.sep;
 if (target !== resolvedRoot && !target.startsWith(root)) {
  throw new SpegoError(
   'WORKSPACE_CONTAINMENT',
   `Path escapes workspace: ${targetPath}`,
   { path: targetPath, resolvedRoot },
  );
 }
}

/**
 * Realpath-verify that targetPath's parent is strictly within resolvedRoot.
 * For non-existent parents the string-level containment check is used since
 * there is no symlink to follow.
 */
export async function assertParentContained(resolvedRoot: string, targetPath: string): Promise<void> {
 const parent = path.dirname(targetPath);
 assertContained(resolvedRoot, parent);
 try {
  const real = await fs.realpath(parent);
  assertContained(resolvedRoot, real);
 } catch (err) {
  if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
 }
}
