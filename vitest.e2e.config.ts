import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['**/*.e2e.spec.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    globals: true,
    environment: 'node',
  },
});
