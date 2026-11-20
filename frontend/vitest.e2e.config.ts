import { defineConfig } from 'vitest/config';

// Cross-stack tests; run through backend YjsRelayE2ETest (it starts the Java relay
// and sets E2E_BASE_URL). Without E2E_BASE_URL the suite is skipped.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['e2e/**/*.e2e.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
});
