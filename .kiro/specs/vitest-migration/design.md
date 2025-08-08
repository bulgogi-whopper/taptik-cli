# Design Document

## Overview

This design outlines the complete migration from Jest to Vitest for the Taptik CLI project. Vitest provides faster test execution, better TypeScript support, and Vite ecosystem integration while maintaining Jest API compatibility. The migration will preserve all existing test functionality while improving performance and developer experience.

## Architecture

### Migration Strategy

- **Progressive Migration**: Replace Jest incrementally to minimize disruption
- **Configuration Replacement**: Replace Jest config with Vitest equivalents
- **API Compatibility**: Leverage Vitest's Jest-compatible API for minimal code changes
- **Performance Optimization**: Utilize Vite's fast compilation and Hot Module Replacement

### Test Execution Flow

```
Source Changes → Vitest (with Vite) → Fast Compilation → Test Execution
                     ↓
                Hot Module Replacement
```

## Components and Interfaces

### 1. Vitest Configuration (vitest.config.ts)

**Purpose**: Main Vitest configuration replacing Jest setup **Key Features**:

- TypeScript configuration with path aliases
- Coverage configuration with v8 provider
- Node environment for CLI testing
- Global test APIs (describe, it, expect)

### 2. Test Setup (test/setup.ts)

**Purpose**: Global test configuration and mocks **Key Features**:

- Global mock configurations
- Environment variable setup
- Test utilities and helpers
- NestJS testing module setup

### 3. E2E Configuration (vitest.e2e.config.ts)

**Purpose**: Separate configuration for end-to-end tests **Key Features**:

- Extended timeouts for CLI operations
- Real file system operations
- Integration with child_process for CLI testing

### 4. Package Dependencies

**Dependencies to Remove**:

- `jest`
- `@types/jest`
- `ts-jest`

**Dependencies to Add**:

- `vitest`
- `@vitest/ui`
- `@vitest/coverage-v8`

### 5. Test File Structure

**Current Jest Pattern**: `*.spec.ts`, `*.test.ts` **Vitest Pattern**: Same file patterns, updated imports

## Data Models

### Vitest Configuration Structure

```typescript
interface VitestConfig {
  test: {
    globals: boolean;
    environment: 'node' | 'jsdom';
    setupFiles: string[];
    coverage: {
      provider: 'v8' | 'c8';
      reporter: string[];
      exclude: string[];
      thresholds: {
        global: {
          branches: number;
          functions: number;
          lines: number;
          statements: number;
        };
      };
    };
  };
  resolve: {
    alias: Record<string, string>;
  };
}
```

### Test Migration Mapping

```typescript
interface TestMigration {
  // Jest → Vitest API mapping
  imports: {
    from: 'import { jest } from "@jest/globals"';
    to: 'import { vi } from "vitest"';
  };
  mocking: {
    from: 'jest.fn()';
    to: 'vi.fn()';
  };
  spying: {
    from: 'jest.spyOn()';
    to: 'vi.spyOn()';
  };
  mocked: {
    from: 'jest.mocked()';
    to: 'vi.mocked()';
  };
}
```

## Error Handling

### Migration Error Categories

1. **Configuration Errors**: Invalid Vitest config, missing dependencies
2. **API Compatibility**: Jest APIs not available in Vitest
3. **Mock Migration**: Jest mock syntax requiring updates
4. **Path Resolution**: Import path issues after configuration changes

### Error Resolution Strategy

- Provide clear migration guides for each error type
- Use Vitest's Jest compatibility mode where possible
- Implement gradual migration with both systems temporarily
- Comprehensive testing after each migration step

## Testing Strategy

### Migration Validation

1. **Functional Parity**: All existing tests pass with Vitest
2. **Performance Improvement**: Faster test execution compared to Jest
3. **Coverage Accuracy**: Coverage reports match or exceed Jest accuracy
4. **Developer Experience**: IDE integration and debugging work correctly

### Test Categories

1. **Unit Tests**: Fast execution with improved hot reload
2. **Integration Tests**: Better TypeScript integration
3. **E2E Tests**: CLI command testing with real file operations
4. **Coverage Tests**: Comprehensive code coverage reporting

### Performance Testing

1. **Execution Speed**: Measure test suite execution time
2. **Memory Usage**: Monitor resource consumption
3. **Hot Reload**: Test watch mode performance
4. **Startup Time**: Initial test runner startup speed

## Implementation Approach

### Phase 1: Environment Preparation

- Remove Jest dependencies from package.json
- Install Vitest and related packages
- Verify no version conflicts with existing dependencies

### Phase 2: Configuration Migration

- Create vitest.config.ts replacing Jest configuration
- Set up test aliases and path resolution
- Configure coverage settings matching current thresholds
- Create separate E2E configuration

### Phase 3: Test File Migration

- Update import statements from Jest to Vitest
- Replace Jest mocking APIs with Vitest equivalents
- Update global test setup files
- Migrate custom test utilities

### Phase 4: Script Integration

- Update package.json test scripts
- Configure new Vitest-specific commands (UI, coverage)
- Test integration with existing development workflow
- Update CI/CD pipeline configuration

### Phase 5: Validation and Optimization

- Run complete test suite with Vitest
- Verify coverage reports accuracy
- Optimize configuration for best performance
- Document migration and new capabilities

## Performance Optimizations

### Vite Integration Benefits

- **Fast Compilation**: TypeScript compilation via esbuild
- **Hot Module Replacement**: Instant test updates on file changes
- **Smart Dependency Handling**: Only recompile changed modules
- **Parallel Execution**: Better multi-core utilization

### Configuration Optimizations

- **Selective Test Running**: Run only affected tests
- **Memory Management**: Optimized worker process handling
- **Cache Strategy**: Leverage Vite's intelligent caching
- **Bundle Optimization**: Efficient test bundle generation

## Compatibility Considerations

### Jest API Compatibility

- Most Jest APIs work without changes in Vitest
- Global functions (describe, it, expect) available with globals: true
- Mock functions require import from 'vitest' instead of global jest

### NestJS Testing Compatibility

- @nestjs/testing works seamlessly with Vitest
- TestingModule creation and dependency injection unchanged
- Supertest integration for HTTP testing remains the same

### TypeScript Integration

- Better TypeScript support with native Vite compilation
- Improved type checking performance
- Enhanced IDE integration and debugging

## Migration Timeline

### Immediate Benefits

- Faster test execution (2-5x speed improvement)
- Better TypeScript integration
- Improved developer experience with watch mode

### Long-term Benefits

- Ecosystem alignment with modern build tools
- Better maintenance and community support
- Advanced debugging and profiling capabilities
- Potential for future optimizations and features
