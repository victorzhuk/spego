/**
 * Structured error codes returned by the spego artifact engine.
 * Stable across CLI/JSON outputs so agents can branch on them.
 */
export type SpegoErrorCode =
  | 'WORKSPACE_NOT_FOUND'
  | 'WORKSPACE_ALREADY_EXISTS'
  | 'INVALID_ARTIFACT_TYPE'
  | 'VALIDATION_FAILED'
  | 'ARTIFACT_NOT_FOUND'
  | 'REVISION_CONFLICT'
  | 'REVISION_NOT_FOUND'
  | 'WRITE_FAILED'
  | 'INDEX_REBUILD_FAILED';

export interface SpegoErrorDetails {
  [key: string]: unknown;
}

export class SpegoError extends Error {
  public readonly code: SpegoErrorCode;
  public readonly details: SpegoErrorDetails;

  constructor(code: SpegoErrorCode, message: string, details: SpegoErrorDetails = {}) {
    super(message);
    this.name = 'SpegoError';
    this.code = code;
    this.details = details;
  }

  toJSON(): { code: SpegoErrorCode; message: string; details: SpegoErrorDetails } {
    return { code: this.code, message: this.message, details: this.details };
  }
}
