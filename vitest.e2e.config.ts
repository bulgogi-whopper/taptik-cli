import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['**/*.e2e.spec.ts'],
    timeout: 30000,
    hookTimeout: 30000,
    globals: true,
    environment: 'node',
  },
});
