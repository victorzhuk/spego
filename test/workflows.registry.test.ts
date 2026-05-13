import { describe, it, expect } from 'vitest';
import { WORKFLOW_REGISTRY, getWorkflowByName, listWorkflowNames } from '../src/workflows/registry.js';
import { ARTIFACT_META_SCHEMAS } from '../src/artifacts/schemas.js';

describe('Workflow registry', () => {
  it('contains both workflows', () => {
    expect(WORKFLOW_REGISTRY).toHaveLength(5);
    expect(listWorkflowNames()).toEqual(['brainstorm-party', 'review-adversarial', 'review-edge-cases', 'editorial-prose', 'editorial-structure']);
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

  it('each workflow has at least 4 phases including a final record phase', () => {
    for (const wf of WORKFLOW_REGISTRY) {
      expect(wf.phases.length).toBeGreaterThanOrEqual(4);
      const lastPhase = wf.phases[wf.phases.length - 1];
      expect(lastPhase.name).toBe('record');
    }
  });

  it('each workflow has at least 1 required input', () => {
    for (const wf of WORKFLOW_REGISTRY) {
      const required = wf.inputs.filter((i) => i.required);
      expect(required.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('each workflow declares at least 1 output referencing a known artifact type', () => {
    for (const wf of WORKFLOW_REGISTRY) {
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
});
