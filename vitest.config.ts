import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      DATABASE_URL: 'file:./test.db',
    },
    globalSetup: './tests/globalSetup.ts',
    setupFiles: ['./tests/setup.ts'],
    // Test files share one physical SQLite file (test.db); running them
    // concurrently races beforeEach cleanup against another file's writes.
    fileParallelism: false,
  },
});
