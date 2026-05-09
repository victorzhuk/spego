import fs from 'node:fs/promises';
import YAML from 'yaml';
import { z } from 'zod';
import { SpegoError } from '../errors.js';
import { BUILTIN_ARTIFACT_TYPES } from '../artifacts/types.js';

export const SUPPORTED_AGENTS = ['claude', 'cursor', 'opencode', 'amp'] as const;
export type SupportedAgent = (typeof SUPPORTED_AGENTS)[number];

export const workspaceConfigSchema = z
  .object({
    /** Schema version. Bump when config layout changes. */
    version: z.literal(1).default(1),
    /** Agent toolchains the workspace targets. */
    agents: z.array(z.string()).default(['claude']),
    /** Whether init seeded demo artifacts. */
    demo: z.boolean().default(false),
    /** Built-in types are always allowed; this list extends them. */
    extraArtifactTypes: z.array(z.string().min(1).regex(/^[a-z0-9][a-z0-9-]*$/, {
      message: 'Artifact type must be lowercase alphanumeric with hyphens, starting with alphanumeric',
    })).default([]),
    deliveryAdapter: z.object({
      name: z.string().default('openspec'),
      options: z.record(z.string(), z.unknown()).default({}),
    }).default({ name: 'openspec', options: {} }),
  })
  .strict();

export type WorkspaceConfig = z.infer<typeof workspaceConfigSchema>;

export function defaultConfig(overrides: Partial<WorkspaceConfig> = {}): WorkspaceConfig {
  return workspaceConfigSchema.parse({
    version: 1,
    agents: overrides.agents ?? ['claude'],
    demo: overrides.demo ?? false,
    extraArtifactTypes: overrides.extraArtifactTypes ?? [],
  });
}

export async function readConfig(configPath: string): Promise<WorkspaceConfig> {
  let raw: string;
  try {
    raw = await fs.readFile(configPath, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new SpegoError('WORKSPACE_NOT_FOUND', `No spego workspace config at ${configPath}`, {
        path: configPath,
      });
    }
    throw err;
  }
  const data = YAML.parse(raw) ?? {};
  const parsed = workspaceConfigSchema.safeParse(data);
  if (!parsed.success) {
    throw new SpegoError('VALIDATION_FAILED', 'Invalid workspace config', {
      path: configPath,
      issues: parsed.error.issues,
    });
  }
  return parsed.data;
}

export async function writeConfig(configPath: string, config: WorkspaceConfig): Promise<void> {
  const yaml = YAML.stringify(config, { lineWidth: 0 });
  await fs.writeFile(configPath, yaml, 'utf8');
}

/** Returns the union of built-in and user-extended artifact types. */
export function knownArtifactTypes(config: WorkspaceConfig): Set<string> {
  return new Set<string>([...BUILTIN_ARTIFACT_TYPES, ...config.extraArtifactTypes]);
}
