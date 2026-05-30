/**
 * Schema validation and parsing for the manager's TaskBreakdown contract.
 *
 * The manager is instructed to emit snake_case JSON. This module strips any
 * markdown code fences, parses the JSON, validates it against a zod schema,
 * and normalizes it into the camelCase {@link TaskBreakdown} model.
 */

import { z } from 'zod';
import { SpegoError } from '../errors.js';
import type { TaskBreakdown } from './types.js';

const subTaskSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().default(''),
    description: z.string().default(''),
    files: z.array(z.string()).default([]),
    acceptance_criteria: z.array(z.string()).default([]),
    depends_on: z.array(z.string()).default([]),
    priority: z.number().int().default(0),
    model_override: z.string().optional(),
  })
  .transform((s) => ({
    id: s.id,
    title: s.title,
    description: s.description,
    files: s.files,
    acceptanceCriteria: s.acceptance_criteria,
    dependsOn: s.depends_on,
    priority: s.priority,
    modelOverride: s.model_override,
  }));

const breakdownSchema = z
  .object({
    goal: z.string().min(1),
    context_summary: z.string().default(''),
    execution_mode: z.enum(['sequential', 'parallel', 'adaptive']).default('adaptive'),
    test_command: z.string().default(''),
    language: z.string().default('unknown'),
    subtasks: z.array(subTaskSchema).min(1),
  })
  .transform((b) => ({
    goal: b.goal,
    contextSummary: b.context_summary,
    executionMode: b.execution_mode,
    testCommand: b.test_command,
    language: b.language,
    subtasks: b.subtasks,
  }));

/** Remove a leading/trailing ```json … ``` markdown fence if present. */
export function stripJsonFences(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith('```')) return trimmed;
  const lines = trimmed.split('\n');
  const inner = lines[lines.length - 1]?.startsWith('```') ? lines.slice(1, -1) : lines.slice(1);
  return inner.join('\n').trim();
}

/** Parse and validate raw manager output into a {@link TaskBreakdown}. */
export function parseBreakdown(raw: string): TaskBreakdown {
  const stripped = stripJsonFences(raw);
  let data: unknown;
  try {
    data = JSON.parse(stripped);
  } catch (err) {
    throw new SpegoError('ORCHESTRATION_INVALID_BREAKDOWN', 'Manager returned non-JSON output', {
      cause: (err as Error).message,
      raw: raw.slice(0, 500),
    });
  }
  const parsed = breakdownSchema.safeParse(data);
  if (!parsed.success) {
    throw new SpegoError('ORCHESTRATION_INVALID_BREAKDOWN', 'Manager breakdown failed schema validation', {
      issues: parsed.error.issues,
    });
  }
  return parsed.data;
}
