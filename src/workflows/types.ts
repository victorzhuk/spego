export interface PersonaSpec {
  name: string;
  role: string;
  angle: string;
}

export interface PhaseSpec {
  name: string;
  instruction: string;
}

export interface WorkflowInput {
  name: string;
  required: boolean;
  description: string;
}

export interface WorkflowOutput {
  artifactType: string;
  required: boolean;
  description: string;
}

export interface WorkflowMeta {
  name: string;
  description: string;
  personas: PersonaSpec[];
  phases: PhaseSpec[];
  inputs: WorkflowInput[];
  outputs: WorkflowOutput[];
  safety: string[];
}
