/**
 * Thin async client for the OpenCode REST API (`opencode serve`).
 *
 * Uses the Node global `fetch` and `AbortController` for per-request timeouts,
 * with exponential backoff and jitter on 429/503. The {@link OpenCodeApi}
 * interface is the seam used by the manager, worker, and verifier so the
 * pipeline can be exercised in tests with a fake backend.
 */

import { SpegoError } from '../errors.js';
import type { DiffEntry } from './types.js';

export interface OpenCodeMessagePart {
  type?: string;
  text?: string;
}

export interface OpenCodeMessageResponse {
  parts?: OpenCodeMessagePart[];
}

export interface SendMessageInput {
  text: string;
  model?: string;
  agent?: string;
  system?: string;
}

export interface OpenCodeApi {
  health(): Promise<{ version?: string }>;
  createSession(title?: string): Promise<{ id: string }>;
  sendMessage(sessionId: string, input: SendMessageInput): Promise<OpenCodeMessageResponse>;
  getSessionDiff(sessionId: string): Promise<DiffEntry[]>;
  deleteSession(sessionId: string): Promise<void>;
}

export interface OpenCodeClientOptions {
  baseUrl: string;
  username?: string;
  password?: string;
  timeoutMs?: number;
  maxRetries?: number;
}

const RETRYABLE_STATUS = new Set([429, 503]);

/** Extract the concatenated text parts from a message response. */
export function extractText(response: OpenCodeMessageResponse): string {
  const parts = response.parts ?? [];
  return parts
    .filter((p) => p.type === 'text' && typeof p.text === 'string')
    .map((p) => p.text ?? '')
    .join('\n')
    .trim();
}

export class OpenCodeClient implements OpenCodeApi {
  private readonly baseUrl: string;
  private readonly authHeader?: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(opts: OpenCodeClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, '');
    this.timeoutMs = opts.timeoutMs ?? 300_000;
    this.maxRetries = opts.maxRetries ?? 5;
    if (opts.password) {
      const raw = `${opts.username ?? 'opencode'}:${opts.password}`;
      this.authHeader = `Basic ${Buffer.from(raw).toString('base64')}`;
    }
  }

  async health(): Promise<{ version?: string }> {
    return (await this.request('GET', '/global/health')) as { version?: string };
  }

  async createSession(title?: string): Promise<{ id: string }> {
    const body = title ? { title } : {};
    return (await this.request('POST', '/session', body)) as { id: string };
  }

  async sendMessage(sessionId: string, input: SendMessageInput): Promise<OpenCodeMessageResponse> {
    const body: Record<string, unknown> = { parts: [{ type: 'text', text: input.text }] };
    if (input.model) body.model = input.model;
    if (input.agent) body.agent = input.agent;
    if (input.system) body.system = input.system;
    return (await this.request('POST', `/session/${sessionId}/message`, body)) as OpenCodeMessageResponse;
  }

  async getSessionDiff(sessionId: string): Promise<DiffEntry[]> {
    const result = await this.request('GET', `/session/${sessionId}/diff`);
    return Array.isArray(result) ? (result as DiffEntry[]) : [];
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.request('DELETE', `/session/${sessionId}`);
  }

  private async request(method: string, path: string, body?: unknown): Promise<unknown> {
    let delay = 2000;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const headers: Record<string, string> = { 'content-type': 'application/json' };
        if (this.authHeader) headers.authorization = this.authHeader;
        const res = await fetch(`${this.baseUrl}${path}`, {
          method,
          headers,
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: controller.signal,
        });

        if (RETRYABLE_STATUS.has(res.status) && attempt < this.maxRetries) {
          const retryAfter = Number(res.headers.get('retry-after')) || delay / 1000;
          await sleep(Math.min(retryAfter * 1000 + Math.random() * 1000, 60_000));
          delay = Math.min(delay * 2, 60_000);
          continue;
        }
        if (!res.ok) {
          throw new SpegoError('ORCHESTRATION_FAILED', `OpenCode API ${res.status} on ${method} ${path}`, {
            status: res.status,
            path,
          });
        }
        const text = await res.text();
        return text ? JSON.parse(text) : null;
      } catch (err) {
        if (err instanceof SpegoError) throw err;
        if (attempt >= this.maxRetries) {
          throw new SpegoError(
            'ORCHESTRATION_BACKEND_UNREACHABLE',
            `OpenCode server unreachable at ${this.baseUrl}`,
            { serverUrl: this.baseUrl, cause: (err as Error).message },
          );
        }
        await sleep(Math.min(delay + Math.random() * 1000, 60_000));
        delay = Math.min(delay * 2, 60_000);
      } finally {
        clearTimeout(timer);
      }
    }
    throw new SpegoError('ORCHESTRATION_FAILED', `Exhausted retries for ${method} ${path}`, { path });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
