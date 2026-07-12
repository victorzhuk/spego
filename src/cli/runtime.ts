/**
 * Shared runtime for spego CLI command actions.
 *
 * Eliminates the per-command `try/catch/finally` boilerplate by routing every
 * command through `runCommand` (no engine) or `runEngineCommand` (auto-managed
 * `ArtifactEngine`). Each helper resolves the global `--json` flag, emits the
 * success payload through `output`, and routes errors through `fail`, so the
 * CLI surface stays small and uniform.
 */

import type { Command } from 'commander';
import { ArtifactEngine } from '../artifacts/engine.js';
import { output } from './output.js';
import { fail } from './errors.js';

export interface CommandResult<T> {
 payload: T;
 human: () => string;
}

interface RuntimeContext {
 program: Command;
}

export function getJsonMode(program: Command): boolean {
 return program.opts().json as boolean;
}

/** Run a command body that does not need an `ArtifactEngine`. */
export async function runCommand<T>(
 ctx: RuntimeContext,
 fn: (json: boolean) => Promise<CommandResult<T>>,
): Promise<void> {
 const json = getJsonMode(ctx.program);
 try {
  const { payload, human } = await fn(json);
  output(json, payload, human);
 } catch (err) {
  fail(err, json);
 }
}

/** Run a command body that needs an `ArtifactEngine`; the engine is closed on every exit path. */
export async function runEngineCommand<T>(
 ctx: RuntimeContext & { cwd?: string; jsonOverride?: boolean; validate?: () => Promise<void> | void },
 fn: (engine: ArtifactEngine, json: boolean) => Promise<CommandResult<T>>,
): Promise<void> {
 const json = ctx.jsonOverride ?? getJsonMode(ctx.program);
 let engine: ArtifactEngine;
 try {
  await ctx.validate?.();
  engine = await ArtifactEngine.open({ projectRoot: ctx.cwd });
 } catch (err) {
  fail(err, json);
 }
 try {
  const { payload, human } = await fn(engine, json);
  output(json, payload, human);
 } catch (err) {
  fail(err, json);
 } finally {
  engine.close();
 }
}
