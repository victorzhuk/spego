import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    pool: 'forks',
    minWorkers: 1,
    maxWorkers: '50%',
    testTimeout: 45000,
    server: {
      deps: {
        // Vite's builtin list lags behind Node; force-externalize node: imports
        // so node:sqlite (and friends) resolve to the runtime instead of being
        // pre-bundled.
        external: [/^node:/],
      },
    },
  },
});
