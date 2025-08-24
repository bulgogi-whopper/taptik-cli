/**
 * Claude Code file structure fixtures for testing file system operations
 * Provides mock directory structures and file paths
 */

import {
  validClaudeCodeSettings,
  validClaudeAgent,
  validClaudeCommand,
  validMcpConfig,
  claudeMdContent,
  claudeLocalMdContent,
  steeringFiles,
} from './claude-code-fixtures';
import { MockFileSystemConfig } from './mock-file-system';

// ============================================================================
// Directory Structure Definitions
// ============================================================================

export const CLAUDE_CODE_PATHS = {
  // Global paths (user home directory)
  GLOBAL: {
    BASE: '~/.claude',
    SETTINGS: '~/.claude/settings.json',
    AGENTS_DIR: '~/.claude/agents',
    COMMANDS_DIR: '~/.claude/commands',
    HOOKS_DIR: '~/.claude/hooks',
    MCP_CONFIG: '~/.mcp.json',
  },

  // Local project paths
  LOCAL: {
    BASE: '.claude',
    SETTINGS: '.claude/settings.json',
    AGENTS_DIR: '.claude/agents',
    COMMANDS_DIR: '.claude/commands',
    HOOKS_DIR: '.claude/hooks',
    STEERING_DIR: '.claude/steering',
    CLAUDE_MD: 'CLAUDE.md',
    CLAUDE_LOCAL_MD: 'CLAUDE.local.md',
    MCP_CONFIG: '.mcp.json',
  },
};

// ============================================================================
// Complete Project Structure
// ============================================================================

export const completeProjectStructure: MockFileSystemConfig = {
  directories: [
    '/project',
    '/project/.claude',
    '/project/.claude/agents',
    '/project/.claude/commands',
    '/project/.claude/hooks',
    '/project/.claude/steering',
    '/home/user/.claude',
    '/home/user/.claude/agents',
    '/home/user/.claude/commands',
  ],
  files: {
    // Local project files
    '/project/.claude/settings.json': JSON.stringify(
      validClaudeCodeSettings,
      null,
      2,
    ),
    '/project/.claude/agents/code-reviewer.json': JSON.stringify(
      validClaudeAgent,
      null,
      2,
    ),
    '/project/.claude/agents/helper.json': JSON.stringify(
      {
        name: 'Helper Agent',
        description: 'General purpose helper',
        instructions: 'Assist with various tasks',
      },
      null,
      2,
    ),
    '/project/.claude/commands/format.json': JSON.stringify(
      validClaudeCommand,
      null,
      2,
    ),
    '/project/.claude/commands/test.json': JSON.stringify(
      {
        name: 'test',
        description: 'Run tests',
        command: 'npm test',
      },
      null,
      2,
    ),
    '/project/.claude/hooks/pre-commit.sh': '#!/bin/bash\nnpm run lint',
    '/project/.claude/hooks/post-build.js': 'console.log("Build complete");',
    '/project/.claude/steering/principle.md': steeringFiles.principle,
    '/project/.claude/steering/persona.md': steeringFiles.persona,
    '/project/.claude/steering/context.md': steeringFiles.context,
    '/project/.claude/steering/workflow.md': steeringFiles.workflow,
    '/project/CLAUDE.md': claudeMdContent,
    '/project/CLAUDE.local.md': claudeLocalMdContent,
    '/project/.mcp.json': JSON.stringify(validMcpConfig, null, 2),

    // Global user files
    '/home/user/.claude/settings.json': JSON.stringify(
      {
        theme: 'dark',
        fontSize: 12,
      },
      null,
      2,
    ),
    '/home/user/.claude/agents/global-helper.json': JSON.stringify(
      {
        name: 'Global Helper',
        description: 'Global helper agent',
        instructions: 'Help with common tasks',
      },
      null,
      2,
    ),
    '/home/user/.claude/commands/global-build.json': JSON.stringify(
      {
        name: 'build',
        description: 'Build project',
        command: 'npm run build',
      },
      null,
      2,
    ),
    '/home/user/.mcp.json': JSON.stringify(
      {
        mcpServers: {
          global: {
            command: 'npx',
            args: ['@global/mcp-server'],
          },
        },
      },
      null,
      2,
    ),
  },
};

// ============================================================================
// Minimal Project Structure
// ============================================================================

export const minimalProjectStructure: MockFileSystemConfig = {
  directories: ['/project', '/project/.claude'],
  files: {
    '/project/.claude/settings.json': JSON.stringify(
      {
        theme: 'light',
      },
      null,
      2,
    ),
    '/project/CLAUDE.md': '# Claude Instructions\n\nMinimal setup',
  },
};

// ============================================================================
// Project with Missing Directories
// ============================================================================

export const missingDirectoriesStructure: MockFileSystemConfig = {
  directories: ['/project'],
  files: {
    '/project/CLAUDE.md': claudeMdContent,
  },
};

// ============================================================================
// Project with Permission Issues
// ============================================================================

export const permissionIssuesStructure: MockFileSystemConfig = {
  directories: ['/project', '/project/.claude', '/project/.claude/agents'],
  files: {
    '/project/.claude/settings.json': JSON.stringify(
      validClaudeCodeSettings,
      null,
      2,
    ),
    '/project/.claude/agents/restricted.json': JSON.stringify(
      validClaudeAgent,
      null,
      2,
    ),
  },
  permissions: {
    '/project/.claude/settings.json': { readable: false, writable: false },
    '/project/.claude/agents/restricted.json': {
      readable: true,
      writable: false,
    },
  },
};

// ============================================================================
// Project with Malformed Files
// ============================================================================

export const malformedFilesStructure: MockFileSystemConfig = {
  directories: [
    '/project',
    '/project/.claude',
    '/project/.claude/agents',
    '/project/.claude/commands',
  ],
  files: {
    '/project/.claude/settings.json': '{ invalid json syntax',
    '/project/.claude/agents/broken.json': 'not even json',
    '/project/.claude/commands/invalid.json': '{ "name": }',
    '/project/.mcp.json': '{ "mcpServers": { "test": { invalid } } }',
    '/project/CLAUDE.md': '', // Empty file
  },
};

// ============================================================================
// Project with Sensitive Data
// ============================================================================

export const sensitiveDataStructure: MockFileSystemConfig = {
  directories: ['/project', '/project/.claude'],
  files: {
    '/project/.claude/settings.json': JSON.stringify(
      {
        theme: 'dark',
        apiKey: 'sk-1234567890abcdef',
        githubToken: 'ghp_abcdef123456',
        preferences: {
          databaseUrl: 'postgresql://user:password@localhost:5432/db',
          smtp: {
            host: 'smtp.gmail.com',
            user: 'user@example.com',
            password: 'super-secret-password',
          },
        },
      },
      null,
      2,
    ),
    '/project/.mcp.json': JSON.stringify(
      {
        mcpServers: {
          database: {
            command: 'node',
            args: ['db-server.js'],
            env: {
              DB_PASSWORD: 'secret123',
              API_KEY: 'key_1234567890',
              AWS_SECRET_ACCESS_KEY: 'aws-secret-key',
            },
          },
        },
      },
      null,
      2,
    ),
    '/project/CLAUDE.local.md': `# Local Setup

Database password: mySecretPass123
API Key: sk-proj-1234567890
GitHub Token: ghp_personalToken123

Don't commit this file!`,
  },
};

// ============================================================================
// Large Project Structure (Performance Testing)
// ============================================================================

export function generateLargeProjectStructure(): MockFileSystemConfig {
  const files: Record<string, string> = {};
  const directories: string[] = [
    '/project',
    '/project/.claude',
    '/project/.claude/agents',
    '/project/.claude/commands',
    '/project/.claude/steering',
    '/project/.claude/hooks',
  ];

  // Generate many agent files
  for (let i = 0; i < 50; i++) {
    files[`/project/.claude/agents/agent-${i}.json`] = JSON.stringify(
      {
        name: `Agent ${i}`,
        description: `Test agent number ${i}`,
        instructions: `Instructions for agent ${i}`.repeat(10),
      },
      null,
      2,
    );
  }

  // Generate many command files
  for (let i = 0; i < 30; i++) {
    files[`/project/.claude/commands/command-${i}.json`] = JSON.stringify(
      {
        name: `command-${i}`,
        description: `Command number ${i}`,
        command: `npm run task-${i}`,
        args: [`--option-${i}`],
      },
      null,
      2,
    );
  }

  // Generate many steering files
  for (let i = 0; i < 20; i++) {
    files[`/project/.claude/steering/rule-${i}.md`] =
      `# Rule ${i}\n\n${'Content '.repeat(100)}`;
  }

  // Add standard files
  files['/project/.claude/settings.json'] = JSON.stringify(
    validClaudeCodeSettings,
    null,
    2,
  );
  files['/project/CLAUDE.md'] = claudeMdContent.repeat(5); // Large content
  files['/project/.mcp.json'] = JSON.stringify(validMcpConfig, null, 2);

  return { directories, files };
}

// ============================================================================
// Mixed Valid and Invalid Structure
// ============================================================================

export const mixedValidityStructure: MockFileSystemConfig = {
  directories: [
    '/project',
    '/project/.claude',
    '/project/.claude/agents',
    '/project/.claude/commands',
  ],
  files: {
    // Valid files
    '/project/.claude/settings.json': JSON.stringify(
      validClaudeCodeSettings,
      null,
      2,
    ),
    '/project/.claude/agents/valid.json': JSON.stringify(
      validClaudeAgent,
      null,
      2,
    ),

    // Invalid files
    '/project/.claude/agents/invalid.json': 'not json',
    '/project/.claude/commands/broken.json': '{ broken: json }',

    // Files with sensitive data
    '/project/.claude/commands/sensitive.json': JSON.stringify(
      {
        name: 'deploy',
        command: 'deploy.sh',
        args: ['--token', 'secret-token-123'],
      },
      null,
      2,
    ),

    // Valid but empty
    '/project/.claude/agents/empty.json': '{}',

    // Valid with minimal data
    '/project/.claude/commands/minimal.json': JSON.stringify(
      {
        name: 'test',
        description: 'Test',
        command: 'test',
      },
      null,
      2,
    ),
  },
};

// ============================================================================
// Helper Functions for File Structure Generation
// ============================================================================

export function createClaudeCodeFileStructure(
  options: {
    includeGlobal?: boolean;
    includeLocal?: boolean;
    includeSteering?: boolean;
    includeAgents?: boolean;
    includeCommands?: boolean;
    includeHooks?: boolean;
    includeMcp?: boolean;
    includeClaudeMd?: boolean;
    addSensitiveData?: boolean;
    addMalformedFiles?: boolean;
    basePath?: string;
    homePath?: string;
  } = {},
): MockFileSystemConfig {
  const {
    includeGlobal = true,
    includeLocal = true,
    includeSteering = true,
    includeAgents = true,
    includeCommands = true,
    includeHooks = true,
    includeMcp = true,
    includeClaudeMd = true,
    addSensitiveData = false,
    addMalformedFiles = false,
    basePath = '/project',
    homePath = '/home/user',
  } = options;

  const directories: string[] = [];
  const files: Record<string, string> = {};

  // Local project structure
  if (includeLocal) {
    directories.push(basePath, `${basePath}/.claude`);

    if (includeAgents) {
      directories.push(`${basePath}/.claude/agents`);
      files[`${basePath}/.claude/agents/agent1.json`] = JSON.stringify(
        validClaudeAgent,
        null,
        2,
      );
    }

    if (includeCommands) {
      directories.push(`${basePath}/.claude/commands`);
      files[`${basePath}/.claude/commands/cmd1.json`] = JSON.stringify(
        validClaudeCommand,
        null,
        2,
      );
    }

    if (includeHooks) {
      directories.push(`${basePath}/.claude/hooks`);
      files[`${basePath}/.claude/hooks/hook1.sh`] = '#!/bin/bash\necho "Hook"';
    }

    if (includeSteering) {
      directories.push(`${basePath}/.claude/steering`);
      files[`${basePath}/.claude/steering/principle.md`] =
        steeringFiles.principle;
    }

    files[`${basePath}/.claude/settings.json`] = JSON.stringify(
      addSensitiveData
        ? { ...validClaudeCodeSettings, apiKey: 'secret' }
        : validClaudeCodeSettings,
      null,
      2,
    );

    if (includeClaudeMd) {
      files[`${basePath}/CLAUDE.md`] = claudeMdContent;
      files[`${basePath}/CLAUDE.local.md`] = claudeLocalMdContent;
    }

    if (includeMcp) {
      files[`${basePath}/.mcp.json`] = addMalformedFiles
        ? '{ invalid json'
        : JSON.stringify(validMcpConfig, null, 2);
    }
  }

  // Global user structure
  if (includeGlobal) {
    directories.push(`${homePath}/.claude`);

    if (includeAgents) {
      directories.push(`${homePath}/.claude/agents`);
      files[`${homePath}/.claude/agents/global.json`] = JSON.stringify(
        {
          name: 'Global Agent',
          description: 'Global',
          instructions: 'Global instructions',
        },
        null,
        2,
      );
    }

    if (includeCommands) {
      directories.push(`${homePath}/.claude/commands`);
      files[`${homePath}/.claude/commands/global.json`] = JSON.stringify(
        {
          name: 'global-cmd',
          description: 'Global command',
          command: 'echo "global"',
        },
        null,
        2,
      );
    }

    files[`${homePath}/.claude/settings.json`] = JSON.stringify(
      {
        theme: 'dark',
        fontSize: 14,
      },
      null,
      2,
    );

    if (includeMcp) {
      files[`${homePath}/.mcp.json`] = JSON.stringify(
        {
          mcpServers: {
            global: {
              command: 'node',
              args: ['server.js'],
            },
          },
        },
        null,
        2,
      );
    }
  }

  return { directories, files };
}
