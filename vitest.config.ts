import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      DATABASE_URL: 'file:./test.db',
      // Fixed test-only value so the suite doesn't depend on a gitignored
      // .env file existing (it won't on a fresh clone or in CI).
      JWT_SECRET: 'test-jwt-secret-for-vitest-only',
    },
    globalSetup: './tests/globalSetup.ts',
    setupFiles: ['./tests/setup.ts'],
    // Test files share one physical SQLite file (test.db); running them
    // concurrently races beforeEach cleanup against another file's writes.
    fileParallelism: false,
  },
});
