import type { TargetGenerator, GenerationReport } from './types.js';
import { AgentsGenerator } from './agents.js';
import { OpencodeGenerator } from './opencode.js';

const GENERATORS: Map<string, TargetGenerator> = new Map();

/**
 * `claude` was the pre-v0.29 target name writing `.claude/skills`; it now
 * resolves to the universal `agents` target writing `.agents/skills`.
 */
const LEGACY_TARGET_ALIASES: Record<string, string> = {
  claude: 'agents',
};

export function registerGenerator(gen: TargetGenerator): void {
  GENERATORS.set(gen.targetName, gen);
}

export function getGenerator(target: string): TargetGenerator | undefined {
  return GENERATORS.get(target);
}

export function resolveTarget(target: string): string {
  return LEGACY_TARGET_ALIASES[target] ?? target;
}

export function availableTargets(): string[] {
  return [...GENERATORS.keys()];
}

registerGenerator(new AgentsGenerator());
registerGenerator(new OpencodeGenerator());

export interface GenerateAllOptions {
  emitWarnings?: boolean;
}

export async function generateAll(
  projectRoot: string,
  targets: string[],
  options: GenerateAllOptions = {},
): Promise<GenerationReport[]> {
  const emitWarnings = options.emitWarnings ?? true;
  const reports: GenerationReport[] = [];
  for (const target of targets) {
    const resolved = resolveTarget(target);
    const gen = getGenerator(resolved);
    if (!gen) {
      if (emitWarnings) {
        process.stderr.write(`warning: no generator registered for target "${target}", skipping\n`);
      }
      continue;
    }
    if (resolved !== target && emitWarnings) {
      process.stderr.write(
        `note: agent target "${target}" is a legacy alias for "${resolved}"; update agents in .spego/config.yaml\n`,
      );
    }
    reports.push(await gen.generate(projectRoot));
  }
  return reports;
}
