/**
 * Claude Code Test Infrastructure and Strategy
 *
 * This file defines the TDD test infrastructure for Claude Code build feature.
 * Following the Red-Green-Refactor cycle for all implementations.
 */

// Import vi from vitest only when in test environment
declare const vi: {
  clearAllMocks(): void;
  resetAllMocks(): void;
};

/**
 * Test Coverage Goals
 * - New code: >90% coverage
 * - Overall: >80% coverage
 * - Critical paths: 100% coverage
 */
export const TEST_COVERAGE_GOALS = {
  newCode: {
    lines: 90,
    branches: 90,
    functions: 90,
    statements: 90,
  },
  overall: {
    lines: 80,
    branches: 60,
    functions: 60,
    statements: 80,
  },
  criticalPaths: {
    security: 100,
    cloudUpload: 100,
    sanitization: 100,
  },
};

/**
 * Test Naming Conventions
 * - Unit tests: `describe('[ServiceName]', () => { it('should [expected behavior] when [condition]') })`
 * - Integration tests: `describe('[Feature] Integration', () => { it('integrates [components] for [outcome]') })`
 * - E2E tests: `describe('[Command] E2E', () => { it('executes [flow] from [start] to [end]') })`
 */
export const TEST_NAMING_CONVENTIONS = {
  unit: {
    pattern: 'should [expected behavior] when [condition]',
    example: 'should return sanitized config when sensitive data is present',
  },
  integration: {
    pattern: 'integrates [components] for [outcome]',
    example:
      'integrates collection and transformation services for complete build',
  },
  e2e: {
    pattern: 'executes [flow] from [start] to [end]',
    example: 'executes build command from CLI input to package output',
  },
};

/**
 * Test Organization Structure
 * - Each service has its own spec file
 * - Fixtures are centralized in test-fixtures
 * - Helpers are co-located with services
 * - Integration tests in separate files
 */
export const TEST_ORGANIZATION = {
  structure: {
    unit: '*.spec.ts',
    integration: '*.integration.spec.ts',
    e2e: '*.e2e-spec.ts',
    fixtures: 'test-fixtures/',
    helpers: 'test-helpers.ts',
  },
  grouping: {
    byFeature: true,
    byPhase: ['RED', 'GREEN', 'REFACTOR'],
    byPriority: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'],
  },
};

/**
 * CI/CD Pipeline Integration
 * - Pre-commit: lint and type check
 * - Pre-push: unit tests
 * - PR: full test suite with coverage
 * - Main merge: E2E tests
 */
export const CI_CD_INTEGRATION = {
  preCommit: ['lint', 'typecheck'],
  prePush: ['test:unit'],
  pullRequest: ['test:run', 'test:coverage'],
  mainMerge: ['test:e2e', 'test:integration'],
  deployment: ['test:smoke', 'test:regression'],
};

/**
 * Test Execution Wrapper
 * Provides consistent test execution environment
 */
export class TestExecutionWrapper {
  private originalEnv: NodeJS.ProcessEnv;
  private mockFs: Map<string, string | Buffer>;

  constructor() {
    this.originalEnv = { ...process.env };
    this.mockFs = new Map();
  }

  /**
   * Setup test environment
   */
  async setup(
    options: {
      env?: Record<string, string>;
      mockFiles?: Record<string, string | Buffer>;
      clearMocks?: boolean;
    } = {},
  ): Promise<void> {
    // Set environment variables
    if (options.env) {
      Object.assign(process.env, options.env);
    }

    // Setup mock file system
    if (options.mockFiles) {
      for (const [path, content] of Object.entries(options.mockFiles)) {
        this.mockFs.set(path, content);
      }
    }

    // Clear all mocks if requested
    if (options.clearMocks) {
      vi.clearAllMocks();
    }
  }

  /**
   * Teardown test environment
   */
  async teardown(): Promise<void> {
    // Restore original environment
    process.env = { ...this.originalEnv };

    // Clear mock file system
    this.mockFs.clear();

    // Reset all mocks
    vi.resetAllMocks();
  }

  /**
   * Get mock file content
   */
  getMockFile(path: string): string | Buffer | undefined {
    return this.mockFs.get(path);
  }

  /**
   * Add mock file
   */
  addMockFile(path: string, content: string | Buffer): void {
    this.mockFs.set(path, content);
  }
}

/**
 * Assertion Helpers for Claude Code specific validations
 */
export class ClaudeCodeAssertions {
  /**
   * Assert configuration is properly sanitized
   */
  static assertSanitized(config: unknown): void {
    const sensitivePatterns = [
      /api[_-]?key/i,
      /token/i,
      /password/i,
      /secret/i,
      /private[_-]?key/i,
    ];

    const configString = JSON.stringify(config);
    for (const pattern of sensitivePatterns) {
      if (pattern.test(configString)) {
        throw new Error(
          `Configuration contains sensitive data matching: ${pattern}`,
        );
      }
    }
  }

  /**
   * Assert cloud metadata is complete
   */
  static assertCloudMetadataComplete(metadata: unknown): void {
    const requiredFields = [
      'title',
      'description',
      'tags',
      'sourceIde',
      'targetIdes',
      'version',
      'checksum',
    ];

    for (const field of requiredFields) {
      if (!(field in (metadata as Record<string, unknown>))) {
        throw new Error(`Cloud metadata missing required field: ${field}`);
      }
    }
  }

  /**
   * Assert package structure is valid
   */
  static assertValidPackageStructure(packageData: unknown): void {
    const requiredSections = ['metadata', 'content', 'security', 'cloud'];

    for (const section of requiredSections) {
      if (!(section in (packageData as Record<string, unknown>))) {
        throw new Error(`Package missing required section: ${section}`);
      }
    }
  }

  /**
   * Assert MCP configuration is valid
   */
  static assertValidMcpConfig(config: unknown): void {
    const configObj = config as Record<string, unknown>;
    if (!configObj.mcpServers || typeof configObj.mcpServers !== 'object') {
      throw new Error(
        'Invalid MCP configuration: missing or invalid mcpServers',
      );
    }

    for (const [name, server] of Object.entries(
      configObj.mcpServers as Record<string, unknown>,
    )) {
      if (!server || typeof server !== 'object') {
        throw new Error(`Invalid MCP server configuration for: ${name}`);
      }

      const serverConfig = server as Record<string, unknown>;
      if (!serverConfig.command) {
        throw new Error(`MCP server ${name} missing required field: command`);
      }
    }
  }

  /**
   * Assert agent format is valid
   */
  static assertValidAgentFormat(agent: unknown): void {
    const agentObj = agent as Record<string, unknown>;
    const requiredFields = ['name', 'description', 'instructions'];

    for (const field of requiredFields) {
      if (!(field in agentObj)) {
        throw new Error(`Agent missing required field: ${field}`);
      }
    }

    if (
      typeof agentObj.instructions !== 'string' &&
      !Array.isArray(agentObj.instructions)
    ) {
      throw new Error('Agent instructions must be string or array');
    }
  }
}

/**
 * Test Data Management Strategy
 */
export class TestDataManager {
  private builders: Map<string, (overrides?: unknown) => unknown>;
  private fixtures: Map<string, unknown>;

  constructor() {
    this.builders = new Map();
    this.fixtures = new Map();
  }

  /**
   * Register a test data builder
   */
  registerBuilder(
    name: string,
    builder: (overrides?: unknown) => unknown,
  ): void {
    this.builders.set(name, builder);
  }

  /**
   * Register a fixture
   */
  registerFixture(name: string, data: unknown): void {
    this.fixtures.set(name, data);
  }

  /**
   * Build test data
   */
  build(builderName: string, overrides?: unknown): unknown {
    const builder = this.builders.get(builderName);
    if (!builder) {
      throw new Error(`Builder not found: ${builderName}`);
    }
    return builder(overrides);
  }

  /**
   * Get fixture
   */
  getFixture(name: string): unknown {
    const fixture = this.fixtures.get(name);
    if (!fixture) {
      throw new Error(`Fixture not found: ${name}`);
    }
    return JSON.parse(JSON.stringify(fixture)); // Deep clone
  }
}

/**
 * Performance Testing Utilities
 */
export class PerformanceTestUtils {
  /**
   * Measure execution time
   */
  static async measureTime<T>(
    fn: () => Promise<T>,
    threshold?: number,
  ): Promise<{ result: T; duration: number }> {
    const start = Date.now();
    const result = await fn();
    const duration = Date.now() - start;

    if (threshold && duration > threshold) {
      // eslint-disable-next-line no-console
      console.warn(
        `Performance threshold exceeded: ${duration}ms > ${threshold}ms`,
      );
    }

    return { result, duration };
  }

  /**
   * Create large test dataset
   */
  static createLargeDataset(options: {
    agents?: number;
    commands?: number;
    mcpServers?: number;
    fileSize?: number;
  }): {
    agents: unknown[];
    commands: unknown[];
    mcpServers: Record<string, unknown>;
  } {
    const dataset: {
      agents: unknown[];
      commands: unknown[];
      mcpServers: Record<string, unknown>;
    } = {
      agents: [],
      commands: [],
      mcpServers: {},
    };

    // Generate agents
    for (let i = 0; i < (options.agents || 100); i++) {
      dataset.agents.push({
        name: `agent-${i}`,
        description: `Test agent ${i}`,
        instructions: `Instructions for agent ${i}`.repeat(10),
      });
    }

    // Generate commands
    for (let i = 0; i < (options.commands || 100); i++) {
      dataset.commands.push({
        name: `command-${i}`,
        description: `Test command ${i}`,
        content: `echo "command ${i}"`,
      });
    }

    // Generate MCP servers
    for (let i = 0; i < (options.mcpServers || 10); i++) {
      dataset.mcpServers[`server-${i}`] = {
        command: `node`,
        args: [`server-${i}.js`],
        env: {
          TEST_VAR: `value-${i}`,
        },
      };
    }

    return dataset;
  }
}

/**
 * Mock Factory for Claude Code components
 */
export class ClaudeCodeMockFactory {
  /**
   * Create mock settings.json
   */
  static createMockSettings(
    overrides?: Record<string, unknown>,
  ): Record<string, unknown> {
    return {
      theme: 'dark',
      fontSize: 14,
      tabSize: 2,
      wordWrap: 'on',
      minimap: { enabled: false },
      ...overrides,
    };
  }

  /**
   * Create mock MCP configuration
   */
  static createMockMcpConfig(
    overrides?: Record<string, unknown>,
  ): Record<string, unknown> {
    return {
      mcpServers: {
        'test-server': {
          command: 'node',
          args: ['test-server.js'],
          env: {
            NODE_ENV: 'test',
          },
        },
        ...((overrides?.mcpServers as Record<string, unknown>) || {}),
      },
      ...overrides,
    };
  }

  /**
   * Create mock agent
   */
  static createMockAgent(
    overrides?: Record<string, unknown>,
  ): Record<string, unknown> {
    return {
      name: 'test-agent',
      description: 'A test agent',
      instructions: 'Test instructions for the agent',
      ...overrides,
    };
  }

  /**
   * Create mock command
   */
  static createMockCommand(
    overrides?: Record<string, unknown>,
  ): Record<string, unknown> {
    return {
      name: 'test-command',
      description: 'A test command',
      content: 'echo "test"',
      ...overrides,
    };
  }

  /**
   * Create mock cloud metadata
   */
  static createMockCloudMetadata(
    overrides?: Record<string, unknown>,
  ): Record<string, unknown> {
    return {
      title: 'Test Configuration',
      description: 'A test configuration package',
      tags: ['test', 'claude-code'],
      sourceIde: 'claude-code',
      targetIdes: ['claude-code', 'kiro-ide'],
      version: '1.0.0',
      checksum: 'abc123',
      createdAt: new Date().toISOString(),
      ...overrides,
    };
  }
}

/**
 * Test Phase Manager for TDD cycle
 */
export class TddPhaseManager {
  private currentPhase: 'RED' | 'GREEN' | 'REFACTOR';
  private phaseHistory: Array<{
    phase: string;
    timestamp: Date;
    description: string;
  }>;

  constructor() {
    this.currentPhase = 'RED';
    this.phaseHistory = [];
  }

  /**
   * Start RED phase - write failing tests
   */
  startRedPhase(description: string): void {
    this.currentPhase = 'RED';
    this.phaseHistory.push({
      phase: 'RED',
      timestamp: new Date(),
      description,
    });
    // eslint-disable-next-line no-console
    console.log(`🔴 RED PHASE: ${description}`);
  }

  /**
   * Start GREEN phase - make tests pass
   */
  startGreenPhase(description: string): void {
    this.currentPhase = 'GREEN';
    this.phaseHistory.push({
      phase: 'GREEN',
      timestamp: new Date(),
      description,
    });
    // eslint-disable-next-line no-console
    console.log(`🟢 GREEN PHASE: ${description}`);
  }

  /**
   * Start REFACTOR phase - improve code quality
   */
  startRefactorPhase(description: string): void {
    this.currentPhase = 'REFACTOR';
    this.phaseHistory.push({
      phase: 'REFACTOR',
      timestamp: new Date(),
      description,
    });
    // eslint-disable-next-line no-console
    console.log(`🔵 REFACTOR PHASE: ${description}`);
  }

  /**
   * Get current phase
   */
  getCurrentPhase(): string {
    return this.currentPhase;
  }

  /**
   * Get phase history
   */
  getPhaseHistory(): Array<{
    phase: string;
    timestamp: Date;
    description: string;
  }> {
    return this.phaseHistory;
  }
}

/**
 * Export all test infrastructure
 */
export const claudeCodeTestInfrastructure = {
  coverageGoals: TEST_COVERAGE_GOALS,
  namingConventions: TEST_NAMING_CONVENTIONS,
  organization: TEST_ORGANIZATION,
  ciCd: CI_CD_INTEGRATION,
  TestExecutionWrapper,
  ClaudeCodeAssertions,
  TestDataManager,
  PerformanceTestUtils,
  ClaudeCodeMockFactory,
  TddPhaseManager,
};
