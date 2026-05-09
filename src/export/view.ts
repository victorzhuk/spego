import type { ArtifactEngine } from '../artifacts/engine.js';
import type { ArtifactRecord } from '../artifacts/types.js';
import type { IndexedArtifact } from '../index/indexer.js';

export interface ViewOptions {
  /** Filter to a single artifact type. */
  type?: string;
  /** Filter to a single artifact id. */
  id?: string;
  /** Read a specific revision instead of the latest. Requires `id`. */
  revision?: number;
  /** Include soft-deleted artifacts. */
  includeDeleted?: boolean;
}

export interface MarkdownBundle {
  format: 'markdown';
  content: string;
  count: number;
}

export interface JsonArtifact {
  id: string;
  type: string;
  slug: string;
  title: string;
  revision: number;
  latestRevision: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  meta: Record<string, unknown>;
  body: string;
  path: string;
}

export interface JsonBundle {
  format: 'json';
  count: number;
  artifacts: JsonArtifact[];
}

interface CollectedArtifact {
  indexed: IndexedArtifact;
  record: ArtifactRecord;
  /** Whether `record` reflects the requested revision (vs latest). */
  revisionRequested: number | null;
}

async function collect(
  engine: ArtifactEngine,
  opts: ViewOptions,
): Promise<CollectedArtifact[]> {
  const out: CollectedArtifact[] = [];
  const list = engine.list({ type: opts.type, includeDeleted: opts.includeDeleted });
  const filtered = opts.id ? list.filter((a) => a.id === opts.id) : list;
  for (const indexed of filtered) {
    if (opts.id && opts.revision !== undefined) {
      const record = await engine.readRevision(indexed.id, opts.revision);
      out.push({ indexed, record, revisionRequested: opts.revision });
    } else {
      const record = await engine.readForIndexed(indexed);
      out.push({ indexed, record, revisionRequested: null });
    }
  }
  return out;
}

/** Render the artifact set as a markdown bundle grouped by type. */
export function renderMarkdownBundle(items: CollectedArtifact[]): MarkdownBundle {
  if (items.length === 0) {
    return { format: 'markdown', content: '_No artifacts found._\n', count: 0 };
  }
  const byType = new Map<string, CollectedArtifact[]>();
  for (const item of items) {
    const key = item.record.frontmatter.type;
    const list = byType.get(key) ?? [];
    list.push(item);
    byType.set(key, list);
  }
  const sections: string[] = [];
  for (const [type, group] of [...byType.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    sections.push(`# ${type}\n`);
    for (const item of group) {
      const fm = item.record.frontmatter;
      sections.push(
        `## ${fm.title}\n`,
        `- id: \`${fm.id}\``,
        `- type: \`${fm.type}\``,
        `- revision: ${fm.revision}${
          item.revisionRequested !== null && item.revisionRequested !== item.indexed.revision
            ? ` (latest: ${item.indexed.revision})`
            : ''
        }`,
        `- updated: ${fm.updatedAt}`,
        '',
        item.record.body.trimEnd(),
        '',
      );
    }
  }
  return {
    format: 'markdown',
    content: `${sections.join('\n')}\n`,
    count: items.length,
  };
}

/** Render the artifact set as JSON for programmatic consumers. */
export function renderJsonBundle(items: CollectedArtifact[]): JsonBundle {
  return {
    format: 'json',
    count: items.length,
    artifacts: items.map((item) => ({
      id: item.record.frontmatter.id,
      type: item.record.frontmatter.type,
      slug: item.record.frontmatter.slug,
      title: item.record.frontmatter.title,
      revision: item.record.frontmatter.revision,
      latestRevision: item.indexed.revision,
      createdAt: item.record.frontmatter.createdAt,
      updatedAt: item.record.frontmatter.updatedAt,
      deletedAt: item.record.frontmatter.deletedAt ?? null,
      meta: item.record.frontmatter.meta ?? {},
      body: item.record.body,
      path: item.record.path,
    })),
  };
}

export interface ViewResult {
  markdown: MarkdownBundle;
  json: JsonBundle;
}

/** Convenience that returns both renderings; the CLI picks one. */
export async function viewArtifacts(
  engine: ArtifactEngine,
  opts: ViewOptions = {},
): Promise<ViewResult> {
  const items = await collect(engine, opts);
  return {
    markdown: renderMarkdownBundle(items),
    json: renderJsonBundle(items),
  };
}
