import { z } from 'zod';
import { SpegoError } from '../errors.js';
import { knownArtifactTypes, type WorkspaceConfig } from '../workspace/config.js';
import { validateMetaForType } from './schemas.js';

/** User-supplied input for create. */
export const createArtifactInputSchema = z
  .object({
    type: z.string().min(1),
    title: z.string().min(1, 'title is required'),
    body: z.string().default(''),
    slug: z.string().min(1).optional(),
    meta: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();

export type CreateArtifactInput = z.infer<typeof createArtifactInputSchema>;

/** User-supplied input for update. Identifier uses one of id or {type, slug}. */
export const updateArtifactInputSchema = z
  .object({
    title: z.string().min(1).optional(),
    body: z.string().optional(),
    meta: z.record(z.string(), z.unknown()).optional(),
    /** Optimistic-concurrency revision the agent based the edit on. */
    expectedRevision: z.number().int().positive().optional(),
  })
  .strict();

export type UpdateArtifactInput = z.infer<typeof updateArtifactInputSchema>;

const SAFE_TYPE_RE = /^[a-z0-9][a-z0-9-]*$/;

export function assertSupportedType(type: string, config: WorkspaceConfig): void {
  if (!SAFE_TYPE_RE.test(type)) {
    throw new SpegoError('INVALID_ARTIFACT_TYPE', `Invalid artifact type format: ${type}`, {
      type,
      hint: 'Type must be lowercase alphanumeric with hyphens.',
    });
  }
  if (!knownArtifactTypes(config).has(type)) {
    throw new SpegoError('INVALID_ARTIFACT_TYPE', `Unsupported artifact type: ${type}`, {
      type,
      hint: `Register the type via workspace config (extraArtifactTypes) to allow it.`,
    });
  }
}

export function parseCreateInput(input: unknown): CreateArtifactInput {
  const result = createArtifactInputSchema.safeParse(input);
  if (!result.success) {
    throw new SpegoError('VALIDATION_FAILED', 'Invalid create-artifact input', {
      issues: result.error.issues,
    });
  }
  return result.data;
}

export function parseUpdateInput(input: unknown): UpdateArtifactInput {
  const result = updateArtifactInputSchema.safeParse(input);
  if (!result.success) {
    throw new SpegoError('VALIDATION_FAILED', 'Invalid update-artifact input', {
      issues: result.error.issues,
    });
  }
  return result.data;
}

export function validateArtifactMeta(type: string, meta: unknown): Record<string, unknown> {
  try {
    return validateMetaForType(type, meta);
  } catch (err) {
    if (err instanceof Error && 'issues' in err) {
      throw new SpegoError('VALIDATION_FAILED', `Invalid metadata for artifact type: ${type}`, {
        type,
        issues: (err as { issues: unknown[] }).issues,
      });
    }
    throw err;
  }
}
