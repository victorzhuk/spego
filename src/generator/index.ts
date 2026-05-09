import type { TargetGenerator, GenerationReport } from './types.js';
import { ClaudeGenerator } from './claude.js';

const GENERATORS: Map<string, TargetGenerator> = new Map();

export function registerGenerator(gen: TargetGenerator): void {
  GENERATORS.set(gen.targetName, gen);
}

export function getGenerator(target: string): TargetGenerator | undefined {
  return GENERATORS.get(target);
}

export function availableTargets(): string[] {
  return [...GENERATORS.keys()];
}

registerGenerator(new ClaudeGenerator());

export async function generateAll(
  projectRoot: string,
  targets: string[],
): Promise<GenerationReport[]> {
  const reports: GenerationReport[] = [];
  for (const target of targets) {
    const gen = getGenerator(target);
    if (!gen) continue;
    reports.push(await gen.generate(projectRoot));
  }
  return reports;
}
