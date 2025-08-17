import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { AIPlatform } from '../interfaces';
import { FileSystemUtility } from '../utils/file-system.utility';

import { ClaudeCodeBuilderStrategy } from './claude-code-builder.strategy';

describe('ClaudeCodeBuilderStrategy Integration Tests', () => {
  let strategy: ClaudeCodeBuilderStrategy;
  let testDir: string;
  let fileSystem: FileSystemUtility;
  let originalHome: string;

  beforeEach(async () => {
    // Create a temporary test directory
    testDir = join(tmpdir(), `claude-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });

    // Save original HOME and set test directory as HOME for user-level configs
    originalHome = process.env.HOME || '';
    process.env.HOME = testDir;

    // Initialize real FileSystemUtil
    fileSystem = new FileSystemUtility();
    strategy = new ClaudeCodeBuilderStrategy(fileSystem);
  });

  afterEach(async () => {
    // Restore original HOME
    process.env.HOME = originalHome;

    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Real Claude Code Project Structure', () => {
    it('should extract complete Claude Code project with all configurations', async () => {
      // Create project directory
      const projectDir = join(testDir, 'project');
      await fs.mkdir(projectDir, { recursive: true });

      // Create .claude directory structure
      const claudeDir = join(projectDir, '.claude');
      await fs.mkdir(claudeDir, { recursive: true });

      // Create settings.json
      await fs.writeFile(
        join(claudeDir, 'settings.json'),
        JSON.stringify(
          {
            theme: 'dark',
            fontSize: 14,
            autoSave: true,
            tabSize: 2,
          },
          null,
          2,
        ),
      );

      // Create MCP configuration
      await fs.writeFile(
        join(claudeDir, 'mcp.json'),
        JSON.stringify(
          {
            mcpServers: {
              filesystem: {
                command: 'node',
                args: ['@modelcontextprotocol/server-filesystem/index.js'],
                env: {
                  ALLOWED_PATHS: '/Users/test',
                },
                enabled: true,
              },
              github: {
                command: 'npx',
                args: ['@modelcontextprotocol/server-github'],
                config: {
                  owner: 'test-org',
                  repo: 'test-repo',
                },
                enabled: true,
              },
            },
          },
          null,
          2,
        ),
      );

      // Create custom commands
      await fs.writeFile(
        join(claudeDir, 'commands.json'),
        JSON.stringify(
          {
            test: 'npm test',
            build: 'npm run build',
            lint: 'npm run lint',
          },
          null,
          2,
        ),
      );

      // Create CLAUDE.md
      await fs.writeFile(
        join(projectDir, 'CLAUDE.md'),
        `# Project Instructions

This is a test project for Claude Code.

## Key Features
- Feature 1
- Feature 2
- Feature 3

## Development Guidelines
Follow these guidelines when working with this codebase.`,
      );

      // Create CLAUDE.local.md
      await fs.writeFile(
        join(projectDir, 'CLAUDE.local.md'),
        `# Local Development Instructions

These are local-only instructions.

## Personal Preferences
- Use specific formatting
- Follow custom patterns`,
      );

      // Test detection
      const detected = await strategy.detect(projectDir);
      expect(detected).toBe(true);

      // Test extraction
      const extracted = await strategy.extract(projectDir);
      expect(extracted).toBeDefined();
      expect(extracted.settings).toBeDefined();
      expect(extracted.settings.theme).toBe('dark');
      expect(extracted.settings.fontSize).toBe(14);

      expect(extracted.mcpServers).toHaveLength(2);
      expect(extracted.mcpServers[0].name).toBe('filesystem');
      expect(extracted.mcpServers[0].command).toBe('node');
      expect(extracted.mcpServers[1].name).toBe('github');

      expect(extracted.customCommands).toBeDefined();
      expect(extracted.customCommands.test).toBe('npm test');
      expect(extracted.customCommands.build).toBe('npm run build');

      expect(extracted.claudeFiles).toBeDefined();
      expect(extracted.claudeFiles.claudeMd).toContain('Project Instructions');
      expect(extracted.claudeFiles.claudeLocalMd).toContain(
        'Local Development Instructions',
      );

      // Test normalization
      const context = await strategy.normalize(extracted);
      expect(context.version).toBe('1.0.0');
      expect(context.metadata.platforms).toContain(AIPlatform.CLAUDE_CODE);
      expect(context.ide?.data?.claude_code).toBeDefined();
      expect(context.project?.data?.claude_instructions).toContain(
        'Project Instructions',
      );
      expect(context.prompts?.data?.custom_instructions).toHaveLength(1);
      expect(context.tools?.data?.mcp_servers).toHaveLength(2);
    });

    it('should handle user-level and workspace-level MCP configurations', async () => {
      // Create user-level .claude directory
      const userClaudeDir = join(testDir, '.claude');
      await fs.mkdir(userClaudeDir, { recursive: true });

      // Create user-level MCP configuration
      await fs.writeFile(
        join(userClaudeDir, 'mcp.json'),
        JSON.stringify(
          {
            mcpServers: {
              'global-server': {
                command: 'node',
                args: ['global.js'],
                enabled: true,
              },
              'shared-server': {
                command: 'python',
                args: ['old.py'],
                enabled: false,
              },
            },
          },
          null,
          2,
        ),
      );

      // Create project directory
      const projectDir = join(testDir, 'project');
      const projectClaudeDir = join(projectDir, '.claude');
      await fs.mkdir(projectClaudeDir, { recursive: true });

      // Create workspace-level MCP configuration
      await fs.writeFile(
        join(projectClaudeDir, 'mcp.json'),
        JSON.stringify(
          {
            mcpServers: {
              'workspace-server': {
                command: 'deno',
                args: ['run', 'server.ts'],
                enabled: true,
              },
              'shared-server': {
                command: 'python3',
                args: ['new.py'],
                enabled: true,
              },
            },
          },
          null,
          2,
        ),
      );

      const extracted = await strategy.extract(projectDir);

      // Should have 3 servers: workspace-server, shared-server (workspace version), global-server
      expect(extracted.mcpServers).toHaveLength(3);

      const serverNames = extracted.mcpServers.map((s) => s.name);
      expect(serverNames).toContain('workspace-server');
      expect(serverNames).toContain('shared-server');
      expect(serverNames).toContain('global-server');

      // Verify workspace version of shared-server is used
      const sharedServer = extracted.mcpServers.find(
        (s) => s.name === 'shared-server',
      );
      expect(sharedServer.command).toBe('python3');
      expect(sharedServer.args).toEqual(['new.py']);
      expect(sharedServer.enabled).toBe(true);
    });

    it('should handle minimal Claude Code project with only CLAUDE.md', async () => {
      const projectDir = join(testDir, 'minimal');
      await fs.mkdir(projectDir, { recursive: true });

      // Create only CLAUDE.md
      await fs.writeFile(
        join(projectDir, 'CLAUDE.md'),
        '# Minimal Project\n\nThis is a minimal Claude Code project.',
      );

      // Should detect as Claude Code project
      const detected = await strategy.detect(projectDir);
      expect(detected).toBe(true);

      // Should extract minimal data
      const extracted = await strategy.extract(projectDir);
      expect(extracted.settings).toBeUndefined();
      expect(extracted.mcpServers).toEqual([]);
      expect(extracted.customCommands).toBeUndefined();
      expect(extracted.claudeFiles.claudeMd).toContain('Minimal Project');
      expect(extracted.claudeFiles.claudeLocalMd).toBeUndefined();

      // Should normalize to valid context
      const context = await strategy.normalize(extracted);
      expect(context.project?.data?.claude_instructions).toContain(
        'Minimal Project',
      );
      expect(context.prompts).toBeUndefined();
      expect(context.tools).toBeUndefined();
    });

    it('should validate and handle invalid MCP server configurations', async () => {
      const projectDir = join(testDir, 'invalid');
      const claudeDir = join(projectDir, '.claude');
      await fs.mkdir(claudeDir, { recursive: true });

      // Create MCP configuration with invalid servers
      await fs.writeFile(
        join(claudeDir, 'mcp.json'),
        JSON.stringify(
          {
            mcpServers: {
              'valid-server': {
                command: 'node',
                args: ['server.js'],
              },
              'invalid-server': {
                // Missing both command and url
              },
              '': {
                // Empty name
                command: 'python',
              },
            },
          },
          null,
          2,
        ),
      );

      const extracted = await strategy.extract(projectDir);
      const validation = await strategy.validate(extracted);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toBeDefined();
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should merge settings from user and workspace correctly', async () => {
      // Create user-level settings
      const userClaudeDir = join(testDir, '.claude');
      await fs.mkdir(userClaudeDir, { recursive: true });

      await fs.writeFile(
        join(userClaudeDir, 'settings.json'),
        JSON.stringify(
          {
            theme: 'light',
            fontSize: 12,
            language: 'en',
            userOnly: true,
          },
          null,
          2,
        ),
      );

      // Create workspace settings
      const projectDir = join(testDir, 'project');
      const projectClaudeDir = join(projectDir, '.claude');
      await fs.mkdir(projectClaudeDir, { recursive: true });

      await fs.writeFile(
        join(projectClaudeDir, 'settings.json'),
        JSON.stringify(
          {
            theme: 'dark',
            fontSize: 14,
            workspaceOnly: true,
          },
          null,
          2,
        ),
      );

      const extracted = await strategy.extract(projectDir);

      // User settings should override workspace for common fields
      expect(extracted.settings.theme).toBe('light');
      expect(extracted.settings.fontSize).toBe(12);
      expect(extracted.settings.language).toBe('en');
      expect(extracted.settings.userOnly).toBe(true);
      expect(extracted.settings.workspaceOnly).toBe(true);
    });

    it('should build complete context and convert back successfully', async () => {
      const projectDir = join(testDir, 'complete');
      const claudeDir = join(projectDir, '.claude');
      await fs.mkdir(claudeDir, { recursive: true });

      // Create complete Claude Code setup
      await fs.writeFile(
        join(claudeDir, 'settings.json'),
        JSON.stringify({ theme: 'dark' }, null, 2),
      );

      await fs.writeFile(
        join(claudeDir, 'mcp.json'),
        JSON.stringify(
          {
            mcpServers: {
              'test-server': {
                command: 'node',
                args: ['server.js'],
              },
            },
          },
          null,
          2,
        ),
      );

      await fs.writeFile(join(projectDir, 'CLAUDE.md'), '# Test Project');

      // Build complete context
      const context = await strategy.build(projectDir);
      expect(context).toBeDefined();
      expect(context.version).toBe('1.0.0');

      // Convert back to Claude Code format
      const converted = await strategy.convert(context);
      expect(converted.success).toBe(true);
      const convertedData = converted.data as Record<string, any>;
      expect(convertedData.settings).toEqual({ theme: 'dark' });
      expect(convertedData.mcpServers).toHaveLength(1);
      expect(convertedData.claudeFiles.claudeMd).toBe('# Test Project');
    });

    it('should handle missing directories gracefully', async () => {
      const projectDir = join(testDir, 'nonexistent');

      // Should not detect non-existent project
      const detected = await strategy.detect(projectDir);
      expect(detected).toBe(false);

      // Should throw error when trying to extract
      await expect(strategy.extract(projectDir)).rejects.toThrow(
        'Not a Claude Code project',
      );
    });

    it('should warn about sensitive data in settings', async () => {
      const projectDir = join(testDir, 'sensitive');
      const claudeDir = join(projectDir, '.claude');
      await fs.mkdir(claudeDir, { recursive: true });

      await fs.writeFile(
        join(claudeDir, 'settings.json'),
        JSON.stringify(
          {
            theme: 'dark',
            api_key: 'secret-key-123',
            apiKey: 'another-secret',
            token: 'auth-token',
          },
          null,
          2,
        ),
      );

      const extracted = await strategy.extract(projectDir);
      const validation = await strategy.validate(extracted);

      expect(validation.valid).toBe(true);
      expect(validation.warnings).toBeDefined();
      expect(validation.warnings.length).toBeGreaterThan(0);
      expect(validation.warnings[0].message).toContain('sensitive data');
    });
  });
});
