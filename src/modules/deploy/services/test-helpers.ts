import { TaptikContext } from '../../context/interfaces/taptik-context.interface';
import { CommandConfig } from '../interfaces/platform-config.interface';

export function createMockTaptikContext(
  overrides?: Partial<TaptikContext>,
): TaptikContext {
  return {
    metadata: {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      sourceIde: 'claude-code',
      targetIdes: ['claude-code'],
      ...overrides?.metadata,
    },
    content: {
      personal: {},
      project: {},
      prompts: {},
      tools: {},
      ide: {},
      ...overrides?.content,
    },
    security: {
      hasApiKeys: false,
      filteredFields: [],
      scanResults: {
        passed: true,
        warnings: [],
      },
      ...overrides?.security,
    },
  };
}

export function createMockCommand(
  overrides?: Partial<CommandConfig>,
): CommandConfig {
  return {
    name: 'test-command',
    description: 'Test command',
    content: 'echo "test"',
    permissions: [],
    metadata: {
      version: '1.0.0',
      author: 'test',
    },
    ...overrides,
  };
}
