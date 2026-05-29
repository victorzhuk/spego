/**
 * Centralized error formatting for the CLI.
 *
 * Every command and the program-level `exitOverride` route through this module
 * so the human and JSON envelopes stay consistent and `error.details` is always
 * an object — never undefined — so agents can branch on the shape safely.
 */

import { SpegoError } from '../errors.js';

interface JsonErrorEnvelope {
  error: { code: string; message: string; details: Record<string, unknown> };
}

function spegoErrorEnvelope(err: SpegoError): JsonErrorEnvelope {
  return { error: { code: err.code, message: err.message, details: err.details ?? {} } };
}

function genericErrorEnvelope(message: string): JsonErrorEnvelope {
  return { error: { code: 'INTERNAL', message, details: {} } };
}

function validationEnvelope(message: string): JsonErrorEnvelope {
  return { error: { code: 'VALIDATION_FAILED', message, details: {} } };
}

/** Format and write a `SpegoError`/`Error`/unknown error to stderr; never returns. */
export function fail(err: unknown, json: boolean): never {
  if (err instanceof SpegoError) {
    if (json) {
      process.stderr.write(`${JSON.stringify(spegoErrorEnvelope(err), null, 2)}\n`);
    } else {
      process.stderr.write(`⚠️  [${err.code}] ${err.message}\n`);
    }
    process.exit(2);
  }
  const message = err instanceof Error ? err.message : String(err);
  if (json) {
    process.stderr.write(`${JSON.stringify(genericErrorEnvelope(message), null, 2)}\n`);
  } else {
    process.stderr.write(`⚠️  [INTERNAL] ${message}\n`);
  }
  process.exit(1);
}

/**
 * Format and write a commander validation error; never returns.
 *
 * Validation errors always exit with code 2, matching `SpegoError`, so agents
 * can branch on `exitCode === 2 ⇒ structured error` regardless of source.
 * Commander's default `exitCode` (1 for unknown options) is intentionally
 * overridden here.
 */
export function failValidation(err: { message: string }, json: boolean): never {
  if (json) {
    process.stderr.write(`${JSON.stringify(validationEnvelope(err.message), null, 2)}\n`);
  } else {
    process.stderr.write(`⚠️  [VALIDATION_FAILED] ${err.message}\n`);
  }
  process.exit(2);
}
