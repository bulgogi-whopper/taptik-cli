import { Test, TestingModule } from '@nestjs/testing';

import { describe, it, expect, beforeEach } from 'vitest';

import { HelpDocumentationService, HelpContent, ComponentHelp, ErrorDocumentation } from './help-documentation.service';

describe('HelpDocumentationService', () => {
  let service: HelpDocumentationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HelpDocumentationService],
    }).compile();

    service = module.get<HelpDocumentationService>(HelpDocumentationService);
  });

  describe('getDeployCommandHelp', () => {
    it('should return comprehensive deploy command help', () => {
      const help = service.getDeployCommandHelp();

      expect(help).toBeDefined();
      expect(help.title).toBe('Deploy Command');
      expect(help.description).toContain('Deploy Taptik context to target platforms');
      expect(help.usage).toBe('taptik deploy [options]');
      expect(help.examples).toHaveLength(5);
      expect(help.options.length).toBeGreaterThan(10);
    });

    it('should include all platform options', () => {
      const help = service.getDeployCommandHelp();
      
      const platformOption = help.options.find(opt => opt.flag.includes('--platform'));
      expect(platformOption).toBeDefined();
      expect(platformOption!.description).toContain('claude-code');
      expect(platformOption!.description).toContain('kiro-ide');
      expect(platformOption!.description).toContain('cursor-ide');
    });

    it('should include Cursor-specific options', () => {
      const help = service.getDeployCommandHelp();
      
      const cursorOptions = help.options.filter(opt => 
        opt.platforms && opt.platforms.includes('cursor-ide')
      );
      
      expect(cursorOptions.length).toBeGreaterThan(0);
      expect(cursorOptions.some(opt => opt.flag.includes('--cursor-path'))).toBe(true);
      expect(cursorOptions.some(opt => opt.flag.includes('--workspace-path'))).toBe(true);
      expect(cursorOptions.some(opt => opt.flag.includes('--skip-ai-config'))).toBe(true);
    });

    it('should include useful examples', () => {
      const help = service.getDeployCommandHelp();
      
      expect(help.examples).toHaveLength(5);
      
      const cursorExample = help.examples.find(ex => 
        ex.command.includes('cursor-ide')
      );
      expect(cursorExample).toBeDefined();
      expect(cursorExample!.title).toContain('Cursor IDE');
      
      const dryRunExample = help.examples.find(ex => 
        ex.command.includes('--dry-run')
      );
      expect(dryRunExample).toBeDefined();
    });
  });

  describe('getPlatformHelp', () => {
    it('should return Cursor IDE help', () => {
      const help = service.getPlatformHelp('cursor-ide');

      expect(help).toBeDefined();
      expect(help.title).toBe('Cursor IDE Platform');
      expect(help.description).toContain('AI-powered development features');
      expect(help.usage).toBe('taptik deploy --platform cursor-ide [cursor-specific-options]');
    });

    it('should return Claude Code help', () => {
      const help = service.getPlatformHelp('claude-code');

      expect(help).toBeDefined();
      expect(help.title).toBe('Claude Code Platform');
      expect(help.description).toContain('Claude Code editor');
    });

    it('should return Kiro IDE help', () => {
      const help = service.getPlatformHelp('kiro-ide');

      expect(help).toBeDefined();
      expect(help.title).toBe('Kiro IDE Platform');
      expect(help.description).toContain('Kiro IDE development environment');
    });

    it('should throw error for unknown platform', () => {
      expect(() => {
        service.getPlatformHelp('unknown-platform' as any);
      }).toThrow('Unknown platform: unknown-platform');
    });
  });

  describe('getComponentHelp', () => {
    it('should return help for Cursor AI config component', () => {
      const help = service.getComponentHelp('ai-config', 'cursor-ide');

      expect(help).toBeDefined();
      expect(help!.name).toBe('ai-config');
      expect(help!.displayName).toBe('AI Configuration');
      expect(help!.platform).toBe('cursor-ide');
      expect(help!.configFiles).toContain('.cursorrules');
      expect(help!.examples.length).toBeGreaterThan(0);
      expect(help!.troubleshooting.length).toBeGreaterThan(0);
    });

    it('should return help for Cursor workspace settings', () => {
      const help = service.getComponentHelp('workspace-settings', 'cursor-ide');

      expect(help).toBeDefined();
      expect(help!.name).toBe('workspace-settings');
      expect(help!.displayName).toBe('Workspace Settings');
      expect(help!.platform).toBe('cursor-ide');
      expect(help!.configFiles).toContain('.cursor/settings.json');
    });

    it('should return null for non-existent component', () => {
      const help = service.getComponentHelp('non-existent', 'cursor-ide');

      expect(help).toBeNull();
    });

    it('should find component without specifying platform', () => {
      const help = service.getComponentHelp('ai-config');

      expect(help).toBeDefined();
      expect(help!.name).toBe('ai-config');
    });
  });

  describe('getErrorDocumentation', () => {
    it('should return documentation for CURSOR_NOT_FOUND error', () => {
      const error = service.getErrorDocumentation('CURSOR_NOT_FOUND');

      expect(error).toBeDefined();
      expect(error!.code).toBe('CURSOR_NOT_FOUND');
      expect(error!.title).toBe('Cursor IDE Not Found');
      expect(error!.commonCauses.length).toBeGreaterThan(0);
      expect(error!.solutions.length).toBeGreaterThan(0);
      expect(error!.prevention).toBeDefined();
      expect(error!.examples).toBeDefined();
    });

    it('should return documentation for AI_CONFIG_INVALID error', () => {
      const error = service.getErrorDocumentation('AI_CONFIG_INVALID');

      expect(error).toBeDefined();
      expect(error!.code).toBe('AI_CONFIG_INVALID');
      expect(error!.title).toBe('Invalid AI Configuration');
      expect(error!.solutions.length).toBeGreaterThan(0);
    });

    it('should return null for unknown error code', () => {
      const error = service.getErrorDocumentation('UNKNOWN_ERROR');

      expect(error).toBeNull();
    });
  });

  describe('validateComponentName', () => {
    it('should validate exact match for Cursor components', () => {
      const result = service.validateComponentName('ai-config', 'cursor-ide');

      expect(result.input).toBe('ai-config');
      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0].component).toBe('ai-config');
      expect(result.suggestions[0].confidence).toBe(1.0);
      expect(result.suggestions[0].reason).toBe('Exact match');
    });

    it('should suggest similar components for typos', () => {
      const result = service.validateComponentName('ai-confg', 'cursor-ide');

      expect(result.input).toBe('ai-confg');
      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.didYouMean).toBeDefined();
      expect(result.suggestions[0].confidence).toBeGreaterThan(0.3);
      expect(result.suggestions[0].confidence).toBeLessThan(1.0);
    });

    it('should provide examples for completely invalid components', () => {
      const result = service.validateComponentName('invalid-component', 'cursor-ide');

      expect(result.input).toBe('invalid-component');
      expect(result.examples).toBeDefined();
      expect(result.examples!.length).toBeGreaterThan(0);
    });

    it('should validate components for different platforms', () => {
      const cursorResult = service.validateComponentName('ai-config', 'cursor-ide');
      const claudeResult = service.validateComponentName('ai-config', 'claude-code');

      expect(cursorResult.suggestions[0].confidence).toBe(1.0);
      expect(claudeResult.suggestions.length).toBe(0);
    });
  });

  describe('getComponentSuggestions', () => {
    it('should return valid components for Cursor IDE', () => {
      const components = service.getComponentSuggestions('cursor-ide');

      expect(components).toContain('ai-config');
      expect(components).toContain('workspace-settings');
      expect(components).toContain('extensions');
      expect(components).toContain('debug-config');
      expect(components.length).toBeGreaterThan(5);
    });

    it('should return valid components for Claude Code', () => {
      const components = service.getComponentSuggestions('claude-code');

      expect(components).toContain('settings');
      expect(components).toContain('agents');
      expect(components).toContain('commands');
      expect(components).toContain('project');
    });

    it('should return valid components for Kiro IDE', () => {
      const components = service.getComponentSuggestions('kiro-ide');

      expect(components).toContain('settings');
      expect(components).toContain('steering');
      expect(components).toContain('specs');
      expect(components).toContain('hooks');
    });

    it('should return empty array for unknown platform', () => {
      const components = service.getComponentSuggestions('unknown' as any);

      expect(components).toEqual([]);
    });
  });

  describe('searchHelp', () => {
    it('should find relevant help content', () => {
      const results = service.searchHelp('cursor ai configuration');

      expect(results.length).toBeGreaterThan(0);
      
      const aiConfigResult = results.find(r => 
        r.title.toLowerCase().includes('ai') && r.title.toLowerCase().includes('config')
      );
      expect(aiConfigResult).toBeDefined();
      expect(aiConfigResult!.type).toBe('component');
      expect(aiConfigResult!.relevance).toBeGreaterThan(0.1);
    });

    it('should find error documentation', () => {
      const results = service.searchHelp('cursor not found');

      expect(results.length).toBeGreaterThan(0);
      
      const errorResult = results.find(r => r.type === 'error');
      expect(errorResult).toBeDefined();
      expect(errorResult!.relevance).toBeGreaterThan(0.1);
    });

    it('should return empty results for irrelevant queries', () => {
      const results = service.searchHelp('completely unrelated query xyz');

      expect(results.length).toBe(0);
    });

    it('should sort results by relevance', () => {
      const results = service.searchHelp('configuration');

      expect(results.length).toBeGreaterThan(1);
      
      // Check that results are sorted by relevance (descending)
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].relevance).toBeGreaterThanOrEqual(results[i + 1].relevance);
      }
    });
  });

  describe('formatHelpForConsole', () => {
    it('should format help content for console display', () => {
      const help = service.getDeployCommandHelp();
      const formatted = service.formatHelpForConsole(help);

      expect(formatted).toContain('📖 Deploy Command');
      expect(formatted).toContain('📋 USAGE:');
      expect(formatted).toContain('💡 EXAMPLES:');
      expect(formatted).toContain('⚙️  OPTIONS:');
      expect(formatted).toContain('📝 NOTES:');
      expect(formatted).toContain('🔗 SEE ALSO:');
    });

    it('should include all examples in formatted output', () => {
      const help = service.getDeployCommandHelp();
      const formatted = service.formatHelpForConsole(help);

      help.examples.forEach((example, index) => {
        expect(formatted).toContain(`${index + 1}. ${example.title}`);
        expect(formatted).toContain(example.command);
        expect(formatted).toContain(example.description);
      });
    });

    it('should include all options with platform information', () => {
      const help = service.getDeployCommandHelp();
      const formatted = service.formatHelpForConsole(help);

      const cursorOption = help.options.find(opt => opt.flag.includes('--cursor-path'));
      expect(formatted).toContain(cursorOption!.flag);
      expect(formatted).toContain('(cursor-ide)');
    });
  });

  describe('formatComponentHelpForConsole', () => {
    it('should format component help for console display', () => {
      const help = service.getComponentHelp('ai-config', 'cursor-ide');
      const formatted = service.formatComponentHelpForConsole(help!);

      expect(formatted).toContain('🧩 AI Configuration (cursor-ide)');
      expect(formatted).toContain('📁 CONFIGURATION FILES:');
      expect(formatted).toContain('.cursorrules');
      expect(formatted).toContain('💡 EXAMPLES:');
      expect(formatted).toContain('🔧 TROUBLESHOOTING:');
    });

    it('should include dependencies section when present', () => {
      // Create a component with dependencies for testing
      const helpWithDeps: ComponentHelp = {
        name: 'test-component',
        displayName: 'Test Component',
        description: 'Test component with dependencies',
        platform: 'cursor-ide',
        dependencies: ['workspace-settings', 'ai-config'],
        configFiles: ['test.json'],
        examples: [],
        troubleshooting: [],
      };

      const formatted = service.formatComponentHelpForConsole(helpWithDeps);

      expect(formatted).toContain('🔗 DEPENDENCIES:');
      expect(formatted).toContain('workspace-settings');
      expect(formatted).toContain('ai-config');
    });
  });

  describe('formatErrorDocumentationForConsole', () => {
    it('should format error documentation for console display', () => {
      const error = service.getErrorDocumentation('CURSOR_NOT_FOUND');
      const formatted = service.formatErrorDocumentationForConsole(error!);

      expect(formatted).toContain('🚨 Cursor IDE Not Found (CURSOR_NOT_FOUND)');
      expect(formatted).toContain('🔍 COMMON CAUSES:');
      expect(formatted).toContain('🛠️  SOLUTIONS:');
      expect(formatted).toContain('🛡️  PREVENTION:');
      expect(formatted).toContain('💡 EXAMPLES:');
      expect(formatted).toContain('🔗 RELATED ERRORS:');
    });

    it('should include all solutions with steps', () => {
      const error = service.getErrorDocumentation('CURSOR_NOT_FOUND');
      const formatted = service.formatErrorDocumentationForConsole(error!);

      error!.solutions.forEach((solution, index) => {
        expect(formatted).toContain(`${index + 1}. ${solution.title}`);
        solution.steps.forEach((step, stepIndex) => {
          expect(formatted).toContain(`${stepIndex + 1}. ${step}`);
        });
      });
    });
  });

  describe('initialization', () => {
    it('should initialize with component help data', () => {
      const cursorAiHelp = service.getComponentHelp('ai-config', 'cursor-ide');
      const cursorWorkspaceHelp = service.getComponentHelp('workspace-settings', 'cursor-ide');

      expect(cursorAiHelp).toBeDefined();
      expect(cursorWorkspaceHelp).toBeDefined();
    });

    it('should initialize with error documentation', () => {
      const cursorNotFoundError = service.getErrorDocumentation('CURSOR_NOT_FOUND');
      const aiConfigError = service.getErrorDocumentation('AI_CONFIG_INVALID');

      expect(cursorNotFoundError).toBeDefined();
      expect(aiConfigError).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle empty search queries', () => {
      const results = service.searchHelp('');

      expect(results).toEqual([]);
    });

    it('should handle special characters in component names', () => {
      const result = service.validateComponentName('ai-config@#$', 'cursor-ide');

      expect(result.input).toBe('ai-config@#$');
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('should handle case-insensitive component validation', () => {
      const lowerResult = service.validateComponentName('ai-config', 'cursor-ide');
      const upperResult = service.validateComponentName('AI-CONFIG', 'cursor-ide');

      expect(lowerResult.suggestions[0].confidence).toBe(1.0);
      expect(upperResult.suggestions.length).toBeGreaterThan(0);
    });
  });
});
