/**
 * Test helpers and utilities for Cursor IDE testing
 * Provides utilities for mocking file systems, validation, and transformation testing
 */

import * as fs from 'fs';
import * as path from 'path';

/* eslint-disable import-x/no-extraneous-dependencies */
import { vi, expect } from 'vitest';
/* eslint-enable import-x/no-extraneous-dependencies */

import { CURSOR_TEST_FIXTURES } from '../test-fixtures/cursor-ide-fixtures';

/**
 * Mock file system for testing Cursor IDE configurations
 */
export class MockCursorFileSystem {
  private fileSystem: Map<string, string | Buffer> = new Map();

  constructor(private basePath: string = '/mock') {}

  /**
   * Add a file to the mock file system
   */
  addFile(filePath: string, content: string | Buffer): void {
    const fullPath = path.join(this.basePath, filePath);
    this.fileSystem.set(fullPath, content);
  }

  /**
   * Add a directory structure to the mock file system
   */
  addDirectory(dirPath: string, structure: Record<string, unknown>): void {
    const processStructure = (
      currentPath: string,
      obj: Record<string, unknown>,
    ): void => {
      for (const [key, value] of Object.entries(obj)) {
        const fullPath = path.join(currentPath, key);
        if (typeof value === 'string' || Buffer.isBuffer(value)) {
          this.fileSystem.set(fullPath, value);
        } else if (typeof value === 'object' && value !== null) {
          processStructure(fullPath, value as Record<string, unknown>);
        }
      }
    };

    processStructure(path.join(this.basePath, dirPath), structure);
  }

  /**
   * Get file content from mock file system
   */
  getFile(filePath: string): string | Buffer | undefined {
    const fullPath = path.join(this.basePath, filePath);
    return this.fileSystem.get(fullPath);
  }

  /**
   * Check if file exists in mock file system
   */
  exists(filePath: string): boolean {
    const fullPath = path.join(this.basePath, filePath);
    return this.fileSystem.has(fullPath);
  }

  /**
   * Get all files matching a pattern
   */
  glob(pattern: string): string[] {
    const regex = new RegExp(
      pattern.replace(/\*/g, '.*').replace(/\?/g, '.'),
    );
    return Array.from(this.fileSystem.keys())
      .filter((path) => regex.test(path))
      .map((path) => path.replace(this.basePath, '').replace(/^\//, ''));
  }

  /**
   * Setup mocks for fs module
   */
  setupFsMocks(): void {
    vi.spyOn(fs.promises, 'readFile').mockImplementation(async (filePath) => {
      const content = this.fileSystem.get(filePath as string);
      if (!content) {
        throw new Error(`ENOENT: no such file or directory, open '${filePath}'`);
      }
      return content as string | Buffer;
    });

    vi.spyOn(fs.promises, 'access').mockImplementation(async (filePath) => {
      if (!this.fileSystem.has(filePath as string)) {
        throw new Error(`ENOENT: no such file or directory, access '${filePath}'`);
      }
    });

    vi.spyOn(fs, 'existsSync').mockImplementation((filePath) => this.fileSystem.has(filePath as string));

    vi.spyOn(fs.promises, 'readdir').mockImplementation(async (dirPath) => {
      const dir = dirPath as string;
      const entries: string[] = [];
      const dirPrefix = dir.endsWith('/') ? dir : `${dir}/`;

      for (const filePath of this.fileSystem.keys()) {
        if (filePath.startsWith(dirPrefix)) {
          const relativePath = filePath.substring(dirPrefix.length);
          const firstSegment = relativePath.split('/')[0];
          if (firstSegment && !entries.includes(firstSegment)) {
            entries.push(firstSegment);
          }
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return entries as any;
    });

    vi.spyOn(fs.promises, 'stat').mockImplementation(async (filePath) => {
      if (!this.fileSystem.has(filePath as string)) {
        throw new Error(`ENOENT: no such file or directory, stat '${filePath}'`);
      }
      return {
        isDirectory: () => {
          const path = filePath as string;
          // Check if there are any files with this path as a prefix
          for (const key of this.fileSystem.keys()) {
            if (key.startsWith(`${path  }/`)) {
              return true;
            }
          }
          return false;
        },
        isFile: () => this.fileSystem.has(filePath as string),
        size: this.fileSystem.get(filePath as string)?.length || 0,
        // Add required properties for fs.Stats compatibility
        dev: 0,
        ino: 0,
        mode: 0,
        nlink: 0,
        uid: 0,
        gid: 0,
        rdev: 0,
        blksize: 0,
        blocks: 0,
        atimeMs: Date.now(),
        mtimeMs: Date.now(),
        ctimeMs: Date.now(),
        birthtimeMs: Date.now(),
        atime: new Date(),
        mtime: new Date(),
        ctime: new Date(),
        birthtime: new Date(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;
    });
  }

  /**
   * Clear all mocks
   */
  clearMocks(): void {
    vi.clearAllMocks();
  }

  /**
   * Reset the file system
   */
  reset(): void {
    this.fileSystem.clear();
  }
}

/**
 * Test data builder for dynamic test case generation
 */
export class CursorTestDataBuilder {
  private settings: Record<string, unknown> = {};
  private aiRules: Record<string, unknown> = {};
  private extensions: string[] = [];
  private snippets: Record<string, unknown> = {};
  private sensitive: boolean = false;

  withSettings(settings: Record<string, unknown>): this {
    this.settings = { ...this.settings, ...settings };
    return this;
  }

  withAiRules(rules: Record<string, unknown>): this {
    this.aiRules = { ...this.aiRules, ...rules };
    return this;
  }

  withExtensions(extensions: string[]): this {
    this.extensions = [...this.extensions, ...extensions];
    return this;
  }

  withSnippets(lang: string, snippets: Record<string, unknown>): this {
    this.snippets[lang] = snippets;
    return this;
  }

  withSensitiveData(): this {
    this.sensitive = true;
    return this;
  }

  build(): {
    settings: Record<string, unknown>;
    aiRules: Record<string, unknown>;
    extensions: { recommendations: string[] };
    snippets: Record<string, unknown>;
  } {
    const result = {
      settings: this.settings,
      aiRules: this.aiRules,
      extensions: { recommendations: this.extensions },
      snippets: this.snippets,
    };

    if (this.sensitive) {
      result.settings['cursor.apiKey'] = 'sk-secret-key-123';
      result.aiRules['globalConfig'] = {
        openaiKey: 'sk-openai-secret',
      };
    }

    return result;
  }
}

/**
 * Validation test helpers
 */
export class ValidationTestHelper {
  /**
   * Create a valid Cursor configuration
   */
  static createValidConfig(): Record<string, unknown> {
    return {
      settings: CURSOR_TEST_FIXTURES.settings.valid,
      aiRules: CURSOR_TEST_FIXTURES.aiRules.valid,
      extensions: CURSOR_TEST_FIXTURES.extensions.valid,
      snippets: CURSOR_TEST_FIXTURES.snippets,
    };
  }

  /**
   * Create an invalid configuration with specific errors
   */
  static createInvalidConfig(
    errorTypes: ('malformed' | 'sensitive' | 'incompatible')[],
  ): Record<string, unknown> {
    const config: Record<string, unknown> = {};

    if (errorTypes.includes('malformed')) {
      config.settings = CURSOR_TEST_FIXTURES.settings.malformed;
    }

    if (errorTypes.includes('sensitive')) {
      config.settings = {
        ...(config.settings as Record<string, unknown> || {}),
        ...CURSOR_TEST_FIXTURES.settings.withSensitiveData,
      };
      config.aiRules = CURSOR_TEST_FIXTURES.aiRules.withApiKeys;
    }

    if (errorTypes.includes('incompatible')) {
      config.extensions = CURSOR_TEST_FIXTURES.extensions.withIncompatible;
    }

    return config;
  }

  /**
   * Assert security filtering was applied
   */
  static assertSecurityFiltering(
    original: Record<string, unknown>,
    filtered: Record<string, unknown>,
  ): void {
    const checkForSensitiveData = (obj: unknown, path: string = ''): void => {
      if (typeof obj !== 'object' || obj === null) {
        return;
      }

      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;

        // Check if key contains sensitive patterns
        const sensitiveKeyPatterns = [
          /api[_-]?key/i,
          /token/i,
          /secret/i,
          /password/i,
          /credential/i,
        ];

        if (sensitiveKeyPatterns.some((pattern) => pattern.test(key))) {
          throw new Error(
            `Sensitive data found at ${currentPath}: key contains sensitive pattern`,
          );
        }

        // Check if value contains sensitive patterns
        if (typeof value === 'string') {
          const sensitiveValuePatterns = [
            /^sk-[\dA-Za-z]{20,}$/,
            /^ghp_[\dA-Za-z]{36}$/,
            /Bearer\s+[\w.-]+/,
          ];

          if (sensitiveValuePatterns.some((pattern) => pattern.test(value))) {
            throw new Error(
              `Sensitive data found at ${currentPath}: value contains sensitive pattern`,
            );
          }
        }

        // Recurse for nested objects
        checkForSensitiveData(value, currentPath);
      }
    };

    checkForSensitiveData(filtered);
  }
}

/**
 * Transformation test helpers
 */
export class TransformationTestHelper {
  /**
   * Assert Cursor settings were properly transformed to Taptik format
   */
  static assertCursorToTaptikTransformation(
    cursorConfig: Record<string, unknown>,
    taptikConfig: Record<string, unknown>,
  ): void {
    // Check that basic settings were transformed
    expect(taptikConfig).toHaveProperty('personalContext');
    expect(taptikConfig).toHaveProperty('projectContext');

    // Check specific mappings
    if (cursorConfig.settings) {
      const settings = cursorConfig.settings as Record<string, unknown>;
      const personal = (taptikConfig.personalContext as { preferences?: Record<string, unknown> })?.preferences;

      if (settings['editor.fontSize']) {
        expect(personal?.fontSize).toBe(settings['editor.fontSize']);
      }

      if (settings['workbench.colorTheme']) {
        expect(personal?.theme).toBe(settings['workbench.colorTheme']);
      }
    }
  }

  /**
   * Assert AI configuration was properly transformed
   */
  static assertAiConfigTransformation(
    aiRules: Record<string, unknown>,
    promptTemplates: Record<string, unknown>[],
  ): void {
    if (aiRules.rules && Array.isArray(aiRules.rules)) {
      expect(promptTemplates).toHaveLength(aiRules.rules.length);

      aiRules.rules.forEach((rule: { name: string; prompt: string }, index: number) => {
        const template = promptTemplates[index];
        expect(template).toHaveProperty('name', rule.name);
        expect(template).toHaveProperty('prompt', rule.prompt);
      });
    }
  }
}

/**
 * Performance test helpers
 */
export class PerformanceTestHelper {
  private startTime: number = 0;
  private measurements: Map<string, number[]> = new Map();

  /**
   * Start timing an operation
   */
  startTimer(): void {
    this.startTime = Date.now();
  }

  /**
   * End timing and record the measurement
   */
  endTimer(operation: string): number {
    const duration = Date.now() - this.startTime;
    const measurements = this.measurements.get(operation) || [];
    measurements.push(duration);
    this.measurements.set(operation, measurements);
    return duration;
  }

  /**
   * Get average time for an operation
   */
  getAverageTime(operation: string): number {
    const measurements = this.measurements.get(operation) || [];
    if (measurements.length === 0) return 0;
    return (
      measurements.reduce((sum, time) => sum + time, 0) / measurements.length
    );
  }

  /**
   * Assert performance is within acceptable limits
   */
  assertPerformance(operation: string, maxDuration: number): void {
    const avg = this.getAverageTime(operation);
    expect(avg).toBeLessThan(maxDuration);
  }

  /**
   * Generate large configuration for performance testing
   */
  static generateLargeConfig(size: 'small' | 'medium' | 'large'): Record<string, unknown> {
    const counts = {
      small: { settings: 50, extensions: 20, snippets: 10 },
      medium: { settings: 200, extensions: 100, snippets: 50 },
      large: { settings: 1000, extensions: 500, snippets: 200 },
    };

    const config = counts[size];
    const result: Record<string, unknown> = {
      settings: {},
      extensions: { recommendations: [] },
      snippets: {},
    };

    // Generate settings
    for (let i = 0; i < config.settings; i++) {
      (result.settings as Record<string, string>)[`setting.${i}`] = `value-${i}`;
    }

    // Generate extensions
    for (let i = 0; i < config.extensions; i++) {
      (result.extensions as { recommendations: string[] }).recommendations.push(`ext.extension-${i}`);
    }

    // Generate snippets
    for (let i = 0; i < config.snippets; i++) {
      (result.snippets as Record<string, { prefix: string; body: string[] }>)[`snippet-${i}`] = {
        prefix: `prefix-${i}`,
        body: [`line1-${i}`, `line2-${i}`],
      };
    }

    return result;
  }
}

/**
 * Integration test helpers
 */
export class IntegrationTestHelper {
  /**
   * Create a complete mock Cursor IDE environment
   */
  static async setupCursorEnvironment(
    type: 'minimal' | 'standard' | 'complex',
  ): Promise<MockCursorFileSystem> {
    const fs = new MockCursorFileSystem();

    switch (type) {
      case 'minimal':
        fs.addDirectory('', {
          '.cursor': {
            'settings.json': JSON.stringify(CURSOR_TEST_FIXTURES.settings.valid),
          },
        });
        break;

      case 'standard':
        fs.addDirectory('', CURSOR_TEST_FIXTURES.mockFileSystem.global);
        fs.addDirectory('project', CURSOR_TEST_FIXTURES.mockFileSystem.project);
        break;

      case 'complex':
        fs.addDirectory('', {
          ...CURSOR_TEST_FIXTURES.mockFileSystem.global,
          project1: CURSOR_TEST_FIXTURES.mockFileSystem.project,
          project2: {
            '.cursor': {
              'workspace.json': JSON.stringify(
                CURSOR_TEST_FIXTURES.workspace.multiRoot,
              ),
            },
          },
        });
        break;
    }

    fs.setupFsMocks();
    return fs;
  }

  /**
   * Assert complete build pipeline success
   */
  static assertBuildSuccess(result: { personalContext?: unknown; projectContext?: unknown; promptTemplates?: unknown; errors: unknown[]; warnings?: unknown }): void {
    expect(result).toHaveProperty('personalContext');
    expect(result).toHaveProperty('projectContext');
    expect(result).toHaveProperty('promptTemplates');
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toBeDefined();
  }
}