import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      DATABASE_URL: 'file:./test.db',
    },
    globalSetup: './tests/globalSetup.ts',
    setupFiles: ['./tests/setup.ts'],
  },
});
