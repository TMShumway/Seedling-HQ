import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/integration/**/*.test.ts'],
    environment: 'node',
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true },
    },
    testTimeout: 15000,
  },
});
