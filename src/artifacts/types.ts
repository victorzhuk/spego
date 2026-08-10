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
 'epic',
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

/**
 * Fixed Size Tier scale for change pricing — epic `tier` values and the keys
 * of every `flows` hours table. Fixed in code so every profile table's
 * validity is independent of config, and every project agrees on what `m`
 * means. Adding a tier is a schema change.
 */
export const SIZE_TIERS = ['xs', 's', 'm', 'l', 'xl'] as const;
export type SizeTier = (typeof SIZE_TIERS)[number];

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
