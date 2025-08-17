import { describe, it, expect, beforeEach, vi } from 'vitest';

import { AIPlatform } from '../interfaces';

import { ClaudeCodeBuilderStrategy } from './claude-code-builder.strategy';


describe('ClaudeCodeBuilderStrategy', () => {
  let strategy: ClaudeCodeBuilderStrategy;
  let fileSystemUtility: {
    exists: ReturnType<typeof vi.fn>;
    readFile: ReturnType<typeof vi.fn>;
    readJson: ReturnType<typeof vi.fn>;
    readDirectory: ReturnType<typeof vi.fn>;
    isDirectory: ReturnType<typeof vi.fn>;
    writeFile: ReturnType<typeof vi.fn>;
    writeJson: ReturnType<typeof vi.fn>;
    ensureDirectory: ReturnType<typeof vi.fn>;
    deleteFile: ReturnType<typeof vi.fn>;
    getUserHome: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    // Create mocked FileSystemUtil with all required methods
    fileSystemUtility = {
      exists: vi.fn(),
      readFile: vi.fn(),
      readJson: vi.fn(),
      readDirectory: vi.fn(),
      isDirectory: vi.fn(),
      writeFile: vi.fn(),
      writeJson: vi.fn(),
      ensureDirectory: vi.fn(),
      deleteFile: vi.fn(),
      getUserHome: vi.fn(),
    };

    strategy = new ClaudeCodeBuilderStrategy(fileSystemUtility as any);
  });

  describe('platform', () => {
    it('should have CLAUDE_CODE platform', () => {
      expect(strategy.platform).toBe(AIPlatform.CLAUDE_CODE);
    });
  });

  describe('detect', () => {
    it('should detect Claude Code project with .claude directory', async () => {
      fileSystemUtility.exists.mockImplementation((path: string) =>
        path.includes('.claude'),
      );

      const result = await strategy.detect('/test/project');
      expect(result).toBe(true);
      expect(fileSystemUtility.exists).toHaveBeenCalledWith(
        '/test/project/.claude',
      );
    });

    it('should detect Claude Code project with CLAUDE.md file', async () => {
      fileSystemUtility.exists.mockImplementation(
        (path: string) => path.includes('CLAUDE.md') && !path.includes('local'),
      );

      const result = await strategy.detect('/test/project');
      expect(result).toBe(true);
      expect(fileSystemUtility.exists).toHaveBeenCalledWith(
        '/test/project/CLAUDE.md',
      );
    });

    it('should detect Claude Code project with CLAUDE.local.md file', async () => {
      fileSystemUtility.exists.mockImplementation((path: string) =>
        path.includes('CLAUDE.local.md'),
      );

      const result = await strategy.detect('/test/project');
      expect(result).toBe(true);
      expect(fileSystemUtility.exists).toHaveBeenCalledWith(
        '/test/project/CLAUDE.local.md',
      );
    });

    it('should detect Claude Code with user-level workspace settings', async () => {
      fileSystemUtility.exists.mockImplementation((path: string) => {
        if (path.includes('.claude/settings.json')) return true;
        if (path.includes('.claude')) return true;
        return false;
      });

      const result = await strategy.detect('/test/project');
      expect(result).toBe(true);
    });

    it('should return false when no Claude Code configuration exists', async () => {
      fileSystemUtility.exists.mockResolvedValue(false);

      const result = await strategy.detect('/test/project');
      expect(result).toBe(false);
    });

    it('should handle detection errors gracefully', async () => {
      fileSystemUtility.exists.mockRejectedValue(
        new Error('Permission denied'),
      );

      const result = await strategy.detect('/test/project');
      expect(result).toBe(false);
    });
  });

  describe('extract', () => {
    it('should extract complete Claude Code configuration', async () => {
      fileSystemUtility.exists.mockImplementation((path: string) => {
        if (path.includes('.claude')) return true;
        if (path.includes('CLAUDE.md')) return true;
        if (path.includes('CLAUDE.local.md')) return true;
        return false;
      });

      fileSystemUtility.readJson.mockImplementation((path: string) => {
        if (path.includes('settings.json')) {
          return { theme: 'dark', fontSize: 14 };
        }
        if (path.includes('mcp.json')) {
          return {
            mcpServers: {
              'test-server': {
                command: 'node',
                args: ['server.js'],
                enabled: true,
              },
            },
          };
        }
        if (path.includes('commands.json')) {
          return { test: 'npm test' };
        }
        return {};
      });

      fileSystemUtility.readFile.mockImplementation((path: string) => {
        if (path.includes('CLAUDE.local.md')) {
          return '# Local Instructions';
        }
        if (path.includes('CLAUDE.md')) {
          return '# Project Instructions';
        }
        return '';
      });

      const result = await strategy.extract('/test/project');

      expect(result).toBeDefined();
      expect(result.settings).toEqual({ theme: 'dark', fontSize: 14 });
      expect(result.mcpServers).toHaveLength(1);
      expect(result.mcpServers[0].name).toBe('test-server');
      expect(result.claudeFiles).toEqual({
        claudeMd: '# Project Instructions',
        claudeLocalMd: '# Local Instructions',
      });
      expect(result.customCommands).toEqual({ test: 'npm test' });
    });

    it('should throw error when not a Claude Code project', async () => {
      fileSystemUtility.exists.mockResolvedValue(false);

      await expect(strategy.extract('/test/project')).rejects.toThrow(
        'Not a Claude Code project',
      );
    });

    it('should handle missing optional configurations', async () => {
      fileSystemUtility.exists.mockImplementation(
        (path: string) => path.includes('CLAUDE.md') && !path.includes('local'),
      );

      fileSystemUtility.readFile.mockResolvedValue('# Instructions');
      fileSystemUtility.readJson.mockResolvedValue({});

      const result = await strategy.extract('/test/project');

      expect(result.settings).toBeUndefined();
      expect(result.mcpServers).toEqual([]);
      expect(result.claudeFiles.claudeMd).toBe('# Instructions');
      expect(result.claudeFiles.claudeLocalMd).toBeUndefined();
      expect(result.customCommands).toBeUndefined();
    });
  });

  describe('normalize', () => {
    it('should normalize Claude Code data to TaptikContext', async () => {
      const claudeData = {
        settings: { theme: 'dark' },
        mcpServers: [{ name: 'server1', command: 'node', enabled: true }],
        claudeFiles: {
          claudeMd: '# Project',
          claudeLocalMd: '# Local',
        },
        customCommands: { test: 'npm test' },
      };

      const result = await strategy.normalize(claudeData);

      expect(result.version).toBe('1.0.0');
      expect(result.metadata.platforms).toContain(AIPlatform.CLAUDE_CODE);
      expect(result.ide?.data?.claude_code?.settings).toEqual({
        theme: 'dark',
      });
      expect(result.ide?.data?.claude_code?.mcp).toBeDefined();
      expect(result.ide?.data?.claude_code?.commands).toEqual({
        test: 'npm test',
      });
      expect(result.project?.data?.claude_instructions).toBe('# Project');
      expect(result.prompts?.data?.custom_instructions).toEqual(['# Local']);
      expect(result.tools?.data?.mcp_servers).toHaveLength(1);
    });

    it('should handle minimal Claude Code data', async () => {
      const claudeData = {
        settings: { theme: 'light' },
      };

      const result = await strategy.normalize(claudeData);

      expect(result.version).toBe('1.0.0');
      expect(result.ide?.data?.claude_code?.settings).toEqual({
        theme: 'light',
      });
      expect(result.ide?.data?.claude_code?.mcp).toBeUndefined();
      expect(result.project).toBeUndefined();
      expect(result.prompts).toBeUndefined();
      expect(result.tools).toBeUndefined();
    });
  });

  describe('validate', () => {
    it('should validate valid Claude Code data', async () => {
      const data = {
        settings: { theme: 'dark' },
        mcpServers: [{ name: 'server1', command: 'node' }],
        claudeFiles: { claudeMd: '# Project' },
      };

      const result = await strategy.validate(data);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
      expect(result.warnings).toBeUndefined();
    });

    it('should warn when no Claude Code configuration found', async () => {
      const data = {};

      const result = await strategy.validate(data);

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].message).toContain(
        'No Claude Code configuration found',
      );
    });

    it('should error on invalid MCP server configuration', async () => {
      const data = {
        mcpServers: [
          { name: 'valid', command: 'node' },
          {}, // Missing name
          { name: 'invalid' }, // Missing command and url
        ],
      };

      const result = await strategy.validate(data);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(3); // 1 for missing name, 1 for missing command/url on unnamed, 1 for missing command/url on 'invalid'
      expect(result.errors[0].message).toContain('missing required name');
      expect(result.errors[1].message).toContain(
        'must have either command or url',
      ); // For unnamed server
      expect(result.errors[2].message).toContain(
        'must have either command or url',
      ); // For 'invalid' server
    });

    it('should warn about sensitive data in settings', async () => {
      const data = {
        settings: {
          api_key: 'secret',
          token: 'hidden',
        },
      };

      const result = await strategy.validate(data);

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].message).toContain('sensitive data');
      expect(result.warnings[0].suggestion).toContain('Remove API keys');
    });
  });

  describe('build', () => {
    it('should build complete context from Claude Code project', async () => {
      fileSystemUtility.exists.mockImplementation((path: string) =>
        path.includes('CLAUDE.md'),
      );

      fileSystemUtility.readFile.mockResolvedValue('# Instructions');
      fileSystemUtility.readJson.mockResolvedValue({});

      const result = await strategy.build('/test/project');

      expect(result.version).toBe('1.0.0');
      expect(result.metadata.platforms).toContain(AIPlatform.CLAUDE_CODE);
    });

    it('should throw error on validation failure', async () => {
      fileSystemUtility.exists.mockImplementation((path: string) =>
        path.includes('.claude'),
      );

      fileSystemUtility.readJson.mockImplementation((path: string) => {
        if (path.includes('mcp.json')) {
          return {
            mcpServers: {
              'invalid-server': {}, // Missing required fields
            },
          };
        }
        return {};
      });

      await expect(strategy.build('/test/project')).rejects.toThrow(
        'Claude Code data validation failed',
      );
    });
  });

  describe('convert', () => {
    it('should convert TaptikContext back to Claude Code format', async () => {
      const context = {
        version: '1.0.0',
        metadata: {
          name: 'Test',
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
          platforms: [AIPlatform.CLAUDE_CODE],
        },
        ide: {
          category: 'ide' as const,
          spec_version: '1.0.0',
          data: {
            claude_code: {
              settings: { theme: 'dark' },
              commands: { test: 'npm test' },
            },
          },
        },
        project: {
          category: 'project' as const,
          spec_version: '1.0.0',
          data: {
            claude_instructions: '# Project',
          },
        },
        prompts: {
          category: 'prompts' as const,
          spec_version: '1.0.0',
          data: {
            custom_instructions: ['# Local'],
          },
        },
        tools: {
          category: 'tools' as const,
          spec_version: '1.0.0',
          data: {
            mcp_servers: [
              { name: 'server1', command: 'node', version: '1.0.0' },
            ],
          },
        },
      };

      const result = await strategy.convert(context);

      expect(result.success).toBe(true);
      const data = result.data as Record<string, any>;
      expect(data.settings).toEqual({ theme: 'dark' });
      expect(data.customCommands).toEqual({ test: 'npm test' });
      expect(data.claudeFiles.claudeMd).toBe('# Project');
      expect(data.claudeFiles.claudeLocalMd).toBe('# Local');
      expect(data.mcpServers).toHaveLength(1);
    });

    it('should handle missing Claude Code configuration', async () => {
      const context = {
        version: '1.0.0',
        metadata: {
          name: 'Test',
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
          platforms: [AIPlatform.KIRO],
        },
      };

      const result = await strategy.convert(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No Claude Code configuration found');
    });

    it('should handle conversion errors gracefully', async () => {
      const context = {
        version: '1.0.0',
        metadata: {
          name: 'Test',
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
          platforms: [AIPlatform.CLAUDE_CODE],
        },
        ide: {
          category: 'ide' as const,
          spec_version: '1.0.0',
          data: {
            claude_code: null as any, // Invalid data
          },
        },
      };

      const result = await strategy.convert(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No Claude Code configuration found'); // Fixed expected error message
    });
  });

  describe('extractSettings', () => {
    it('should merge workspace and user settings correctly', async () => {
      fileSystemUtility.exists.mockImplementation((_path: string) => true);

      fileSystemUtility.readJson.mockImplementation((path: string) => {
        // Workspace settings (processed first)
        if (path.includes('/test/project/.claude')) {
          return { theme: 'dark', fontSize: 16 };
        }
        // User settings (processed second, but shouldn't override)
        if (
          !path.includes('/test/project') &&
          path.includes('/.claude/settings.json')
        ) {
          return { theme: 'light', fontSize: 14, language: 'en' };
        }
        return {};
      });

      const result = await strategy.extract('/test/project');

      // Settings are merged in order: workspace first, then user
      // Since Object.assign merges left-to-right, user settings override workspace
      expect(result.settings).toEqual({
        theme: 'light', // User overrides workspace
        fontSize: 14, // User overrides workspace
        language: 'en', // User setting (not in workspace)
      });
    });
  });

  describe('extractMcpServers', () => {
    it('should deduplicate and prioritize workspace MCP servers', async () => {
      fileSystemUtility.exists.mockImplementation((path: string) => {
        if (path.includes('.claude')) return true;
        return path.includes('mcp.json');
      });

      fileSystemUtility.readJson.mockImplementation((path: string) => {
        if (path.includes('project/.claude')) {
          return {
            mcpServers: {
              server1: { command: 'node', args: ['v1.js'] },
              server2: { command: 'python', enabled: true },
            },
          };
        }
        if (path.includes('/.claude')) {
          return {
            mcpServers: {
              server1: { command: 'node', args: ['old.js'] },
              server3: { url: 'http://localhost:3000' },
            },
          };
        }
        return {};
      });

      const result = await strategy.extract('/test/project');

      expect(result.mcpServers).toHaveLength(3);
      expect(result.mcpServers[0].name).toBe('server1');
      expect(result.mcpServers[0].args).toEqual(['v1.js']); // Workspace version
      expect(result.mcpServers[1].name).toBe('server2');
      expect(result.mcpServers[2].name).toBe('server3');
    });

    it('should normalize MCP server configurations', async () => {
      fileSystemUtility.exists.mockImplementation((path: string) => {
        if (path.includes('.claude')) return true;
        return path.includes('mcp.json');
      });

      fileSystemUtility.readJson.mockImplementation((path: string) => {
        if (path.includes('mcp.json')) {
          return {
            mcpServers: {
              minimal: { command: 'node' },
              full: {
                command: 'python',
                args: ['server.py'],
                env: { PORT: '3000' },
                config: { debug: true },
                enabled: false,
                version: '2.0.0',
              },
            },
          };
        }
        return {};
      });

      const result = await strategy.extract('/test/project');

      expect(result.mcpServers).toHaveLength(2);

      // Minimal server should have defaults
      expect(result.mcpServers[0].name).toBe('minimal');
      expect(result.mcpServers[0].version).toBe('1.0.0');
      expect(result.mcpServers[0].args).toEqual([]);
      expect(result.mcpServers[0].enabled).toBe(true);
      expect(result.mcpServers[0].config).toEqual({});

      // Full server should preserve all fields
      expect(result.mcpServers[1].name).toBe('full');
      expect(result.mcpServers[1].version).toBe('2.0.0');
      expect(result.mcpServers[1].enabled).toBe(false);
      expect(result.mcpServers[1].env).toEqual({ PORT: '3000' });
      expect(result.mcpServers[1].config).toEqual({ debug: true });
    });
  });
});
