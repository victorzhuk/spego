import type { DeliveryAdapter } from '../delivery/index.js';
import { SpegoError } from '../errors.js';

export async function assertEpicSlugActive(
  adapter: DeliveryAdapter | null,
  slug: string,
): Promise<void> {
  if (adapter === null) {
    process.stderr.write(`warning: OpenSpec change link for epic "${slug}" was not verified\n`);
    return;
  }

  try {
    await adapter.getEpic(slug);
  } catch (err) {
    throw new SpegoError('VALIDATION_FAILED', `OpenSpec change not found or archived for epic slug: ${slug}`, {
      slug,
      cause: err instanceof Error ? err.message : String(err),
    });
  }
}

