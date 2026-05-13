import { describe, it, expect } from 'vitest';
import { WORKFLOW_REGISTRY, getWorkflowByName, listWorkflowNames } from '../src/workflows/registry.js';
import { ARTIFACT_META_SCHEMAS } from '../src/artifacts/schemas.js';

describe('Workflow registry', () => {
  it('contains both workflows', () => {
    expect(WORKFLOW_REGISTRY).toHaveLength(8);
    expect(listWorkflowNames()).toEqual([
      'brainstorm-party',
      'review-adversarial',
      'review-edge-cases',
      'editorial-prose',
      'editorial-structure',
      'help',
      'brainstorm-deep',
      'elicit',
    ]);
  });

  it('each workflow has at least 3 personas', () => {
    for (const wf of WORKFLOW_REGISTRY) {
      expect(wf.personas.length).toBeGreaterThanOrEqual(1);
      for (const p of wf.personas) {
        expect(p.name).toBeTruthy();
        expect(p.role).toBeTruthy();
        expect(p.angle).toBeTruthy();
      }
    }
  });

  it('each workflow has at least 3 phases with a terminal phase', () => {
    for (const wf of WORKFLOW_REGISTRY) {
      expect(wf.phases.length).toBeGreaterThanOrEqual(3);
      const lastPhase = wf.phases[wf.phases.length - 1];
      const allowedTerminalPhases = ['record', 'recommend', 'summarize'];
      expect(allowedTerminalPhases).toContain(lastPhase.name);
    }
  });

  it('each workflow has at least 1 required input (except help which is read-only)', () => {
    for (const wf of WORKFLOW_REGISTRY) {
      if (wf.name === 'help') continue;
      const required = wf.inputs.filter((i) => i.required);
      expect(required.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('each mutating workflow declares at least 1 output referencing a known artifact type', () => {
    for (const wf of WORKFLOW_REGISTRY) {
      if (wf.name === 'help') continue;
      const knownOutputs = wf.outputs.filter((o) => o.artifactType in ARTIFACT_META_SCHEMAS);
      expect(knownOutputs.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('getWorkflowByName finds existing workflows', () => {
    expect(getWorkflowByName('brainstorm-party')).toBeDefined();
    expect(getWorkflowByName('review-adversarial')).toBeDefined();
    expect(getWorkflowByName('nonexistent')).toBeUndefined();
  });

  it('brainstorm-party has expected shape', () => {
    const wf = getWorkflowByName('brainstorm-party')!;
    expect(wf.personas.map((p) => p.name)).toContain('PM');
    expect(wf.personas.map((p) => p.name)).toContain('Skeptic');
    expect(wf.phases.map((p) => p.name)).toEqual(['frame', 'diverge', 'challenge', 'converge', 'record']);
    expect(wf.inputs.find((i) => i.name === 'topic')?.required).toBe(true);
    expect(wf.outputs.find((o) => o.artifactType === 'brainstorm')?.required).toBe(true);
  });

  it('review-adversarial has expected shape', () => {
    const wf = getWorkflowByName('review-adversarial')!;
    expect(wf.personas.map((p) => p.name)).toContain('Skeptic');
    expect(wf.personas.map((p) => p.name)).toContain('Security');
    expect(wf.phases.map((p) => p.name)).toEqual(['read', 'attack', 'gap-find', 'prioritize', 'record']);
    expect(wf.inputs.find((i) => i.name === 'artifactRef')?.required).toBe(true);
    const hasQaOrRisk = wf.outputs.some((o) => o.artifactType === 'qa' || o.artifactType === 'risk');
    expect(hasQaOrRisk).toBe(true);
  });

  it('review-edge-cases has expected shape', () => {
    const wf = getWorkflowByName('review-edge-cases')!;
    expect(wf.personas.map((p) => p.name)).toEqual(['Path-tracer', 'Boundary-checker', 'Concurrency-skeptic']);
    expect(wf.phases.map((p) => p.name)).toEqual(['read', 'enumerate-paths', 'derive-edge-classes', 'filter-handled', 'record']);
    expect(wf.inputs.find((i) => i.name === 'artifactRef')?.required).toBe(true);
    expect(wf.inputs.find((i) => i.name === 'also_consider')?.required).toBe(false);
    expect(wf.outputs.find((o) => o.artifactType === 'qa')?.required).toBe(true);
  });

  it('editorial-prose has expected shape', () => {
    const wf = getWorkflowByName('editorial-prose')!;
    expect(wf.personas.map((p) => p.name)).toEqual(['Copy-editor']);
    expect(wf.phases.map((p) => p.name)).toEqual(['read', 'clarity-pass', 'apply-or-recommend', 'record']);
    expect(wf.inputs.find((i) => i.name === 'artifactRef')?.required).toBe(true);
    expect(wf.inputs.find((i) => i.name === 'target_audience')?.required).toBe(false);
    expect(wf.inputs.find((i) => i.name === 'reader_type')?.required).toBe(false);
    expect(wf.outputs.find((o) => o.artifactType === 'qa')?.required).toBe(true);
    expect(wf.outputs.find((o) => o.artifactType === 'update')?.required).toBe(false);
  });

  it('editorial-structure has expected shape', () => {
    const wf = getWorkflowByName('editorial-structure')!;
    expect(wf.personas.map((p) => p.name)).toEqual(['Structural editor']);
    expect(wf.phases.map((p) => p.name)).toEqual(['read', 'outline', 'propose-restructuring', 'prioritize', 'record']);
    expect(wf.inputs.find((i) => i.name === 'artifactRef')?.required).toBe(true);
    expect(wf.inputs.find((i) => i.name === 'purpose')?.required).toBe(false);
    expect(wf.inputs.find((i) => i.name === 'target_audience')?.required).toBe(false);
    expect(wf.inputs.find((i) => i.name === 'length_target')?.required).toBe(false);
    expect(wf.outputs.find((o) => o.artifactType === 'qa')?.required).toBe(true);
  });

  it('help has expected shape', () => {
    const wf = getWorkflowByName('help')!;
    expect(wf.personas.map((p) => p.name)).toEqual(['Guide']);
    expect(wf.phases.map((p) => p.name)).toEqual(['inspect-state', 'synthesize', 'recommend']);
    expect(wf.inputs.find((i) => i.name === 'query')?.required).toBe(false);
    expect(wf.outputs.every((o) => o.kind === 'none')).toBe(true);
    expect(wf.safety).toContainEqual(expect.stringContaining('read-only'));
  });

  it('brainstorm-deep has expected shape', () => {
    const wf = getWorkflowByName('brainstorm-deep')!;
    expect(wf.personas.map((p) => p.name)).toEqual(['Ideator']);
    expect(wf.phases.map((p) => p.name)).toEqual(['frame', 'expand', 'prune', 'record']);
    expect(wf.inputs.find((i) => i.name === 'topic')?.required).toBe(true);
    expect(wf.inputs.find((i) => i.name === 'target_count')?.required).toBe(false);
    expect(wf.inputs.find((i) => i.name === 'seedArtifactId')?.required).toBe(false);
    expect(wf.outputs.find((o) => o.artifactType === 'brainstorm')?.required).toBe(true);
  });

  it('elicit has expected shape', () => {
    const wf = getWorkflowByName('elicit')!;
    expect(wf.personas.map((p) => p.name)).toEqual(['Refiner']);
    expect(wf.phases.map((p) => p.name)).toEqual(['read', 'select-method', 'propose', 'confirm', 'apply', 'summarize']);
    expect(wf.inputs.find((i) => i.name === 'artifactRef')?.required).toBe(true);
    expect(wf.inputs.find((i) => i.name === 'methods')?.required).toBe(false);
    expect(wf.inputs.find((i) => i.name === 'target_audience')?.required).toBe(false);
    expect(wf.outputs.find((o) => o.artifactType === 'qa')?.required).toBe(false);
    const updateOutput = wf.outputs.find((o) => o.artifactType === 'update');
    expect(updateOutput?.kind).toBe('update');
  });
});
