export const GENERATOR_VERSION = 1;

export type FileAction = 'created' | 'updated' | 'unchanged' | 'skipped';

export interface GeneratedFile {
  path: string;
  action: FileAction;
}

export interface GenerationReport {
  target: string;
  files: GeneratedFile[];
  version: number;
}

export interface TargetGenerator {
  readonly targetName: string;
  generate(projectRoot: string): Promise<GenerationReport>;
}
