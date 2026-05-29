/**
 * Unified body-input resolution for `spego create` and `spego update`.
 *
 * Accepts either an inline `--body` string, a `--body-file <path>` reference,
 * or stdin when `--body-file -`. Returns `undefined` when no body source was
 * supplied so callers can leave the artifact body unchanged.
 */

import fs from 'node:fs/promises';

export interface BodyInputOptions {
  body?: string;
  bodyFile?: string;
}

async function readStdin(): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let buf = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk: string) => {
      buf += chunk;
    });
    process.stdin.on('end', () => resolve(buf));
    process.stdin.on('error', reject);
  });
}

export async function resolveBody(opts: BodyInputOptions): Promise<string | undefined> {
  if (opts.bodyFile === '-') return readStdin();
  if (opts.bodyFile) return fs.readFile(opts.bodyFile, 'utf8');
  return opts.body;
}
