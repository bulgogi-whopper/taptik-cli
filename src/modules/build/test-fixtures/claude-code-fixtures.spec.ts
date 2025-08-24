/**
 * Tests for Claude Code test fixtures
 * Verifies that all fixtures are properly structured and usable
 */

import { describe, it, expect } from 'vitest';

import {
  isClaudeCodeSettings,
  isClaudeAgent,
  isClaudeCommand,
  isMcpServerConfig,
} from '../interfaces/claude-code.interfaces';

import {
  completeProjectStructure,
  minimalProjectStructure,
  createClaudeCodeFileStructure,
  CLAUDE_CODE_PATHS,
} from './claude-code-file-structures';
import {
  validClaudeCodeSettings,
  minimalClaudeCodeSettings,
  complexClaudeCodeSettings,
  validClaudeAgent,
  minimalClaudeAgent,
  complexClaudeAgent,
  validClaudeCommand,
  minimalClaudeCommand,
  complexClaudeCommand,
  validMcpConfig,
  minimalMcpConfig,
  completeClaudeCodeLocalSettings,
  completeClaudeCodeGlobalSettings,
} from './claude-code-fixtures';
import {
  malformedJsonExamples,
  invalidClaudeCodeSettings,
  invalidClaudeAgents,
  fileSystemErrors,
  edgeCaseFileContents,
  generateMalformedJson,
  validationTestCases,
} from './claude-code-malformed-fixtures';
import {
  ClaudeCodeSettingsBuilder,
  ClaudeAgentBuilder,
  TestScenarioFactory,
} from './claude-code-test-builders';

describe('Claude Code Test Fixtures', () => {
  describe('Valid Settings Fixtures', () => {
    it('should provide valid Claude Code settings', () => {
      expect(isClaudeCodeSettings(validClaudeCodeSettings)).toBe(true);
      expect(validClaudeCodeSettings.theme).toBeDefined();
      expect(validClaudeCodeSettings.fontSize).toBeGreaterThan(0);
    });

    it('should provide minimal settings', () => {
      expect(isClaudeCodeSettings(minimalClaudeCodeSettings)).toBe(true);
      expect(minimalClaudeCodeSettings.theme).toBeDefined();
    });

    it('should provide complex settings', () => {
      expect(isClaudeCodeSettings(complexClaudeCodeSettings)).toBe(true);
      expect(complexClaudeCodeSettings.preferences?.advanced).toBeDefined();
    });
  });

  describe('Agent Fixtures', () => {
    it('should provide valid agent configurations', () => {
      expect(isClaudeAgent(validClaudeAgent)).toBe(true);
      expect(validClaudeAgent.name).toBe('Code Reviewer');
      expect(validClaudeAgent.tools).toContain('read');
    });

    it('should provide minimal agent', () => {
      expect(isClaudeAgent(minimalClaudeAgent)).toBe(true);
      expect(minimalClaudeAgent.tools).toBeUndefined();
    });

    it('should provide complex agent', () => {
      expect(isClaudeAgent(complexClaudeAgent)).toBe(true);
      expect(complexClaudeAgent.tools?.length).toBeGreaterThan(5);
      expect(complexClaudeAgent.metadata?.version).toBeDefined();
    });
  });

  describe('Command Fixtures', () => {
    it('should provide valid command configurations', () => {
      expect(isClaudeCommand(validClaudeCommand)).toBe(true);
      expect(validClaudeCommand.name).toBe('format-code');
      expect(validClaudeCommand.args).toBeDefined();
    });

    it('should provide minimal command', () => {
      expect(isClaudeCommand(minimalClaudeCommand)).toBe(true);
      expect(minimalClaudeCommand.args).toBeUndefined();
    });

    it('should provide complex command', () => {
      expect(isClaudeCommand(complexClaudeCommand)).toBe(true);
      expect(complexClaudeCommand.metadata?.requiresConfirmation).toBe(true);
    });
  });

  describe('MCP Config Fixtures', () => {
    it('should provide valid MCP configurations', () => {
      expect(isMcpServerConfig(validMcpConfig)).toBe(true);
      expect(validMcpConfig.mcpServers.filesystem).toBeDefined();
      expect(validMcpConfig.mcpServers.github).toBeDefined();
    });

    it('should provide minimal MCP config', () => {
      expect(isMcpServerConfig(minimalMcpConfig)).toBe(true);
      expect(Object.keys(minimalMcpConfig.mcpServers).length).toBe(1);
    });
  });

  describe('Complete Settings Data', () => {
    it('should provide complete local settings', () => {
      expect(completeClaudeCodeLocalSettings.settings).toBeDefined();
      expect(completeClaudeCodeLocalSettings.agents.length).toBeGreaterThan(0);
      expect(completeClaudeCodeLocalSettings.commands.length).toBeGreaterThan(
        0,
      );
      expect(
        completeClaudeCodeLocalSettings.steeringFiles.length,
      ).toBeGreaterThan(0);
      expect(completeClaudeCodeLocalSettings.claudeMd).toBeDefined();
    });

    it('should provide complete global settings', () => {
      expect(completeClaudeCodeGlobalSettings.settings).toBeDefined();
      expect(completeClaudeCodeGlobalSettings.securityFiltered).toBe(true);
      expect(completeClaudeCodeGlobalSettings.agents.length).toBeGreaterThan(0);
    });
  });
});

describe('Claude Code File Structures', () => {
  describe('Project Structures', () => {
    it('should provide complete project structure', () => {
      expect(completeProjectStructure.directories.length).toBeGreaterThan(5);
      expect(
        Object.keys(completeProjectStructure.files).length,
      ).toBeGreaterThan(10);
      expect(
        completeProjectStructure.files['/project/.claude/settings.json'],
      ).toBeDefined();
    });

    it('should provide minimal project structure', () => {
      expect(minimalProjectStructure.directories.length).toBe(2);
      expect(Object.keys(minimalProjectStructure.files).length).toBe(2);
    });
  });

  describe('Dynamic Structure Generation', () => {
    it('should generate custom file structures', () => {
      const structure = createClaudeCodeFileStructure({
        includeGlobal: false,
        includeLocal: true,
        includeAgents: true,
        includeCommands: false,
      });

      expect(structure.directories).toContain('/project/.claude/agents');
      expect(structure.directories).not.toContain('/project/.claude/commands');
      expect(
        structure.files['/project/.claude/agents/agent1.json'],
      ).toBeDefined();
    });

    it('should handle sensitive data option', () => {
      const structure = createClaudeCodeFileStructure({
        addSensitiveData: true,
      });

      const settings = JSON.parse(
        structure.files['/project/.claude/settings.json'],
      );
      expect(settings.apiKey).toBe('secret');
    });
  });

  describe('Path Constants', () => {
    it('should provide correct path constants', () => {
      expect(CLAUDE_CODE_PATHS.LOCAL.BASE).toBe('.claude');
      expect(CLAUDE_CODE_PATHS.GLOBAL.BASE).toBe('~/.claude');
      expect(CLAUDE_CODE_PATHS.LOCAL.MCP_CONFIG).toBe('.mcp.json');
    });
  });
});

describe('Claude Code Test Builders', () => {
  describe('Settings Builder', () => {
    it('should build custom settings', () => {
      const settings = new ClaudeCodeSettingsBuilder()
        .withTheme('light')
        .withFontSize(16)
        .withKeyboardShortcut('cmd+s', 'save')
        .withExtension('prettier')
        .build();

      expect(settings.theme).toBe('light');
      expect(settings.fontSize).toBe(16);
      expect(settings.keyboardShortcuts?.['cmd+s']).toBe('save');
      expect(settings.extensions).toContain('prettier');
    });

    it('should build advanced settings', () => {
      const settings = new ClaudeCodeSettingsBuilder()
        .withAdvancedPreferences()
        .build();

      expect(settings.preferences?.autoSave).toBe(true);
      expect(settings.preferences?.terminal).toBeDefined();
    });
  });

  describe('Agent Builder', () => {
    it('should build custom agents', () => {
      const agent = new ClaudeAgentBuilder()
        .withName('Custom Agent')
        .withDescription('Test agent')
        .withInstructions('Do something')
        .withTools(['read', 'write'])
        .build();

      expect(agent.name).toBe('Custom Agent');
      expect(agent.tools).toContain('read');
    });

    it('should build preset agents', () => {
      const reviewer = new ClaudeAgentBuilder().asCodeReviewer().build();
      expect(reviewer.name).toBe('Code Reviewer');

      const testGen = new ClaudeAgentBuilder().asTestGenerator().build();
      expect(testGen.name).toBe('Test Generator');
    });
  });

  describe('Test Scenario Factory', () => {
    it('should create minimal scenario', () => {
      const scenario = TestScenarioFactory.createMinimalScenario();
      expect(scenario.settings).toBeDefined();
      expect(scenario.agent).toBeDefined();
      expect(scenario.command).toBeDefined();
    });

    it('should create complete scenario', () => {
      const scenario = TestScenarioFactory.createCompleteScenario();
      expect(scenario.metadata).toBeDefined();
      expect(scenario.sanitization).toBeDefined();
      expect(scenario.validation).toBeDefined();
    });

    it('should create performance scenario', () => {
      const scenario = TestScenarioFactory.createPerformanceScenario(50);
      expect(scenario.localSettings.agents.length).toBe(50);
      expect(scenario.metadata.component_summary.agents).toBe(50);
    });
  });
});

describe('Claude Code Malformed Fixtures', () => {
  describe('Malformed JSON', () => {
    it('should provide various malformed JSON examples', () => {
      expect(malformedJsonExamples.missingQuotes).toContain('name:');
      expect(malformedJsonExamples.unclosedBrace).not.toContain('}');
      expect(malformedJsonExamples.emptyString).toBe('');
    });

    it('should generate malformed JSON by type', () => {
      const malformed = generateMalformedJson('trailingComma');
      expect(malformed).toContain(',');
      expect(() => JSON.parse(malformed)).toThrow();
    });
  });

  describe('Invalid Settings', () => {
    it('should provide invalid settings examples', () => {
      expect(invalidClaudeCodeSettings.themeAsNumber.theme).toBe(123);
      expect(invalidClaudeCodeSettings.negativeFontSize.fontSize).toBeLessThan(
        0,
      );
      expect(invalidClaudeCodeSettings.scriptInjection.theme).toContain(
        '<script>',
      );
    });
  });

  describe('Invalid Agents', () => {
    it('should provide invalid agent examples', () => {
      expect(
        (invalidClaudeAgents.missingName as { name?: unknown }).name,
      ).toBeUndefined();
      expect(invalidClaudeAgents.nameAsNumber.name).toBe(12345);
      expect(
        invalidClaudeAgents.hugeInstructions.instructions.length,
      ).toBeGreaterThan(100000);
    });
  });

  describe('File System Errors', () => {
    it('should provide file system error examples', () => {
      expect(fileSystemErrors.eacces.message).toContain('permission denied');
      expect(fileSystemErrors.enoent.message).toContain('no such file');
      expect(fileSystemErrors.enospc.message).toContain('no space left');
    });
  });

  describe('Edge Case Contents', () => {
    it('should provide edge case file contents', () => {
      expect(edgeCaseFileContents.empty).toBe('');
      expect(edgeCaseFileContents.veryLarge.length).toBeGreaterThan(1000000);
      expect(edgeCaseFileContents.nullBytes).toContain('\x00');
      expect(edgeCaseFileContents.htmlInjection).toContain('onerror');
    });
  });

  describe('Validation Test Cases', () => {
    it('should provide categorized test cases', () => {
      expect(validationTestCases.shouldFail.length).toBeGreaterThan(0);
      expect(validationTestCases.shouldWarn.length).toBeGreaterThan(0);
      expect(validationTestCases.shouldPass.length).toBeGreaterThan(0);
    });
  });
});
