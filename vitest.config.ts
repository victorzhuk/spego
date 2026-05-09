import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    pool: 'forks',
    testTimeout: 15000,
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
