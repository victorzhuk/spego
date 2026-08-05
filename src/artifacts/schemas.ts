import { z } from 'zod';
import type { BuiltinArtifactType } from './types.js';

export const ARTIFACT_META_SCHEMAS: Record<string, z.ZodTypeAny> = {
  prd: z.object({
    status: z.enum(['draft', 'in-review', 'approved', 'archived']).optional(),
    tags: z.array(z.string()).optional(),
    stakeholders: z.array(z.string()).optional(),
    goal: z.string().optional(),
  }),

  okr: z.object({
    period: z.string().optional(),
    level: z.enum(['company', 'team', 'individual']).optional(),
    tags: z.array(z.string()).optional(),
  }),

  retro: z.object({
    sprint: z.string().optional(),
    date: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }),

  'sprint-plan': z
    .object({
      sprint: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      status: z.enum(['planned', 'active', 'closed']).optional(),
      tags: z.array(z.string()).optional(),
      changes: z.array(z.string().min(1)).optional(),
    })
    .refine((meta) => !meta.changes || new Set(meta.changes).size === meta.changes.length, {
      path: ['changes'],
      message: 'changes must be unique within a sprint-plan',
    }),

  epic: z.object({
    deps: z.array(z.string()).optional(),
    links: z.array(z.string()).optional(),
    requires: z.array(z.string().min(1)).optional(),
    status: z.enum(['backlog', 'in-progress', 'done', 'completed', 'blocked', 'paused', 'unknown']).optional(),
    gaps: z
      .array(
        z.object({
          flag: z.string().min(1),
          note: z.string().optional(),
        }),
      )
      .optional(),
    track: z.string().min(1).optional(),
    tags: z.array(z.string()).optional(),
  }),

  brainstorm: z.object({
    status: z.enum(['open', 'closed']).optional(),
    tags: z.array(z.string()).optional(),
  }),

  usecases: z.object({
    status: z.enum(['draft', 'reviewed', 'approved']).optional(),
    tags: z.array(z.string()).optional(),
  }),

  design: z.object({
    status: z.enum(['draft', 'in-review', 'approved']).optional(),
    category: z.enum(['ux', 'ui', 'workflow', 'system']).optional(),
    tags: z.array(z.string()).optional(),
  }),

  api: z.object({
    status: z.enum(['proposed', 'accepted', 'deprecated']).optional(),
    version: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }),

  architecture: z.object({
    status: z.enum(['proposed', 'accepted', 'superseded']).optional(),
    scope: z.enum(['system', 'service', 'module']).optional(),
    tags: z.array(z.string()).optional(),
  }),

  decision: z.object({
    status: z.enum(['proposed', 'accepted', 'deprecated', 'superseded']).optional(),
    tags: z.array(z.string()).optional(),
  }),

  risk: z.object({
    severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    likelihood: z.enum(['low', 'medium', 'high']).optional(),
    status: z.enum(['open', 'mitigated', 'closed']).optional(),
    tags: z.array(z.string()).optional(),
  }),

  qa: z.object({
    status: z.enum(['planned', 'in-progress', 'completed']).optional(),
    tags: z.array(z.string()).optional(),
  }),

  ceremony: z.object({
    kind: z.enum(['standup', 'review', 'retro', 'planning', 'other']).optional(),
    date: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }),
};

/**
 * One-line meta shape summary per built-in type, for agent-facing docs (generated
 * skill/command files). Keyed by the full type union so adding or removing a
 * built-in type is a compile error here — keep every line in sync with the
 * matching `ARTIFACT_META_SCHEMAS` entry above.
 */
export const ARTIFACT_META_DOCS: Record<BuiltinArtifactType, string> = {
  prd: 'status (draft|in-review|approved|archived), tags[], stakeholders[], goal',
  okr: 'period, level (company|team|individual), tags[]',
  retro: 'sprint, date, tags[]',
  'sprint-plan':
    'sprint, startDate, endDate, status (planned|active|closed), tags[], changes[] (change slugs; must be unique within the sprint)',
  epic: 'deps[] (change slugs this depends on), links[] (linked artifact ids), requires[] (labels for required supporting artifacts), status (backlog|in-progress|done|completed|blocked|paused|unknown), gaps[] ({flag, note?}), track (conflict lane; same track = do not run in parallel), tags[]',
  brainstorm: 'status (open|closed), tags[]',
  usecases: 'status (draft|reviewed|approved), tags[]',
  design: 'status (draft|in-review|approved), category (ux|ui|workflow|system), tags[]',
  api: 'status (proposed|accepted|deprecated), version, tags[]',
  architecture: 'status (proposed|accepted|superseded), scope (system|service|module), tags[]',
  decision: 'status (proposed|accepted|deprecated|superseded), tags[]',
  risk: 'severity (low|medium|high|critical), likelihood (low|medium|high), status (open|mitigated|closed), tags[]',
  qa: 'status (planned|in-progress|completed), tags[]',
  ceremony: 'kind (standup|review|retro|planning|other), date, tags[]',
};

export function validateMetaForType(type: string, meta: unknown): Record<string, unknown> {
  const schema = ARTIFACT_META_SCHEMAS[type];
  if (!schema) {
    return z.record(z.string(), z.unknown()).parse(meta);
  }
  return schema.parse(meta) as Record<string, unknown>;
}

export function hasTypeSchema(type: string): boolean {
  return type in ARTIFACT_META_SCHEMAS;
}
