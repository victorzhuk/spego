import { z } from 'zod';

/**
 * Built-in artifact types from the product spec. Custom types may be added
 * via workspace config (see config schema).
 */
export const BUILTIN_ARTIFACT_TYPES = [
  'prd',
  'okr',
  'retro',
  'sprint-plan',
  'brainstorm',
  'usecases',
  'design',
  'api',
  'architecture',
  'decision',
  'risk',
  'qa',
  'ceremony',
] as const;

export type BuiltinArtifactType = (typeof BUILTIN_ARTIFACT_TYPES)[number];
export type ArtifactType = string;

/** ISO-8601 datetime string. */
export const isoDateTime = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), { message: 'must be an ISO-8601 datetime' });

/**
 * Frontmatter persisted at the top of every artifact markdown file.
 * Mirrored into SQLite for fast listing/filter; markdown is the source of truth.
 */
export const artifactFrontmatterSchema = z
  .object({
    id: z.string().min(1),
    type: z.string().min(1),
    title: z.string().min(1, 'title is required'),
    slug: z.string().min(1),
    revision: z.number().int().positive(),
    createdAt: isoDateTime,
    updatedAt: isoDateTime,
    deletedAt: isoDateTime.nullable().optional(),
    meta: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();

export type ArtifactFrontmatter = z.infer<typeof artifactFrontmatterSchema>;

export interface ArtifactRecord {
  frontmatter: ArtifactFrontmatter;
  body: string;
  /** Absolute path of the canonical markdown file. */
  path: string;
}
