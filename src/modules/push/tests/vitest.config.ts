import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/modules/push/**/*.ts'],
      exclude: [
        'src/modules/push/**/*.spec.ts',
        'src/modules/push/**/*.test.ts',
        'src/modules/push/**/*.interface.ts',
        'src/modules/push/**/*.dto.ts',
        'src/modules/push/**/index.ts',
        'src/modules/push/tests/**',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
    testTimeout: 30000,
    hookTimeout: 30000,
    teardownTimeout: 30000,
    isolate: true,
    threads: true,
    mockReset: true,
    clearMocks: true,
    restoreMocks: true,
    
    // Test categorization
    include: [
      // Unit tests
      'src/modules/push/**/*.spec.ts',
      'src/modules/push/**/*.test.ts',
    ],
    
    // Separate test suites
    sequence: {
      suites: [
        // Run unit tests first
        {
          name: 'unit',
          files: ['src/modules/push/services/**/*.spec.ts', 'src/modules/push/commands/**/*.spec.ts'],
        },
        // Then integration tests
        {
          name: 'integration',
          files: ['src/modules/push/tests/*.integration.spec.ts'],
        },
        // Then security tests
        {
          name: 'security',
          files: ['src/modules/push/tests/*.security.spec.ts'],
        },
        // Performance tests (optional, can be skipped in CI)
        {
          name: 'performance',
          files: ['src/modules/push/tests/*.performance.spec.ts'],
        },
        // E2E tests last
        {
          name: 'e2e',
          files: ['src/modules/push/tests/*.e2e.spec.ts'],
        },
      ],
    },

    // Reporter configuration
    reporters: [
      'default',
      ['json', { outputFile: 'test-results.json' }],
      ['junit', { outputFile: 'junit.xml' }],
      ['html', { outputFile: 'test-report.html' }],
    ],

    // Watch mode exclusions
    watchExclude: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
  },
});