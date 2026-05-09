import { z } from 'zod';

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

  'sprint-plan': z.object({
    sprint: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    status: z.enum(['planned', 'active', 'closed']).optional(),
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
