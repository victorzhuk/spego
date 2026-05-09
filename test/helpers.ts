import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

/** Create a unique temp project root for an isolated test workspace. */
export async function makeTempProject(): Promise<{
  root: string;
  cleanup: () => Promise<void>;
}> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'spego-test-'));
  return {
    root,
    cleanup: async () => {
      await fs.rm(root, { recursive: true, force: true });
    },
  };
}
