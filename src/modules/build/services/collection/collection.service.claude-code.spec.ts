/**
 * RED Phase Tests for Claude Code Collection Service
 * These tests are written first and will fail until implementation
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';

import { Test, TestingModule } from '@nestjs/testing';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CollectionService } from './collection.service';

import type {
  ClaudeCodeLocalSettingsData,
  ClaudeCodeGlobalSettingsData,
  McpServerConfig,
} from '../../interfaces/claude-code.interfaces';

// Mock os module
vi.mock('node:os', () => ({
  homedir: vi.fn(() => '/home/user')
}));

// Create spies at module level
const readFileSpy = vi.spyOn(fs, 'readFile');
const readdirSpy = vi.spyOn(fs, 'readdir');
const statSpy = vi.spyOn(fs, 'stat');
const accessSpy = vi.spyOn(fs, 'access');

// Mock object to group all fs spies
const mockFs = {
  readFile: readFileSpy,
  readdir: readdirSpy,
  stat: statSpy,
  access: accessSpy,
};

// Helper function to create mock Stats object
function createMockStats(isDir: boolean) {
  return {
    isFile: () => !isDir,
    isDirectory: () => isDir,
    isBlockDevice: () => false,
    isCharacterDevice: () => false,
    isSymbolicLink: () => false,
    isFIFO: () => false,
    isSocket: () => false,
    dev: 0,
    ino: 0,
    mode: 0,
    nlink: 0,
    uid: 0,
    gid: 0,
    rdev: 0,
    size: 0,
    blksize: 0,
    blocks: 0,
    atimeMs: 0,
    mtimeMs: 0,
    ctimeMs: 0,
    birthtimeMs: 0,
    atime: new Date(),
    mtime: new Date(),
    ctime: new Date(),
    birthtime: new Date(),
  };
}


describe('CollectionService - Claude Code Support (RED Phase)', () => {
  let service: CollectionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CollectionService],
    }).compile();

    service = module.get<CollectionService>(CollectionService);
    
    // Clear spies before each test
    readFileSpy.mockClear();
    readdirSpy.mockClear();
    statSpy.mockClear();
    accessSpy.mockClear();
  });


  describe('collectClaudeCodeLocalSettings()', () => {

    it('should collect settings from .claude directory', async () => {
      // Arrange
      const projectPath = '/project';

      accessSpy.mockResolvedValue(undefined);
      readdirSpy.mockImplementation((dir: string) => {
        if (dir === path.join(projectPath, '.claude')) {
          return Promise.resolve(['settings.json']);
        }
        if (dir === path.join(projectPath, '.claude', 'agents')) {
          return Promise.resolve(['agent1.json', 'agent2.json']);
        }
        if (dir === path.join(projectPath, '.claude', 'commands')) {
          return Promise.resolve(['cmd1.json']);
        }
        if (dir === path.join(projectPath, '.claude', 'steering')) {
          return Promise.resolve(['rule1.md', 'rule2.md']);
        }
        if (dir === path.join(projectPath, '.claude', 'hooks')) {
          return Promise.resolve(['pre-commit.sh']);
        }
        return Promise.resolve([]);
      });
      
      statSpy.mockImplementation((filePath: string) => {
        const isDir = filePath.endsWith('/agents') || filePath.endsWith('/commands') || 
                      filePath.endsWith('/steering') || filePath.endsWith('/hooks');
        return Promise.resolve(createMockStats(isDir));
      });

      // Set up individual mocks for each file
      readFileSpy
        .mockImplementation((filePath: string) => {
          if (filePath.includes('settings.json')) {
            return Promise.resolve(JSON.stringify({ theme: 'dark', fontSize: 14 }));
          }
          if (filePath.includes('agent1.json')) {
            return Promise.resolve(JSON.stringify({ name: 'Agent 1', description: 'Test', instructions: 'Do something' }));
          }
          if (filePath.includes('agent2.json')) {
            return Promise.resolve(JSON.stringify({ name: 'Agent 2', description: 'Test', instructions: 'Do something else' }));
          }
          if (filePath.includes('cmd1.json')) {
            return Promise.resolve(JSON.stringify({ name: 'test-cmd', description: 'Test command', command: 'npm test' }));
          }
          if (filePath.includes('.mcp.json')) {
            return Promise.resolve(JSON.stringify({ mcpServers: { filesystem: { command: 'node', args: ['./server.js'] } } }));
          }
          if (filePath.includes('CLAUDE.md')) {
            return Promise.resolve('# Claude Instructions');
          }
          if (filePath.includes('CLAUDE.local.md')) {
            return Promise.resolve('# Local Claude Instructions');
          }
          if (filePath.includes('rule1.md')) {
            return Promise.resolve('# Steering Rule 1');
          }
          if (filePath.includes('rule2.md')) {
            return Promise.resolve('# Steering Rule 2');
          }
          if (filePath.includes('pre-commit.sh')) {
            return Promise.resolve('#!/bin/bash\necho "pre-commit"');
          }
          return Promise.resolve('');
        });


      // Act
      const result: ClaudeCodeLocalSettingsData = await (service as any).collectClaudeCodeLocalSettings(projectPath);

      // Assert
      expect(result).toBeDefined();
      expect(result.settings).toEqual({ theme: 'dark', fontSize: 14 });
      expect(result.agents).toHaveLength(2);
      expect(result.agents[0].parsed?.name).toBe('Agent 1');
      expect(result.commands).toHaveLength(1);
      expect(result.commands[0].parsed?.name).toBe('test-cmd');
      expect(result.steeringFiles).toHaveLength(2);
      expect(result.hooks).toHaveLength(1);
      expect(result.claudeMd).toBe('# Claude Instructions');
      expect(result.claudeLocalMd).toBe('# Local Claude Instructions');
      expect(result.mcpConfig).toBeDefined();
      expect(result.sourcePath).toBe(projectPath);
      expect(result.collectedAt).toBeDefined();
    });

    it('should handle missing .claude directory gracefully', async () => {
      // Arrange
      const projectPath = '/project';
      mockFs.access.mockRejectedValue(new Error('ENOENT'));

      // Act
      const result: ClaudeCodeLocalSettingsData = await (service as any).collectClaudeCodeLocalSettings(projectPath);

      // Assert
      expect(result).toBeDefined();
      // Now returns default settings instead of undefined
      expect(result.settings).toEqual({
        theme: 'default'
      });
      expect(result.claudeMd).toBe('# Claude Code Configuration\n\nNo Claude Code configuration found. Using defaults.');
      expect(result.claudeLocalMd).toBe('');
      expect(result.agents).toEqual([]);
      expect(result.commands).toEqual([]);
      expect(result.steeringFiles).toEqual([]);
      expect(result.hooks).toEqual([]);
      expect(result.sourcePath).toBe(projectPath);
    });

    it('should handle malformed JSON files', async () => {
      // Arrange
      const projectPath = '/project';
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readdir.mockImplementation((dir: string) => {
        if (dir === path.join(projectPath, '.claude')) {
          return Promise.resolve(['settings.json']);
        }
        if (dir === path.join(projectPath, '.claude', 'agents')) {
          return Promise.resolve(['malformed.json']);
        }
        return Promise.resolve([]);
      });
      
      mockFs.stat.mockImplementation((filePath: string) => {
        const isDir = filePath.endsWith('/agents');
        return Promise.resolve(createMockStats(isDir));
      });

      mockFs.readFile.mockImplementation((filePath: string) => {
        if (filePath.includes('settings.json')) {
          return Promise.resolve('{ invalid json }');
        }
        if (filePath.includes('malformed.json')) {
          return Promise.resolve('not even json');
        }
        return Promise.resolve('');
      });

      // Act
      const result: ClaudeCodeLocalSettingsData = await (service as any).collectClaudeCodeLocalSettings(projectPath);

      // Assert
      expect(result).toBeDefined();
      expect(result.settings).toBeUndefined();
      expect(result.agents).toHaveLength(1);
      expect(result.agents[0].parsed).toBeUndefined();
      expect(result.agents[0].content).toBe('not even json');
    });

    it('should handle permission denied errors', async () => {
      // Arrange
      const projectPath = '/project';
      const permissionError = new Error('EACCES: permission denied');
      (permissionError as any).code = 'EACCES';
      
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readdir.mockImplementation((dir: string) => {
        if (dir === path.join(projectPath, '.claude', 'agents')) {
          throw permissionError;
        }
        if (dir === path.join(projectPath, '.claude')) {
          return Promise.resolve(['settings.json', 'agents']);
        }
        return Promise.resolve([]);
      });
      
      mockFs.stat.mockImplementation((filePath: string) => {
        const isDir = filePath.includes('agents');
        return Promise.resolve(createMockStats(isDir));
      });

      mockFs.readFile.mockImplementation((filePath: string) => {
        if (filePath.includes('settings.json')) {
          return Promise.resolve(JSON.stringify({ theme: 'dark' }));
        }
        return Promise.resolve('');
      });

      // Act
      const result: ClaudeCodeLocalSettingsData = await (service as any).collectClaudeCodeLocalSettings(projectPath);

      // Assert
      expect(result).toBeDefined();
      expect(result.settings).toEqual({ theme: 'dark' });
      expect(result.agents).toEqual([]);
    });
  });

  describe('collectClaudeCodeGlobalSettings()', () => {
    it('should collect settings from ~/.claude directory', async () => {
      // Arrange
      const homePath = '/home/user';
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readdir.mockImplementation((dir: string) => {
        if (dir === path.join(homePath, '.claude')) {
          return Promise.resolve(['settings.json']);
        }
        if (dir === path.join(homePath, '.claude', 'agents')) {
          return Promise.resolve(['global-agent.json']);
        }
        if (dir === path.join(homePath, '.claude', 'commands')) {
          return Promise.resolve(['global-cmd.json']);
        }
        return Promise.resolve([]);
      });
      
      mockFs.stat.mockImplementation((filePath: string) => {
        const isDir = filePath.includes('agents') || filePath.includes('commands');
        return Promise.resolve(createMockStats(isDir));
      });

      mockFs.readFile.mockImplementation((filePath: string) => {
        if (filePath.includes('settings.json')) {
          return Promise.resolve(JSON.stringify({ theme: 'light', apiKey: 'secret' }));
        }
        if (filePath.includes('global-agent.json')) {
          return Promise.resolve(JSON.stringify({ name: 'Global Agent', description: 'Global', instructions: 'Global instructions' }));
        }
        if (filePath.includes('global-cmd.json')) {
          return Promise.resolve(JSON.stringify({ name: 'global-cmd', description: 'Global command', command: 'echo global' }));
        }
        if (filePath.includes('.mcp.json')) {
          return Promise.resolve(JSON.stringify({ mcpServers: { github: { command: 'python', args: ['./github.py'] } } }));
        }
        return Promise.resolve('');
      });

      // Act
      const result: ClaudeCodeGlobalSettingsData = await (service as any).collectClaudeCodeGlobalSettings();

      // Assert
      expect(result).toBeDefined();
      expect(result.settings).toBeDefined();
      expect(result.settings?.theme).toBe('light');
      expect((result.settings as any)?.apiKey).toBeUndefined(); // Should be filtered
      expect(result.agents).toHaveLength(1);
      expect(result.agents[0].parsed?.name).toBe('Global Agent');
      expect(result.commands).toHaveLength(1);
      expect(result.mcpConfig).toBeDefined();
      expect(result.sourcePath).toBe(path.join(homePath, '.claude'));
      expect(result.securityFiltered).toBe(true);
    });

    it('should handle missing global .claude directory', async () => {
      // Arrange
      mockFs.access.mockRejectedValue(new Error('ENOENT'));

      // Act
      const result: ClaudeCodeGlobalSettingsData = await (service as any).collectClaudeCodeGlobalSettings();

      // Assert
      expect(result).toBeDefined();
      expect(result.settings).toBeUndefined();
      expect(result.agents).toEqual([]);
      expect(result.commands).toEqual([]);
      expect(result.securityFiltered).toBe(true);
    });
  });

  describe('parseMcpConfig()', () => {
    it('should parse valid MCP configuration', async () => {
      // Arrange
      const mcpConfig = {
        mcpServers: {
          filesystem: {
            command: 'node',
            args: ['./fs-server.js'],
            env: { NODE_ENV: 'production' },
            autoApprove: ['read', 'write']
          },
          github: {
            command: 'python',
            args: ['./github-server.py'],
            disabled: true
          }
        }
      };
      
      const configContent = JSON.stringify(mcpConfig);

      // Act
      const result: McpServerConfig | undefined = (service as any).parseMcpConfig(configContent);

      // Assert
      expect(result).toBeDefined();
      expect(result?.mcpServers).toBeDefined();
      expect(result?.mcpServers.filesystem.command).toBe('node');
      expect(result?.mcpServers.filesystem.autoApprove).toContain('read');
      expect(result?.mcpServers.github.disabled).toBe(true);
    });

    it('should return undefined for invalid MCP configuration', async () => {
      // Arrange
      const invalidContent = '{ invalid json }';

      // Act
      const result: McpServerConfig | undefined = (service as any).parseMcpConfig(invalidContent);

      // Assert
      expect(result).toBeUndefined();
    });

    it('should return undefined for missing MCP configuration', async () => {
      // Arrange - parseMcpConfig expects content, not file path
      // This test simulates what would happen with empty or missing content
      const emptyContent = '';

      // Act
      const result: McpServerConfig | undefined = (service as any).parseMcpConfig(emptyContent);

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe('parseClaudeAgents()', () => {
    it('should parse valid agent files', async () => {
      // Arrange
      const agentsDir = '/project/.claude/agents';
      const agentFiles = ['agent1.json', 'agent2.json', 'invalid.json'];
      
      mockFs.readdir.mockResolvedValue(agentFiles as any);
      mockFs.stat.mockResolvedValue(createMockStats(false) as any);
      mockFs.readFile.mockImplementation((filePath: string) => {
        if (filePath.includes('agent1.json')) {
          return Promise.resolve(JSON.stringify({
            name: 'Code Reviewer',
            description: 'Reviews code',
            instructions: 'Review the code for best practices',
            tools: ['read', 'write']
          }));
        }
        if (filePath.includes('agent2.json')) {
          return Promise.resolve(JSON.stringify({
            name: 'Test Generator',
            description: 'Generates tests',
            instructions: 'Generate comprehensive tests'
          }));
        }
        if (filePath.includes('invalid.json')) {
          return Promise.resolve('not json');
        }
        return Promise.resolve('');
      });

      // Act
      const result = await (service as any).parseClaudeAgents(agentsDir);

      // Assert
      expect(result).toHaveLength(3);
      expect(result[0].parsed).toBeDefined();
      expect(result[0].parsed?.name).toBe('Code Reviewer');
      expect(result[0].parsed?.tools).toContain('read');
      expect(result[1].parsed?.name).toBe('Test Generator');
      expect(result[2].parsed).toBeUndefined(); // Invalid JSON
      expect(result[2].content).toBe('not json');
    });

    it('should handle empty agents directory', async () => {
      // Arrange
      const agentsDir = '/project/.claude/agents';
      mockFs.readdir.mockResolvedValue([]);

      // Act
      const result = await (service as any).parseClaudeAgents(agentsDir);

      // Assert
      expect(result).toEqual([]);
    });

    it('should handle non-existent agents directory', async () => {
      // Arrange
      const agentsDir = '/project/.claude/agents';
      mockFs.readdir.mockRejectedValue(new Error('ENOENT'));

      // Act
      const result = await (service as any).parseClaudeAgents(agentsDir);

      // Assert
      expect(result).toEqual([]);
    });

    it('should filter out non-JSON files', async () => {
      // Arrange
      const agentsDir = '/project/.claude/agents';
      const files = ['agent.json', 'README.md', '.DS_Store'];
      
      mockFs.readdir.mockResolvedValue(files as any);
      mockFs.stat.mockResolvedValue(createMockStats(false) as any);
      mockFs.readFile.mockImplementation((filePath: string) => {
        if (filePath.includes('agent.json')) {
          return Promise.resolve(JSON.stringify({
            name: 'Agent',
            description: 'Test agent',
            instructions: 'Do something'
          }));
        }
        return Promise.resolve('');
      });

      // Act
      const result = await (service as any).parseClaudeAgents(agentsDir);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].filename).toBe('agent.json');
    });
  });

  describe('parseClaudeCommands()', () => {
    it('should parse valid command files', async () => {
      // Arrange
      const commandsDir = '/project/.claude/commands';
      const commandFiles = ['cmd1.json', 'cmd2.json'];
      
      mockFs.readdir.mockResolvedValue(commandFiles as any);
      mockFs.stat.mockResolvedValue(createMockStats(false) as any);
      mockFs.readFile.mockImplementation((filePath: string) => {
        if (filePath.includes('cmd1.json')) {
          return Promise.resolve(JSON.stringify({
            name: 'format-code',
            description: 'Format code with prettier',
            command: 'prettier',
            args: ['--write', '.']
          }));
        }
        if (filePath.includes('cmd2.json')) {
          return Promise.resolve(JSON.stringify({
            name: 'run-tests',
            description: 'Run test suite',
            command: 'npm',
            args: ['test']
          }));
        }
        return Promise.resolve('');
      });

      // Act
      const result = await (service as any).parseClaudeCommands(commandsDir);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].parsed).toBeDefined();
      expect(result[0].parsed?.name).toBe('format-code');
      expect(result[0].parsed?.args).toContain('--write');
      expect(result[1].parsed?.name).toBe('run-tests');
    });

    it('should handle commands with metadata', async () => {
      // Arrange
      const commandsDir = '/project/.claude/commands';
      mockFs.readdir.mockResolvedValue(['advanced.json'] as any);
      mockFs.stat.mockResolvedValue(createMockStats(false) as any);
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        name: 'deploy',
        description: 'Deploy to production',
        command: 'npm',
        args: ['run', 'deploy'],
        metadata: {
          requiresConfirmation: true,
          environment: 'production'
        }
      }));

      // Act
      const result = await (service as any).parseClaudeCommands(commandsDir);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].parsed?.metadata).toBeDefined();
      expect(result[0].parsed?.metadata?.requiresConfirmation).toBe(true);
    });
  });

  describe('Error handling scenarios', () => {
    it('should handle file read errors gracefully', async () => {
      // Arrange
      const projectPath = '/project';
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readdir.mockImplementation((dir: string) => {
        if (dir === path.join(projectPath, '.claude')) {
          return Promise.resolve(['settings.json']);
        }
        return Promise.resolve([]);
      });
      
      const readError = new Error('EACCES: permission denied');
      (readError as any).code = 'EACCES';
      mockFs.readFile.mockRejectedValue(readError);

      // Act
      const result: ClaudeCodeLocalSettingsData = await (service as any).collectClaudeCodeLocalSettings(projectPath);

      // Assert
      expect(result).toBeDefined();
      expect(result.settings).toBeUndefined();
    });

    it('should handle deeply nested directory structures', async () => {
      // Arrange
      const projectPath = '/project';
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readdir.mockImplementation((dir: string) => {
        if (dir === path.join(projectPath, '.claude')) {
          return Promise.resolve(['agents']);
        }
        if (dir === path.join(projectPath, '.claude', 'agents')) {
          return Promise.resolve(['category1']);
        }
        if (dir === path.join(projectPath, '.claude', 'agents', 'category1')) {
          return Promise.resolve(['agent.json']);
        }
        return Promise.resolve([]);
      });
      
      mockFs.stat.mockImplementation((filePath: string) => {
        const isDir = filePath.includes('category1') && !filePath.endsWith('.json');
        return Promise.resolve(createMockStats(isDir));
      });

      mockFs.readFile.mockResolvedValue(JSON.stringify({
        name: 'Nested Agent',
        description: 'Agent in nested directory',
        instructions: 'Handle nested structure'
      }));

      // Act
      const result: ClaudeCodeLocalSettingsData = await (service as any).collectClaudeCodeLocalSettings(projectPath);

      // Assert
      expect(result).toBeDefined();
      expect(result.agents).toHaveLength(1);
      expect(result.agents[0].parsed?.name).toBe('Nested Agent');
    });

    it('should handle concurrent file operations', async () => {
      // Arrange
      const projectPath = '/project';
      let callCount = 0;
      
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readdir.mockImplementation(async (dir: string) => {
        // Simulate async delay
        await new Promise(resolve => setTimeout(resolve, 1));
        
        if (dir === path.join(projectPath, '.claude')) {
          return ['agents', 'commands'] as any;
        }
        if (dir.includes('agents')) {
          return ['agent1.json', 'agent2.json', 'agent3.json'] as any;
        }
        if (dir.includes('commands')) {
          return ['cmd1.json', 'cmd2.json'] as any;
        }
        return [] as any;
      });
      
      mockFs.stat.mockImplementation((filePath: string) => {
        const isDir = filePath.endsWith('/agents') || filePath.endsWith('/commands');
        return Promise.resolve(createMockStats(isDir));
      });

      mockFs.readFile.mockImplementation(async () => {
        callCount++;
        await new Promise(resolve => setTimeout(resolve, 1));
        return JSON.stringify({
          name: `Item ${callCount}`,
          description: 'Test',
          instructions: 'Test'
        });
      });

      // Act
      const result: ClaudeCodeLocalSettingsData = await (service as any).collectClaudeCodeLocalSettings(projectPath);

      // Assert
      expect(result).toBeDefined();
      expect(result.agents).toHaveLength(3);
      expect(result.commands).toHaveLength(2);
      expect(callCount).toBeGreaterThanOrEqual(5);
    });
  });
});