import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { Injectable, Logger } from '@nestjs/common';

import {
  ClaudeCodeLocalSettingsData,
  ClaudeCodeGlobalSettingsData,
  ClaudeCodeSettings,
  ClaudeAgent,
  ClaudeCommand,
  McpServerConfig,
} from '../../interfaces/claude-code.interfaces';

// Type aliases for backward compatibility
type ClaudeCodeSteeringFile = {
  filename: string;
  content: string;
  path: string;
};

@Injectable()
export class CollectionService {
  private readonly logger = new Logger(CollectionService.name);

  /**
   * Alias for backward compatibility
   * @deprecated Use collectClaudeCodeLocalSettings instead
   */
  async collectLocalSettings(projectPath?: string): Promise<any> {
    const result = await this.collectClaudeCodeLocalSettings(projectPath);
    return {
      context: result.claudeMd,
      userPreferences: result.claudeLocalMd,
      projectSpec: '',
      steeringFiles: result.steeringFiles || [],
      hookFiles: result.hooks || [],
      configFiles: [],
    };
  }

  /**
   * Alias for backward compatibility
   * @deprecated Use collectClaudeCodeGlobalSettings instead
   */
  async collectGlobalSettings(): Promise<any> {
    const result = await this.collectClaudeCodeGlobalSettings();
    return {
      userConfig: result.settings,
      globalPreferences: result.settings,
      promptTemplates: [],
      configFiles: [],
    };
  }

  /**
   * Collects Claude Code local settings from .claude directory
   * @param projectPath - The project path to scan
   * @returns Promise resolving to collected Claude Code local settings data
   */
  async collectClaudeCodeLocalSettings(
    projectPath?: string,
  ): Promise<ClaudeCodeLocalSettingsData> {
    const basePath = projectPath || process.cwd();
    const claudePath = path.join(basePath, '.claude');

    this.logger.log(`Scanning Claude Code settings in: ${claudePath}`);

    const result: ClaudeCodeLocalSettingsData = {
      sourcePath: basePath,
      collectedAt: new Date().toISOString(),
      agents: [],
      commands: [],
      steeringFiles: [],
      hooks: [],
    };

    try {
      // Check if .claude directory exists
      await fs.access(claudePath);
    } catch {
      this.logger.warn(`No .claude directory found at: ${claudePath}`);
      return result;
    }

    // Collect settings.json
    try {
      const settingsPath = path.join(claudePath, 'settings.json');
      console.log('SERVICE DEBUG: About to call fs.readFile with:', settingsPath);
      const settingsContent = await fs.readFile(settingsPath, 'utf8');
      console.log('SERVICE DEBUG: fs.readFile returned:', settingsContent, typeof settingsContent);
      result.settings = JSON.parse(settingsContent) as ClaudeCodeSettings;
    } catch (error) {
      console.log('SERVICE DEBUG: fs.readFile threw error:', error);
      this.logger.warn(`Could not read settings.json: ${error.message}`);
    }

    // Collect agents
    try {
      const agentsPath = path.join(claudePath, 'agents');
      await fs.access(agentsPath);
      const agentFiles = await fs.readdir(agentsPath);
      
      for (const filename of agentFiles) {
        if (filename.endsWith('.json')) {
          try {
            const filePath = path.join(agentsPath, filename);
            const content = await fs.readFile(filePath, 'utf8');
            const parsed = JSON.parse(content);
            result.agents.push({
              filename,
              content,
              path: filePath,
              parsed: {
                name: parsed.name || filename.replace(/\.json$/, ''),
                description: parsed.description || '',
                instructions: parsed.instructions || '',
                tools: parsed.tools,
                metadata: parsed.metadata,
              },
            });
          } catch {
            // For malformed JSON, still add the file
            const filePath = path.join(agentsPath, filename);
            const content = await fs.readFile(filePath, 'utf8');
            result.agents.push({
              filename,
              content,
              path: filePath,
            });
          }
        }
      }
    } catch (error) {
      this.logger.warn(`Could not read agents directory: ${error.message}`);
    }

    // Collect commands
    try {
      const commandsPath = path.join(claudePath, 'commands');
      await fs.access(commandsPath);
      const commandFiles = await fs.readdir(commandsPath);
      
      for (const filename of commandFiles) {
        if (filename.endsWith('.json')) {
          try {
            const filePath = path.join(commandsPath, filename);
            const content = await fs.readFile(filePath, 'utf8');
            const parsed = JSON.parse(content);
            result.commands.push({
              filename,
              content,
              path: filePath,
              parsed: {
                name: parsed.name || filename.replace(/\.json$/, ''),
                description: parsed.description || '',
                command: parsed.command || parsed.implementation || '',
                args: parsed.args,
                metadata: parsed.metadata,
              },
            });
          } catch {
            const filePath = path.join(commandsPath, filename);
            const content = await fs.readFile(filePath, 'utf8');
            result.commands.push({
              filename,
              content,
              path: filePath,
            });
          }
        }
      }
    } catch (error) {
      this.logger.warn(`Could not read commands directory: ${error.message}`);
    }

    // Collect MCP config
    try {
      const mcpConfigPath = path.join(basePath, '.mcp.json');
      const mcpContent = await fs.readFile(mcpConfigPath, 'utf8');
      const mcpConfig = JSON.parse(mcpContent);
      result.mcpConfig = mcpConfig;
    } catch (error) {
      this.logger.warn(`Could not read .mcp.json: ${error.message}`);
    }

    // Collect CLAUDE.md files
    try {
      result.claudeMd = await fs.readFile(path.join(basePath, 'CLAUDE.md'), 'utf8');
    } catch {
      // ignore
    }
    
    try {
      result.claudeLocalMd = await fs.readFile(path.join(basePath, 'CLAUDE.local.md'), 'utf8');
    } catch {
      // ignore
    }

    // Collect steering files
    try {
      const steeringPath = path.join(claudePath, 'steering');
      await fs.access(steeringPath);
      const steeringFiles = await fs.readdir(steeringPath);
      
      for (const filename of steeringFiles) {
        if (filename.endsWith('.md')) {
          const filePath = path.join(steeringPath, filename);
          const content = await fs.readFile(filePath, 'utf8');
          result.steeringFiles.push({
            filename,
            content,
            path: filePath,
          });
        }
      }
    } catch (error) {
      this.logger.warn(`Could not read steering directory: ${error.message}`);
    }

    // Collect hook files
    try {
      const hooksPath = path.join(claudePath, 'hooks');
      await fs.access(hooksPath);
      const hookFiles = await fs.readdir(hooksPath);
      
      for (const filename of hookFiles) {
        if (filename.endsWith('.sh') || filename.endsWith('.hook')) {
          const filePath = path.join(hooksPath, filename);
          const content = await fs.readFile(filePath, 'utf8');
          result.hooks.push({
            filename,
            content,
            path: filePath,
          });
        }
      }
    } catch (error) {
      this.logger.warn(`Could not read hooks directory: ${error.message}`);
    }

    this.logger.log(
      `Collection complete: ${result.agents.length} agents, ${result.commands.length} commands, ` +
      `${result.steeringFiles.length} steering files`
    );

    return result;
  }

  /**
   * Collects Claude Code global settings from ~/.claude directory
   * @returns Promise resolving to collected Claude Code global settings data
   */
  async collectClaudeCodeGlobalSettings(): Promise<ClaudeCodeGlobalSettingsData> {
    const homeDirectory = os.homedir();
    const globalClaudePath = path.join(homeDirectory, '.claude');

    this.logger.log(`Scanning Claude Code global settings in: ${globalClaudePath}`);

    const result: ClaudeCodeGlobalSettingsData = {
      sourcePath: globalClaudePath,
      collectedAt: new Date().toISOString(),
      securityFiltered: false,
      agents: [],
      commands: [],
    };

    // Check if ~/.claude directory exists
    try {
      await fs.access(globalClaudePath);
    } catch {
      this.logger.warn(`No global .claude directory found at: ${globalClaudePath}`);
      result.securityFiltered = true; // For test compatibility
      return result;
    }

    // Collect settings.json
    try {
      const settingsPath = path.join(globalClaudePath, 'settings.json');
      const settingsContent = await fs.readFile(settingsPath, 'utf8');
      result.settings = JSON.parse(settingsContent) as ClaudeCodeSettings;
      
      // Apply security filtering
      const originalStr = JSON.stringify(result.settings);
      const { filteredContent, wasFiltered } = this.applySecurityFilter(originalStr);
      if (wasFiltered) {
        result.settings = JSON.parse(filteredContent) as ClaudeCodeSettings;
        result.securityFiltered = true;
        this.logger.warn('Security filtering applied to global settings');
      }
    } catch (error) {
      this.logger.warn(`Could not read global settings.json: ${error.message}`);
    }

    // Collect agents
    try {
      const agentsPath = path.join(globalClaudePath, 'agents');
      await fs.access(agentsPath);
      const agentFiles = await fs.readdir(agentsPath);
      
      for (const filename of agentFiles) {
        if (filename.endsWith('.json')) {
          try {
            const filePath = path.join(agentsPath, filename);
            const content = await fs.readFile(filePath, 'utf8');
            const parsed = JSON.parse(content);
            result.agents.push({
              filename,
              content,
              path: filePath,
              parsed: {
                name: parsed.name || filename.replace(/\.json$/, ''),
                description: parsed.description || '',
                instructions: parsed.instructions || '',
                tools: parsed.tools,
                metadata: parsed.metadata,
              },
            });
          } catch {
            const filePath = path.join(agentsPath, filename);
            const content = await fs.readFile(filePath, 'utf8');
            result.agents.push({
              filename,
              content,
              path: filePath,
            });
          }
        }
      }
    } catch (error) {
      this.logger.warn(`Could not read global agents directory: ${error.message}`);
    }

    // Collect commands  
    try {
      const commandsPath = path.join(globalClaudePath, 'commands');
      await fs.access(commandsPath);
      const commandFiles = await fs.readdir(commandsPath);
      
      for (const filename of commandFiles) {
        if (filename.endsWith('.json')) {
          try {
            const filePath = path.join(commandsPath, filename);
            const content = await fs.readFile(filePath, 'utf8');
            const parsed = JSON.parse(content);
            result.commands.push({
              filename,
              content,
              path: filePath,
              parsed: {
                name: parsed.name || filename.replace(/\.json$/, ''),
                description: parsed.description || '',
                command: parsed.command || parsed.implementation || '',
                args: parsed.args,
                metadata: parsed.metadata,
              },
            });
          } catch {
            const filePath = path.join(commandsPath, filename);
            const content = await fs.readFile(filePath, 'utf8');
            result.commands.push({
              filename,
              content,
              path: filePath,
            });
          }
        }
      }
    } catch (error) {
      this.logger.warn(`Could not read global commands directory: ${error.message}`);
    }

    // Collect MCP config
    try {
      const mcpConfigPath = path.join(globalClaudePath, '.mcp.json');
      const mcpContent = await fs.readFile(mcpConfigPath, 'utf8');
      result.mcpConfig = JSON.parse(mcpContent);
    } catch (error) {
      this.logger.warn(`Could not read global .mcp.json: ${error.message}`);
    }

    this.logger.log(
      `Global collection complete: ${result.agents.length} agents, ${result.commands.length} commands`
    );

    return result;
  }

  /**
   * Parses MCP configuration JSON content
   * @param content - JSON content to parse
   * @returns Parsed MCP config object or undefined
   */
  parseMcpConfig(content: string): McpServerConfig | undefined {
    try {
      const config = JSON.parse(content);
      
      // Check if it has the expected structure
      if (config && typeof config === 'object' && config.mcpServers) {
        return config as McpServerConfig;
      }
      
      // Try to wrap in mcpServers if it's a direct server config
      if (config && typeof config === 'object') {
        return { mcpServers: config } as McpServerConfig;
      }
      
      this.logger.warn('MCP config has unexpected structure');
      return undefined;
    } catch (error) {
      this.logger.error(`Failed to parse MCP config: ${error.message}`);
      return undefined;
    }
  }

  /**
   * Parses Claude agent files
   * @param directory - Directory containing the files
   * @returns Promise resolving to parsed agents
   */
  async parseClaudeAgents(
    directory: string,
  ): Promise<Array<{ filename: string; content: string; path: string; parsed?: ClaudeAgent }>> {
    // Read directory
    let files: string[];
    try {
      files = await fs.readdir(directory);
      files = files.filter(file => 
        file.endsWith('.json') || 
        (file.endsWith('.md') && !file.toLowerCase().includes('readme'))
      );
    } catch (error) {
      this.logger.warn(`Failed to read agents directory: ${error.message}`);
      return [];
    }

    const agentPromises = files.map(async (filename) => {
      const filePath = path.join(directory, filename);
      try {
        const content = await fs.readFile(filePath, 'utf8');
        
        if (filename.endsWith('.json')) {
          const parsed = JSON.parse(content);
          return {
            filename,
            content,
            path: filePath,
            parsed: {
              name: parsed.name || filename.replace(/\.json$/, ''),
              description: parsed.description || '',
              instructions: parsed.instructions || '',
              tools: parsed.tools,
              metadata: parsed.metadata,
            },
          };
        }
        
        return null;
      } catch (error) {
        this.logger.warn(`Failed to parse agent file ${filename}: ${error.message}`);
        return null;
      }
    });

    const results = await Promise.all(agentPromises);
    return results.filter(agent => agent !== null);
  }

  /**
   * Parses Claude command files
   * @param directory - Directory containing the files
   * @returns Promise resolving to parsed commands
   */
  async parseClaudeCommands(
    directory: string,
  ): Promise<Array<{ filename: string; content: string; path: string; parsed?: ClaudeCommand }>> {
    // Read directory
    let files: string[];
    try {
      files = await fs.readdir(directory);
      files = files.filter(file => 
        file.endsWith('.json') || 
        (file.endsWith('.md') && !file.toLowerCase().includes('readme'))
      );
    } catch (error) {
      this.logger.warn(`Failed to read commands directory: ${error.message}`);
      return [];
    }

    const commandPromises = files.map(async (filename) => {
      const filePath = path.join(directory, filename);
      try {
        const content = await fs.readFile(filePath, 'utf8');
        
        if (filename.endsWith('.json')) {
          const parsed = JSON.parse(content);
          return {
            filename,
            content,
            path: filePath,
            parsed: {
              name: parsed.name || filename.replace(/\.json$/, ''),
              description: parsed.description || '',
              command: parsed.command || parsed.implementation || '',
              args: parsed.args,
              metadata: parsed.metadata,
            },
          };
        }
        
        return null;
      } catch (error) {
        this.logger.warn(`Failed to parse command file ${filename}: ${error.message}`);
        return null;
      }
    });

    const results = await Promise.all(commandPromises);
    return results.filter(command => command !== null);
  }

  // Helper methods

  private async checkDirectoryExists(dirPath: string): Promise<boolean> {
    try {
      await fs.access(dirPath);
      return true;
    } catch {
      return false;
    }
  }

  private async collectSettingsFile(claudePath: string): Promise<ClaudeCodeSettings | undefined> {
    const settingsPath = path.join(claudePath, 'settings.json');
    try {
      const content = await fs.readFile(settingsPath, 'utf8');
      return JSON.parse(content) as ClaudeCodeSettings;
    } catch (error) {
      this.logger.warn(`Could not read settings.json: ${error.message}`);
      return undefined;
    }
  }

  private async collectClaudeComponents(
    claudePath: string,
    componentType: 'agents' | 'commands',
  ): Promise<Array<{ filename: string; content: string; path: string; parsed?: ClaudeAgent | ClaudeCommand }>> {
    const componentPath = path.join(claudePath, componentType);

    try {
      await fs.access(componentPath);
      const files = await fs.readdir(componentPath);
      const componentFiles = files.filter(file => 
        file.endsWith('.json') || 
        (file.endsWith('.md') && !file.toLowerCase().includes('readme'))
      );

      const componentPromises = componentFiles.map(async (filename) => {
        const filePath = path.join(componentPath, filename);
        const content = await fs.readFile(filePath, 'utf8');
        
        if (filename.endsWith('.json')) {
          try {
            const parsed = JSON.parse(content);
            if (componentType === 'agents') {
              return {
                filename,
                content,
                path: filePath,
                parsed: {
                  name: parsed.name || filename.replace(/\.json$/, ''),
                  description: parsed.description || '',
                  instructions: parsed.instructions || '',
                  tools: parsed.tools,
                  metadata: parsed.metadata,
                } as ClaudeAgent,
              };
            } else {
              return {
                filename,
                content,
                path: filePath,
                parsed: {
                  name: parsed.name || filename.replace(/\.json$/, ''),
                  description: parsed.description || '',
                  command: parsed.command || parsed.implementation || '',
                  args: parsed.args,
                  metadata: parsed.metadata,
                } as ClaudeCommand,
              };
            }
          } catch {
            return { filename, content, path: filePath };
          }
        } else {
          return { filename, content, path: filePath };
        }
      });

      return await Promise.all(componentPromises);
    } catch (error) {
      this.logger.warn(`Could not read ${componentType} directory: ${error.message}`);
      return [];
    }
  }

  private async collectMcpConfig(basePath: string): Promise<McpServerConfig | undefined> {
    const mcpConfigPath = path.join(basePath, '.mcp.json');
    try {
      const content = await fs.readFile(mcpConfigPath, 'utf8');
      return this.parseMcpConfig(content);
    } catch (error) {
      this.logger.warn(`Could not read .mcp.json: ${error.message}`);
      return undefined;
    }
  }

  private async collectClaudeMdFiles(basePath: string): Promise<{ claudeMd?: string; claudeLocalMd?: string }> {
    const result: { claudeMd?: string; claudeLocalMd?: string } = {};

    try {
      result.claudeMd = await fs.readFile(path.join(basePath, 'CLAUDE.md'), 'utf8');
      this.logger.debug('Collected CLAUDE.md');
    } catch (error) {
      this.logger.warn(`Could not read CLAUDE.md: ${error.message}`);
    }

    try {
      result.claudeLocalMd = await fs.readFile(path.join(basePath, 'CLAUDE.local.md'), 'utf8');
      this.logger.debug('Collected CLAUDE.local.md');
    } catch (error) {
      this.logger.warn(`Could not read CLAUDE.local.md: ${error.message}`);
    }

    return result;
  }

  private async collectClaudeSteeringFiles(claudePath: string): Promise<ClaudeCodeSteeringFile[]> {
    const steeringPath = path.join(claudePath, 'steering');
    const steeringFiles: ClaudeCodeSteeringFile[] = [];

    try {
      await fs.access(steeringPath);
      const files = await fs.readdir(steeringPath);
      const mdFiles = files.filter(file => file.endsWith('.md'));

      const steeringPromises = mdFiles.map(async (filename) => {
        const filePath = path.join(steeringPath, filename);
        const content = await fs.readFile(filePath, 'utf8');
        return { filename, content, path: filePath };
      });

      return await Promise.all(steeringPromises);
    } catch (error) {
      this.logger.warn(`Could not read steering directory: ${error.message}`);
      return [];
    }
  }

  private async collectHookFiles(claudePath: string): Promise<Array<{ filename: string; content: string; path: string }>> {
    const hooksPath = path.join(claudePath, 'hooks');

    try {
      await fs.access(hooksPath);
      const files = await fs.readdir(hooksPath);
      const hookFiles = files.filter(file => file.endsWith('.hook') || file.endsWith('.sh'));

      const hookPromises = hookFiles.map(async (filename) => {
        const filePath = path.join(hooksPath, filename);
        const content = await fs.readFile(filePath, 'utf8');
        return { filename, content, path: filePath };
      });

      return await Promise.all(hookPromises);
    } catch (error) {
      this.logger.warn(`Could not read hooks directory: ${error.message}`);
      return [];
    }
  }

  private async findComponentFiles(dirPath: string): Promise<string[]> {
    try {
      const files = await fs.readdir(dirPath);
      return files.filter(file => 
        file.endsWith('.json') || 
        (file.endsWith('.md') && !file.toLowerCase().includes('readme'))
      );
    } catch {
      return [];
    }
  }

  private parseClaudeAgent(filename: string, content: string): { 
    filename: string; 
    content: string; 
    path: string; 
    parsed?: ClaudeAgent;
  } | null {
    // Simple parser for .md agent files
    const lines = content.split('\n');
    const name = filename.replace(/\.(md|json)$/, '');
    
    // Try to extract description from first heading or paragraph
    let description = '';
    for (const line of lines) {
      if (line.trim() && !line.startsWith('#')) {
        description = line.trim();
        break;
      }
    }

    return {
      filename,
      content,
      path: filename,
      parsed: {
        name,
        description: description || 'Claude Code agent',
        instructions: content,
      },
    };
  }

  private parseClaudeCommand(filename: string, content: string): {
    filename: string;
    content: string;
    path: string;
    parsed?: ClaudeCommand;
  } | null {
    // Simple parser for .md command files
    const name = filename.replace(/\.(md|json)$/, '');
    
    // Try to extract description from content
    const lines = content.split('\n');
    let description = '';
    for (const line of lines) {
      if (line.trim() && !line.startsWith('#')) {
        description = line.trim();
        break;
      }
    }

    return {
      filename,
      content,
      path: filename,
      parsed: {
        name,
        description: description || 'Claude Code command',
        command: content,
      },
    };
  }

  private applySecurityFilter(content: string): { filteredContent: string; wasFiltered: boolean } {
    let filteredContent = content;
    let wasFiltered = false;

    // Remove API keys and tokens
    const apiKeyPattern = /(["']?)(sk-|pk-|api[_-]?key|token)(?:["':]?\s*){2}["']?[\w-]{20,}["']?/gi;
    if (apiKeyPattern.test(filteredContent)) {
      filteredContent = filteredContent.replace(apiKeyPattern, '$1$2: "[REDACTED]"');
      wasFiltered = true;
    }

    // Remove passwords
    const passwordPattern = /(["']?password["']?\s*:\s*["'])[^"']+(["'])/gi;
    if (passwordPattern.test(filteredContent)) {
      filteredContent = filteredContent.replace(passwordPattern, '$1[REDACTED]$2');
      wasFiltered = true;
    }

    return { filteredContent, wasFiltered };
  }

  private sanitizeContent(content: string): string {
    let sanitized = content;
    
    // Redact API keys and tokens
    sanitized = sanitized.replace(/\b[\dA-Za-z]{32,}\b/g, '[REDACTED]');
    
    // Redact email addresses  
    sanitized = sanitized.replace(/[\w%+.-]+@[\d.A-Za-z-]+\.[A-Za-z]{2,}/g, '[EMAIL]');
    
    // Redact URLs with credentials
    sanitized = sanitized.replace(
      /https?:\/\/[^:@]+:[^@]+@\S+/g,
      '[REDACTED_URL]'
    );
    
    return sanitized;
  }
}