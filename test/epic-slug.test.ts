import { afterEach, describe, expect, it, vi } from 'vitest';
import { SpegoError } from '../src/errors.js';
import type { DeliveryAdapter, DeliveryEpicLink } from '../src/delivery/index.js';
import { assertEpicSlugActive } from '../src/cli/epic-slug.js';

function makeEpic(externalId: string): DeliveryEpicLink {
  return {
    adapterName: 'openspec',
    externalId,
    title: externalId,
    status: 'in-progress',
    sourcePath: `openspec/changes/${externalId}`,
  };
}

function makeAdapter(getEpic: DeliveryAdapter['getEpic']): DeliveryAdapter {
  return {
    name: 'openspec',
    getEpic,
    listEpics: vi.fn<DeliveryAdapter['listEpics']>().mockResolvedValue([]),
    listTasks: vi.fn<DeliveryAdapter['listTasks']>().mockResolvedValue([]),
    getTask: vi.fn<DeliveryAdapter['getTask']>().mockImplementation(async () => {
      throw new Error('not used');
    }),
  };
}

function deliveryError(message: string, slug: string): SpegoError {
  return new SpegoError('DELIVERY_ADAPTER_ERROR', message, { changeName: slug });
}

describe('assertEpicSlugActive', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns when getEpic resolves', async () => {
    const getEpic = vi.fn<DeliveryAdapter['getEpic']>().mockResolvedValue(makeEpic('add-auth'));
    const adapter = makeAdapter(getEpic);

    await expect(assertEpicSlugActive(adapter, 'add-auth')).resolves.toBeUndefined();
    expect(getEpic).toHaveBeenCalledWith('add-auth');
  });

  it('throws VALIDATION_FAILED when getEpic rejects change-not-found', async () => {
    const adapter = makeAdapter(
      vi.fn<DeliveryAdapter['getEpic']>().mockRejectedValue(deliveryError('Change "add-auth" not found', 'add-auth')),
    );

    await expect(assertEpicSlugActive(adapter, 'add-auth')).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      message: expect.stringMatching(/not found or archived.*add-auth/),
      details: expect.objectContaining({ slug: 'add-auth' }),
    });
  });

  it('throws VALIDATION_FAILED when getEpic rejects archived change', async () => {
    const adapter = makeAdapter(
      vi.fn<DeliveryAdapter['getEpic']>().mockRejectedValue(deliveryError('Change "add-auth" archived', 'add-auth')),
    );

    await expect(assertEpicSlugActive(adapter, 'add-auth')).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      message: expect.stringMatching(/not found or archived.*add-auth/),
      details: expect.objectContaining({ slug: 'add-auth' }),
    });
  });

  it('warns and proceeds when adapter is absent', async () => {
    const write = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    await expect(assertEpicSlugActive(null, 'add-auth')).resolves.toBeUndefined();

    expect(write).toHaveBeenCalledTimes(1);
    const warning = String(write.mock.calls[0]?.[0]);
    expect(warning).toContain('add-auth');
    expect(warning).toContain('not verified');
  });

});
