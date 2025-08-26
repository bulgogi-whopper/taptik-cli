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
    pool: 'threads',
    mockReset: true,
    clearMocks: true,
    restoreMocks: true,

    // Test categorization (ordered by execution priority)
    include: [
      // Unit tests (run first)
      'src/modules/push/services/**/*.spec.ts',
      'src/modules/push/commands/**/*.spec.ts',
      // Integration tests
      'src/modules/push/tests/*.integration.spec.ts',
      // Security tests
      'src/modules/push/tests/*.security.spec.ts',
      // Performance tests
      'src/modules/push/tests/*.performance.spec.ts',
      // E2E tests (run last)
      'src/modules/push/tests/*.e2e.spec.ts',
      // Additional test files
      'src/modules/push/**/*.test.ts',
    ],

    // Test execution sequence configuration
    // Note: Vitest doesn't have a 'suites' property in SequenceOptions
    // Test execution order is controlled through file glob patterns in 'include'
    // and can be further organized using describe.sequential() in test files
    sequence: {
      hooks: 'stack',        // Run hooks in stack order (reverse for 'after' hooks)
      setupFiles: 'list',    // Run setup files in defined order
      shuffle: false,        // Don't randomize test execution
    },

    // Reporter configuration
    reporters: [
      'default',
      ['json', { outputFile: 'test-results.json' }],
      ['junit', { outputFile: 'junit.xml' }],
      ['html', { outputFile: 'test-report.html' }],
    ],

    // Note: Watch mode exclusions are handled at the file system level
  },
});
