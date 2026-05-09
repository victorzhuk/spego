import slugify from 'slugify';

const SLUG_OPTS = { lower: true, strict: true, trim: true } as const;

/**
 * Derive a filesystem-safe slug from a title.
 * Falls back to a timestamped slug when the title produces an empty result.
 */
export function makeSlug(title: string): string {
  const base = slugify(title, SLUG_OPTS);
  if (base.length > 0) return base;
  return `artifact-${Date.now()}`;
}

/**
 * Disambiguate a desired slug against an existing set, appending `-2`, `-3`, ...
 */
export function uniqueSlug(desired: string, existing: ReadonlySet<string>): string {
  if (!existing.has(desired)) return desired;
  let n = 2;
  while (existing.has(`${desired}-${n}`)) n += 1;
  return `${desired}-${n}`;
}
