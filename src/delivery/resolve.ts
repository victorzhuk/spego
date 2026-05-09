import { SpegoError } from '../errors.js';
import type { WorkspaceConfig } from '../workspace/config.js';
import { createOpenSpecAdapter } from './openspec-adapter.js';
import type { DeliveryAdapter } from './types.js';

const KNOWN_ADAPTERS = new Set(['openspec']);

export function resolveAdapter(projectRoot: string, config: WorkspaceConfig): DeliveryAdapter {
  const { name } = config.deliveryAdapter;

  if (!KNOWN_ADAPTERS.has(name)) {
    throw new SpegoError('DELIVERY_ADAPTER_NOT_FOUND', `Unknown delivery adapter: "${name}"`, {
      adapterName: name,
      known: [...KNOWN_ADAPTERS],
    });
  }

  return createOpenSpecAdapter(projectRoot);
}
