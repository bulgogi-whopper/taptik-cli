/**
 * Base test case class for Cursor IDE testing
 * Provides common testing utilities and setup/teardown methods
 */

/* eslint-disable import-x/no-extraneous-dependencies */
import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
/* eslint-enable import-x/no-extraneous-dependencies */


import { MockService } from '../interfaces/build-types.interface';
import { VSCodeSettings, CursorAiConfiguration, CursorSettingsData } from '../interfaces/cursor-ide.interfaces';

import { MockCursorFileSystem } from './cursor-test-helpers';

// Type definitions for testing
type ServiceConstructor<T = unknown> = new (...args: unknown[]) => T;
type MockImplementation = (...args: unknown[]) => unknown;
type SpyInstance = ReturnType<typeof vi.spyOn>;

/**
 * Base test case class with common testing utilities
 */
export abstract class BaseTestCase {
  protected testingModule!: TestingModule;
  protected mockFileSystem!: MockCursorFileSystem;
  protected logger!: Logger;

  /**
   * Get the providers for the testing module
   * Override this in subclasses to provide service-specific providers
   */
  protected abstract getProviders(): Array<ServiceConstructor | { provide: ServiceConstructor; useValue: unknown; }>;

  /**
   * Setup method called before each test
   */
  protected async setup(): Promise<void> {
    // Create mock file system
    this.mockFileSystem = new MockCursorFileSystem();
    this.mockFileSystem.setupFsMocks();

    // Create testing module
    this.testingModule = await Test.createTestingModule({
      providers: [
        ...this.getProviders(),
        {
          provide: Logger,
          useValue: {
            log: vi.fn(),
            error: vi.fn(),
            warn: vi.fn(),
            debug: vi.fn(),
            verbose: vi.fn(),
          },
        },
      ],
    }).compile();

    this.logger = this.testingModule.get<Logger>(Logger);
  }

  /**
   * Teardown method called after each test
   */
  protected async teardown(): Promise<void> {
    this.mockFileSystem.clearMocks();
    this.mockFileSystem.reset();
    vi.clearAllMocks();
    
    if (this.testingModule) {
      await this.testingModule.close();
    }
  }

  /**
   * Run a test suite with automatic setup and teardown
   */
  protected runTestSuite(
    suiteName: string,
    testCallback: () => void,
  ): void {
    describe(suiteName, () => {
      beforeEach(async () => {
        await this.setup();
      });

      afterEach(async () => {
        await this.teardown();
      });

      testCallback();
    });
  }

  /**
   * Helper method to create a test with proper error handling
   */
  protected createTest(
    testName: string,
    testFn: () => Promise<void> | void,
    timeout?: number,
  ): void {
    it(
      testName,
      async () => {
        try {
          await testFn();
        } catch (error) {
          // Log error for debugging
          this.logger.error(`Test failed: ${testName}`, error);
          throw error;
        }
      },
      timeout,
    );
  }

  /**
   * Assert that an async function throws a specific error
   */
  protected async assertAsyncThrows(
    fn: () => Promise<unknown>,
    errorMessage?: string | RegExp,
  ): Promise<void> {
    let thrown = false;
    let error: Error;

    try {
      await fn();
    } catch (e) {
      thrown = true;
      error = e as Error;
    }

    expect(thrown).toBe(true);

    if (errorMessage) {
      if (typeof errorMessage === 'string') {
        expect(error.message).toContain(errorMessage);
      } else {
        expect(error.message).toMatch(errorMessage);
      }
    }
  }

  /**
   * Create a spy for a service method
   */
  protected createSpy<T, K extends keyof T>(
    service: T,
    methodName: K,
    implementation?: MockImplementation,
  ): SpyInstance {
    const spy = vi.spyOn(service as Record<string, (...args: unknown[]) => unknown>, methodName as string);
    
    if (implementation) {
      spy.mockImplementation(implementation);
    }

    return spy;
  }

  /**
   * Assert that a spy was called with specific arguments
   */
  protected assertSpyCalled(
    spy: SpyInstance,
    expectedArgs?: unknown[],
    callIndex: number = 0,
  ): void {
    expect(spy).toHaveBeenCalled();

    if (expectedArgs) {
      const actualCall = spy.mock.calls[callIndex];
      expect(actualCall).toEqual(expectedArgs);
    }
  }

  /**
   * Create a mock service with all methods mocked
   */
  protected createMockService<T>(
    serviceName: string,
    methods: (keyof T)[],
  ): MockService<T> {
    const mockService: MockService = {
      [serviceName]: serviceName,
    };

    methods.forEach((method) => {
      mockService[method as string] = vi.fn();
    });

    return mockService as MockService<T>;
  }

  /**
   * Wait for a condition to be true
   */
  protected async waitFor(
    condition: () => boolean,
    timeout: number = 5000,
    interval: number = 100,
  ): Promise<void> {
    const startTime = Date.now();

    // Use a promise-based approach to avoid await in loop
    return new Promise<void>((resolve, reject) => {
      const checkCondition = () => {
        if (condition()) {
          resolve();
        } else if (Date.now() - startTime > timeout) {
          reject(new Error('Timeout waiting for condition'));
        } else {
          setTimeout(checkCondition, interval);
        }
      };
      checkCondition();
    });
  }

  /**
   * Create test data with default values
   */
  protected createTestData<T>(
    defaults: Partial<T>,
    overrides?: Partial<T>,
  ): T {
    return { ...defaults, ...overrides } as T;
  }
}

/**
 * Service test case base class
 */
export abstract class ServiceTestCase<T = unknown> extends BaseTestCase {
  protected service!: T;

  /**
   * Get the service class to test
   */
  protected abstract getServiceClass(): ServiceConstructor<T>;

  /**
   * Get the service dependencies
   */
  protected abstract getServiceDependencies(): Array<ServiceConstructor | { provide: ServiceConstructor; useValue: unknown; }>;

  protected getProviders(): Array<ServiceConstructor | { provide: ServiceConstructor; useValue: unknown; }> {
    return [
      this.getServiceClass(),
      ...this.getServiceDependencies(),
    ];
  }

  protected async setup(): Promise<void> {
    await super.setup();
    this.service = this.testingModule.get(this.getServiceClass());
  }
}

/**
 * Integration test case base class
 */
export abstract class IntegrationTestCase extends BaseTestCase {
  protected services: Map<ServiceConstructor, unknown> = new Map();

  /**
   * Get the list of services for integration testing
   */
  protected abstract getIntegrationServices(): ServiceConstructor[];

  protected getProviders(): Array<ServiceConstructor | { provide: ServiceConstructor; useValue: unknown; }> {
    return this.getIntegrationServices();
  }

  protected async setup(): Promise<void> {
    await super.setup();

    // Initialize all services
    for (const ServiceClass of this.getIntegrationServices()) {
      const service = this.testingModule.get(ServiceClass);
      this.services.set(ServiceClass, service);
    }
  }

  /**
   * Get a service instance by class
   */
  protected getService<T>(ServiceClass: ServiceConstructor<T>): T {
    return this.services.get(ServiceClass) as T;
  }
}

/**
 * Mock services factory
 */
export class MockServicesFactory {
  /**
   * Create a mock CollectionService
   */
  static createMockCollectionService(): {
    collectCursorLocalSettings: ReturnType<typeof vi.fn>;
    collectCursorGlobalSettings: ReturnType<typeof vi.fn>;
    parseCursorAiConfig: ReturnType<typeof vi.fn>;
    collectCursorExtensions: ReturnType<typeof vi.fn>;
    collectCursorSnippets: ReturnType<typeof vi.fn>;
  } {
    return {
      collectCursorLocalSettings: vi.fn(),
      collectCursorGlobalSettings: vi.fn(),
      parseCursorAiConfig: vi.fn(),
      collectCursorExtensions: vi.fn(),
      collectCursorSnippets: vi.fn(),
    };
  }

  /**
   * Create a mock TransformationService
   */
  static createMockTransformationService(): {
    transformCursorPersonalContext: ReturnType<typeof vi.fn>;
    transformCursorProjectContext: ReturnType<typeof vi.fn>;
    transformCursorPromptTemplates: ReturnType<typeof vi.fn>;
    mapCursorExtensions: ReturnType<typeof vi.fn>;
  } {
    return {
      transformCursorPersonalContext: vi.fn(),
      transformCursorProjectContext: vi.fn(),
      transformCursorPromptTemplates: vi.fn(),
      mapCursorExtensions: vi.fn(),
    };
  }

  /**
   * Create a mock ValidationService
   */
  static createMockValidationService(): {
    validateVSCodeSchema: ReturnType<typeof vi.fn>;
    sanitizeAiConfiguration: ReturnType<typeof vi.fn>;
    checkExtensionCompatibility: ReturnType<typeof vi.fn>;
    generateSecurityReport: ReturnType<typeof vi.fn>;
  } {
    return {
      validateVSCodeSchema: vi.fn(),
      sanitizeAiConfiguration: vi.fn(),
      checkExtensionCompatibility: vi.fn(),
      generateSecurityReport: vi.fn(),
    };
  }

  /**
   * Create a mock OutputService
   */
  static createMockOutputService(): {
    generateFiles: ReturnType<typeof vi.fn>;
    writeFile: ReturnType<typeof vi.fn>;
    createDirectory: ReturnType<typeof vi.fn>;
    displaySummary: ReturnType<typeof vi.fn>;
  } {
    return {
      generateFiles: vi.fn(),
      writeFile: vi.fn(),
      createDirectory: vi.fn(),
      displaySummary: vi.fn(),
    };
  }

  /**
   * Create a mock ProgressService
   */
  static createMockProgressService(): {
    startStep: ReturnType<typeof vi.fn>;
    updateProgress: ReturnType<typeof vi.fn>;
    completeStep: ReturnType<typeof vi.fn>;
    failStep: ReturnType<typeof vi.fn>;
    startSpinner: ReturnType<typeof vi.fn>;
    stopSpinner: ReturnType<typeof vi.fn>;
  } {
    return {
      startStep: vi.fn(),
      updateProgress: vi.fn(),
      completeStep: vi.fn(),
      failStep: vi.fn(),
      startSpinner: vi.fn(),
      stopSpinner: vi.fn(),
    };
  }

  /**
   * Create a mock ErrorHandlerService
   */
  static createMockErrorHandlerService(): {
    handleError: ReturnType<typeof vi.fn>;
    addWarning: ReturnType<typeof vi.fn>;
    getWarnings: ReturnType<typeof vi.fn>;
    hasErrors: ReturnType<typeof vi.fn>;
    reset: ReturnType<typeof vi.fn>;
  } {
    return {
      handleError: vi.fn(),
      addWarning: vi.fn(),
      getWarnings: vi.fn().mockReturnValue([]),
      hasErrors: vi.fn().mockReturnValue(false),
      reset: vi.fn(),
    };
  }
}

/**
 * Test data factory for creating test objects
 */
export class TestDataFactory {
  /**
   * Create test Cursor settings
   */
  static createCursorSettings(overrides?: Partial<VSCodeSettings>): VSCodeSettings {
    return {
      'editor.fontSize': 14,
      'editor.fontFamily': 'JetBrains Mono',
      'editor.tabSize': 2,
      'workbench.colorTheme': 'One Dark Pro',
      'cursor.aiProvider': 'openai',
      'cursor.aiModel': 'gpt-4',
      ...overrides,
    };
  }

  /**
   * Create test AI rules
   */
  static createAiRules(overrides?: Partial<CursorAiConfiguration>): CursorAiConfiguration {
    return {
      version: '1.0.0',
      rules: [
        {
          name: 'Test Rule',
          pattern: '*.ts',
          prompt: 'Test prompt',
          enabled: true,
        },
      ],
      ...overrides,
    };
  }

  /**
   * Create test extension list
   */
  static createExtensions(extensions?: string[]): { recommendations: string[] } {
    return {
      recommendations: extensions || [
        'dbaeumer.vscode-eslint',
        'esbenp.prettier-vscode',
        'cursor.cursor-ai',
      ],
    };
  }

  /**
   * Create test snippets
   */
  static createSnippets(lang: string = 'typescript'): Record<string, Record<string, { prefix: string; body: string[]; description: string }>> {
    return {
      [lang]: {
        'Test Snippet': {
          prefix: 'test',
          body: ['test body'],
          description: 'Test snippet',
        },
      },
    };
  }

  /**
   * Create a complete test configuration
   */
  static createCompleteConfig(): CursorSettingsData {
    return {
      settings: this.createCursorSettings(),
      extensions: this.createExtensions(),
      snippets: this.createSnippets(),
      keybindings: [
        {
          key: 'cmd+k cmd+d',
          command: 'cursor.aiChat',
        },
      ],
      sourcePath: '/test/path',
      collectedAt: new Date().toISOString(),
      isGlobal: false,
    };
  }
}