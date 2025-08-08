---
inclusion: always
---

# TEST.md - Vitest Testing Reference

Comprehensive testing strategy for Taptik CLI using Vitest framework.

## Overview

**Testing Philosophy**: Fast, reliable, and maintainable tests that provide confidence in code quality and prevent regressions.

**Framework**: Vitest - Fast unit test framework powered by Vite **Current Status**: Migrating from Jest to Vitest **Coverage Target**: >80% for critical paths, >60% overall

## Setup & Configuration

### Migration from Jest to Vitest

#### 1. Install Vitest Dependencies

```bash
pnpm remove jest @types/jest ts-jest
pnpm add -D vitest @vitest/ui @vitest/coverage-v8
```

#### 2. Update package.json Scripts

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:run": "vitest run",
    "test:watch": "vitest --watch",
    "test:coverage": "vitest --coverage",
    "test:e2e": "vitest run --config vitest.e2e.config.ts"
  }
}
```

#### 3. Create vitest.config.ts

```typescript
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/', '**/*.d.ts', 'test/', '**/*.config.ts'],
      thresholds: {
        global: {
          branches: 60,
          functions: 60,
          lines: 80,
          statements: 80,
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@test': resolve(__dirname, './test'),
    },
  },
});
```

#### 4. Create E2E Configuration

```typescript
// vitest.e2e.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['**/*.e2e.spec.ts'],
    timeout: 30000,
    hookTimeout: 30000,
  },
});
```

## Test Structure

### Directory Structure

```
test/
├── setup.ts              # Global test setup
├── fixtures/              # Test data and mocks
├── helpers/               # Test utilities
└── unit/                  # Unit test mirrors
    └── commands/
    └── services/
    └── utils/

src/
├── commands/
│   ├── migrate.command.ts
│   └── migrate.command.spec.ts
├── services/
│   ├── config.service.ts
│   └── config.service.spec.ts
└── utils/
    ├── file-utils.ts
    └── file-utils.spec.ts
```

### Test Categories

#### 1. Unit Tests (\*.spec.ts)

- Test individual functions/classes in isolation
- Fast execution (<5ms per test)
- High coverage for business logic

#### 2. Integration Tests (\*.integration.spec.ts)

- Test component interactions
- Database/file system operations
- API endpoint testing

#### 3. E2E Tests (\*.e2e.spec.ts)

- Full CLI command execution
- End-to-end workflows
- Real environment simulation

## Testing Patterns

### Command Testing Pattern

```typescript
// migrate.command.spec.ts
import { Test } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MigrateCommand } from './migrate.command';
import { ConfigService } from '../services/config.service';

describe('MigrateCommand', () => {
  let command: MigrateCommand;
  let configService: ConfigService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        MigrateCommand,
        {
          provide: ConfigService,
          useValue: {
            loadConfig: vi.fn(),
            saveConfig: vi.fn(),
          },
        },
      ],
    }).compile();

    command = moduleRef.get<MigrateCommand>(MigrateCommand);
    configService = moduleRef.get<ConfigService>(ConfigService);
  });

  describe('run', () => {
    it('should migrate configuration successfully', async () => {
      // Arrange
      const mockConfig = { source: 'vscode', target: 'cursor' };
      vi.mocked(configService.loadConfig).mockResolvedValue(mockConfig);

      // Act
      const result = await command.run(['--source', 'vscode', '--target', 'cursor']);

      // Assert
      expect(configService.loadConfig).toHaveBeenCalledWith('vscode');
      expect(configService.saveConfig).toHaveBeenCalledWith('cursor', mockConfig);
      expect(result).toBe(0);
    });

    it('should handle migration errors gracefully', async () => {
      // Arrange
      vi.mocked(configService.loadConfig).mockRejectedValue(new Error('Config not found'));

      // Act & Assert
      await expect(command.run(['--source', 'invalid'])).rejects.toThrow('Config not found');
    });
  });
});
```

### Service Testing Pattern

```typescript
// config.service.spec.ts
import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { ConfigService } from './config.service';
import { FileUtils } from '../utils/file-utils';

vi.mock('../utils/file-utils');

describe('ConfigService', () => {
  let service: ConfigService;
  let fileUtils: FileUtils;

  beforeEach(() => {
    service = new ConfigService();
    fileUtils = new FileUtils();
  });

  describe('loadConfig', () => {
    it('should load VSCode configuration', async () => {
      // Arrange
      const mockConfig = { theme: 'dark', extensions: ['prettier'] };
      (fileUtils.readJson as Mock).mockResolvedValue(mockConfig);

      // Act
      const result = await service.loadConfig('vscode');

      // Assert
      expect(result).toEqual(mockConfig);
      expect(fileUtils.readJson).toHaveBeenCalledWith(expect.stringContaining('vscode/settings.json'));
    });

    it('should throw error for unsupported tool', async () => {
      // Act & Assert
      await expect(service.loadConfig('unknown')).rejects.toThrow('Unsupported tool: unknown');
    });
  });
});
```

### E2E Testing Pattern

```typescript
// migrate.e2e.spec.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { mkdtemp, rmdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Migrate Command E2E', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'taptik-test-'));
  });

  afterEach(async () => {
    await rmdir(tempDir, { recursive: true });
  });

  it('should migrate VSCode settings to Cursor', async () => {
    // Arrange
    const vscodeSettings = {
      'editor.fontSize': 14,
      'workbench.colorTheme': 'Dark+ (default dark)',
    };

    await writeFile(join(tempDir, 'vscode-settings.json'), JSON.stringify(vscodeSettings, null, 2));

    // Act
    const result = execSync(`node dist/cli.js migrate --source vscode --target cursor --config-path ${tempDir}`, { encoding: 'utf8' });

    // Assert
    expect(result).toContain('Migration completed successfully');
    // Additional file existence and content checks
  });
});
```

## Test Utilities

### Test Setup (test/setup.ts)

```typescript
import { vi } from 'vitest';

// Global mocks
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  access: vi.fn(),
}));

// Global test configuration
process.env.NODE_ENV = 'test';
```

### Test Helpers (test/helpers/command-runner.ts)

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { CommandFactory } from 'nest-commander';

export class CommandTestRunner {
  static async run(command: string, args: string[] = []): Promise<number> {
    const app = await Test.createTestingModule({
      // Module configuration
    }).compile();

    const commandApp = CommandFactory.createWithoutRunning(app);
    return commandApp.run([command, ...args]);
  }
}
```

### Fixtures (test/fixtures/configs.ts)

```typescript
export const mockConfigs = {
  vscode: {
    'editor.fontSize': 14,
    'editor.tabSize': 2,
    'workbench.colorTheme': 'Dark+ (default dark)',
    'extensions.recommendations': ['esbenp.prettier-vscode'],
  },
  cursor: {
    'editor.fontSize': 14,
    'editor.tabSize': 2,
    'workbench.colorTheme': 'Default Dark+',
    'cursor.cpp.disabledLanguages': [],
  },
};
```

## Testing Commands

### Basic Test Commands

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with UI
pnpm test:ui

# Run tests with coverage
pnpm test:coverage

# Run specific test file
pnpm test migrate.command.spec.ts

# Run tests matching pattern
pnpm test --grep "migration"
```

### Coverage Commands

```bash
# Generate coverage report
pnpm test:coverage

# View coverage in browser
open coverage/index.html
```

## Best Practices

### 1. Test Organization

- **Group related tests** using `describe` blocks
- **Use descriptive test names** that explain what is being tested
- **Follow AAA pattern**: Arrange, Act, Assert

### 2. Mocking Strategy

- **Mock external dependencies** (file system, network calls)
- **Use dependency injection** for easier testing
- **Mock at the boundary** (services, not utilities)

### 3. Test Data Management

- **Use fixtures** for complex test data
- **Create builders** for dynamic test data
- **Keep test data small** and focused

### 4. Assertion Guidelines

- **Use specific assertions** rather than generic ones
- **Test both success and failure paths**
- **Verify side effects** (files created, logs written)

### 5. Performance Considerations

- **Keep unit tests fast** (<10ms each)
- **Use `beforeEach` judiciously** (can slow down tests)
- **Parallel test execution** for independent tests

## Common Test Scenarios

### CLI Command Testing

- Command parsing and validation
- Option handling and defaults
- Error handling and exit codes
- Output formatting and logging

### Configuration Migration Testing

- File reading and parsing
- Configuration transformation
- File writing and backup
- Error recovery and rollback

### Utility Function Testing

- Edge cases and boundary conditions
- Input validation and sanitization
- Error handling and exceptions
- Performance with large inputs

## Continuous Integration

### GitHub Actions Configuration

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm test:coverage
      - uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info
```

### Quality Gates

- **All tests must pass** before merge
- **Coverage thresholds** must be maintained
- **No new test failures** in PR changes
- **E2E tests** must pass for release

## Migration Checklist

### From Jest to Vitest

- [ ] Install Vitest dependencies
- [ ] Remove Jest dependencies
- [ ] Update package.json scripts
- [ ] Create vitest.config.ts
- [ ] Update import statements (`jest` → `vitest`)
- [ ] Update mock syntax (`jest.fn()` → `vi.fn()`)
- [ ] Update setup files
- [ ] Run and validate all tests
- [ ] Update CI/CD configuration
- [ ] Update documentation

### Testing Readiness

- [ ] All critical paths have tests
- [ ] Error scenarios are covered
- [ ] E2E tests for main workflows
- [ ] Performance tests for large operations
- [ ] Mock strategies are documented
- [ ] Test data is maintained
- [ ] Coverage thresholds are met
