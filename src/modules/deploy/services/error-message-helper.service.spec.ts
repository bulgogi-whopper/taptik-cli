import { Test, TestingModule } from '@nestjs/testing';

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { DeploymentError } from '../interfaces/deployment-result.interface';
import { ErrorMessageHelperService, EnhancedError, ErrorAnalysis } from './error-message-helper.service';
import { HelpDocumentationService } from './help-documentation.service';

describe('ErrorMessageHelperService', () => {
  let service: ErrorMessageHelperService;
  let helpService: HelpDocumentationService;

  const mockError: DeploymentError = {
    component: 'cursor-deployment',
    type: 'platform-error',
    severity: 'high',
    message: 'Cursor IDE not found in PATH',
    suggestion: 'Install Cursor IDE or specify path with --cursor-path',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ErrorMessageHelperService,
        HelpDocumentationService,
      ],
    }).compile();

    service = module.get<ErrorMessageHelperService>(ErrorMessageHelperService);
    helpService = module.get<HelpDocumentationService>(HelpDocumentationService);
  });

  describe('enhanceError', () => {
    it('should enhance error with solutions and documentation', () => {
      const enhanced = service.enhanceError(mockError, 'cursor-ide');

      expect(enhanced.timestamp).toBeDefined();
      expect(enhanced.errorCode).toBeDefined();
      expect(enhanced.solutions).toBeDefined();
      expect(enhanced.solutions!.length).toBeGreaterThan(0);
      expect(enhanced.quickFix).toBeDefined();
    });

    it('should detect CURSOR_NOT_FOUND error code', () => {
      const cursorError: DeploymentError = {
        component: 'cursor-deployment',
        type: 'platform-error',
        severity: 'high',
        message: 'cursor not found',
        suggestion: 'Install Cursor',
      };

      const enhanced = service.enhanceError(cursorError, 'cursor-ide');

      expect(enhanced.errorCode).toBe('CURSOR_NOT_FOUND');
    });

    it('should detect PERMISSION_DENIED error code', () => {
      const permissionError: DeploymentError = {
        component: 'file-system',
        type: 'permission-error',
        severity: 'medium',
        message: 'Permission denied accessing workspace',
        suggestion: 'Check file permissions',
      };

      const enhanced = service.enhanceError(permissionError, 'cursor-ide');

      expect(enhanced.errorCode).toBe('PERMISSION_DENIED');
    });

    it('should detect AI_CONFIG_INVALID error code', () => {
      const aiError: DeploymentError = {
        component: 'ai-config',
        type: 'validation-error',
        severity: 'medium',
        message: 'AI config invalid format',
        suggestion: 'Check .cursorrules syntax',
      };

      const enhanced = service.enhanceError(aiError, 'cursor-ide');

      expect(enhanced.errorCode).toBe('AI_CONFIG_INVALID');
    });

    it('should provide generic solutions when no documentation found', () => {
      const unknownError: DeploymentError = {
        component: 'unknown',
        type: 'unknown-error',
        severity: 'medium',
        message: 'Something went wrong',
        suggestion: 'Try again',
      };

      const enhanced = service.enhanceError(unknownError, 'cursor-ide');

      expect(enhanced.solutions).toBeDefined();
      expect(enhanced.solutions!.length).toBeGreaterThan(0);
      expect(enhanced.quickFix).toBeDefined();
    });

    it('should include context in enhanced error', () => {
      const context = { workspacePath: '/test/workspace', platform: 'cursor-ide' };
      const enhanced = service.enhanceError(mockError, 'cursor-ide', context);

      expect(enhanced.context).toEqual(context);
    });
  });

  describe('analyzeError', () => {
    it('should categorize platform errors correctly', () => {
      const platformError: DeploymentError = {
        component: 'platform',
        type: 'not-found',
        severity: 'high',
        message: 'cursor not found',
        suggestion: 'Install cursor',
      };

      const analysis = service.analyzeError(platformError, 'cursor-ide');

      expect(analysis.errorCategory).toBe('platform');
      expect(analysis.severity).toBe('critical');
      expect(analysis.isRecoverable).toBe(true);
      expect(analysis.automaticFixAvailable).toBe(false);
    });

    it('should categorize permission errors correctly', () => {
      const permissionError: DeploymentError = {
        component: 'file-system',
        type: 'access-denied',
        severity: 'medium',
        message: 'permission denied',
        suggestion: 'Check permissions',
      };

      const analysis = service.analyzeError(permissionError);

      expect(analysis.errorCategory).toBe('permission');
      expect(analysis.severity).toBe('high');
      expect(analysis.isRecoverable).toBe(true);
      expect(analysis.automaticFixAvailable).toBe(true);
    });

    it('should categorize configuration errors correctly', () => {
      const configError: DeploymentError = {
        component: 'config',
        type: 'invalid-format',
        severity: 'medium',
        message: 'invalid configuration format',
        suggestion: 'Check config syntax',
      };

      const analysis = service.analyzeError(configError);

      expect(analysis.errorCategory).toBe('configuration');
      expect(analysis.severity).toBe('medium');
      expect(analysis.isRecoverable).toBe(true);
    });

    it('should categorize network errors correctly', () => {
      const networkError: DeploymentError = {
        component: 'network',
        type: 'timeout',
        severity: 'medium',
        message: 'network timeout occurred',
        suggestion: 'Check connection',
      };

      const analysis = service.analyzeError(networkError);

      expect(analysis.errorCategory).toBe('network');
      expect(analysis.severity).toBe('high');
      expect(analysis.isRecoverable).toBe(true);
    });

    it('should provide prevention tips based on category', () => {
      const configError: DeploymentError = {
        component: 'config',
        type: 'invalid',
        severity: 'medium',
        message: 'invalid configuration',
        suggestion: 'Fix config',
      };

      const analysis = service.analyzeError(configError);

      expect(analysis.preventionTips.length).toBeGreaterThan(0);
      expect(analysis.preventionTips.some(tip => 
        tip.includes('configuration') || tip.includes('validate')
      )).toBe(true);
    });

    it('should estimate fix time based on category and severity', () => {
      const criticalError: DeploymentError = {
        component: 'platform',
        type: 'not-found',
        severity: 'high',
        message: 'platform not found',
        suggestion: 'Install platform',
      };

      const analysis = service.analyzeError(criticalError);

      expect(analysis.estimatedFixTime).toBeDefined();
      expect(analysis.estimatedFixTime).toContain('minutes');
    });
  });

  describe('generateUserFriendlyMessage', () => {
    it('should generate user-friendly error message', () => {
      const message = service.generateUserFriendlyMessage(mockError, 'cursor-ide');

      expect(message).toContain('🚨');
      expect(message).toContain(mockError.message);
      expect(message).toContain('Platform: cursor-ide');
      expect(message).toContain('🔧 Quick Fix:');
      expect(message).toContain('💡 Solutions:');
    });

    it('should include detailed information when requested', () => {
      const message = service.generateUserFriendlyMessage(mockError, 'cursor-ide', true);

      expect(message).toContain('🛡️  Prevention Tips:');
      expect(message).toContain('ℹ️  Additional Information:');
      expect(message).toContain('Estimated fix time:');
      expect(message).toContain('Recoverable:');
    });

    it('should exclude detailed information when not requested', () => {
      const message = service.generateUserFriendlyMessage(mockError, 'cursor-ide', false);

      expect(message).not.toContain('🛡️  Prevention Tips:');
      expect(message).not.toContain('ℹ️  Additional Information:');
    });

    it('should handle errors without platform', () => {
      const message = service.generateUserFriendlyMessage(mockError);

      expect(message).toContain(mockError.message);
      expect(message).not.toContain('Platform:');
    });

    it('should show automated solution indicators', () => {
      const message = service.generateUserFriendlyMessage(mockError, 'cursor-ide');

      expect(message).toMatch(/[🤖👤]/); // Should contain either automated or manual indicator
    });
  });

  describe('suggestAutomatedFix', () => {
    it('should suggest automated fix for CURSOR_NOT_FOUND', () => {
      const cursorError: DeploymentError = {
        component: 'cursor',
        type: 'not-found',
        severity: 'high',
        message: 'cursor not found',
        suggestion: 'Install cursor',
      };

      const suggestion = service.suggestAutomatedFix(cursorError, 'cursor-ide');

      expect(suggestion.available).toBe(true);
      expect(suggestion.command).toContain('--cursor-path');
      expect(suggestion.description).toBeDefined();
      expect(suggestion.risks).toBeDefined();
    });

    it('should suggest automated fix for WORKSPACE_NOT_FOUND', () => {
      const workspaceError: DeploymentError = {
        component: 'workspace',
        type: 'not-found',
        severity: 'medium',
        message: 'workspace not found',
        suggestion: 'Create workspace',
      };

      // Mock error detection to return WORKSPACE_NOT_FOUND
      vi.spyOn(service as any, 'detectErrorCode').mockReturnValue('WORKSPACE_NOT_FOUND');

      const suggestion = service.suggestAutomatedFix(workspaceError, 'cursor-ide');

      expect(suggestion.available).toBe(true);
      expect(suggestion.command).toContain('mkdir');
      expect(suggestion.description).toContain('workspace');
    });

    it('should suggest automated fix for AI_CONFIG_INVALID', () => {
      const aiError: DeploymentError = {
        component: 'ai-config',
        type: 'invalid',
        severity: 'medium',
        message: 'ai config invalid',
        suggestion: 'Fix config',
      };

      // Mock error detection to return AI_CONFIG_INVALID
      vi.spyOn(service as any, 'detectErrorCode').mockReturnValue('AI_CONFIG_INVALID');

      const suggestion = service.suggestAutomatedFix(aiError, 'cursor-ide');

      expect(suggestion.available).toBe(true);
      expect(suggestion.command).toContain('--skip-ai-config');
      expect(suggestion.description).toContain('skip AI configuration');
    });

    it('should not suggest fix for unknown errors', () => {
      const unknownError: DeploymentError = {
        component: 'unknown',
        type: 'unknown',
        severity: 'medium',
        message: 'unknown error',
        suggestion: 'Try something',
      };

      const suggestion = service.suggestAutomatedFix(unknownError);

      expect(suggestion.available).toBe(false);
      expect(suggestion.command).toBeUndefined();
    });
  });

  describe('generateFromTemplate', () => {
    it('should generate message from PLATFORM_NOT_FOUND template', () => {
      const variables = { platform: 'Cursor IDE' };
      const message = service.generateFromTemplate('PLATFORM_NOT_FOUND', variables);

      expect(message).toContain('Cursor IDE');
      expect(message).toContain('not installed');
      expect(message).toContain('--cursor-path');
    });

    it('should generate message from COMPONENT_INVALID template', () => {
      const variables = {
        component: 'invalid-component',
        platform: 'cursor-ide',
        validComponents: 'ai-config, workspace-settings',
      };
      const message = service.generateFromTemplate('COMPONENT_INVALID', variables);

      expect(message).toContain('invalid-component');
      expect(message).toContain('cursor-ide');
      expect(message).toContain('ai-config, workspace-settings');
    });

    it('should handle unknown template gracefully', () => {
      const message = service.generateFromTemplate('UNKNOWN_TEMPLATE', {});

      expect(message).toContain('Unknown error template');
    });
  });

  describe('validateTemplate', () => {
    it('should validate template with correct variables', () => {
      const validation = service.validateTemplate('PLATFORM_NOT_FOUND', { platform: 'Cursor IDE' });

      expect(validation.valid).toBe(true);
      expect(validation.missingVariables).toHaveLength(0);
      expect(validation.extraVariables).toHaveLength(0);
    });

    it('should detect missing variables', () => {
      const validation = service.validateTemplate('PLATFORM_NOT_FOUND', {});

      expect(validation.valid).toBe(false);
      expect(validation.missingVariables).toContain('platform');
    });

    it('should detect extra variables', () => {
      const validation = service.validateTemplate('PLATFORM_NOT_FOUND', {
        platform: 'Cursor IDE',
        extraVariable: 'extra',
      });

      expect(validation.valid).toBe(true);
      expect(validation.extraVariables).toContain('extraVariable');
    });

    it('should handle unknown template', () => {
      const validation = service.validateTemplate('UNKNOWN_TEMPLATE', { test: 'value' });

      expect(validation.valid).toBe(false);
      expect(validation.extraVariables).toContain('test');
    });
  });

  describe('getErrorStatistics', () => {
    it('should calculate error statistics correctly', () => {
      const errors: DeploymentError[] = [
        {
          component: 'platform',
          type: 'not-found',
          severity: 'high',
          message: 'Platform not found',
          suggestion: 'Install platform',
        },
        {
          component: 'config',
          type: 'invalid',
          severity: 'medium',
          message: 'Invalid configuration',
          suggestion: 'Fix config',
        },
        {
          component: 'platform',
          type: 'not-found',
          severity: 'high',
          message: 'Platform not found', // Duplicate message
          suggestion: 'Install platform',
        },
      ];

      const stats = service.getErrorStatistics(errors);

      expect(stats.totalErrors).toBe(3);
      expect(stats.bySeverity.high).toBe(2);
      expect(stats.bySeverity.medium).toBe(1);
      expect(stats.mostCommon).toHaveLength(2);
      expect(stats.mostCommon[0].message).toBe('Platform not found');
      expect(stats.mostCommon[0].count).toBe(2);
    });

    it('should handle empty error list', () => {
      const stats = service.getErrorStatistics([]);

      expect(stats.totalErrors).toBe(0);
      expect(stats.mostCommon).toHaveLength(0);
    });

    it('should categorize errors in statistics', () => {
      const errors: DeploymentError[] = [
        {
          component: 'platform',
          type: 'not-found',
          severity: 'high',
          message: 'platform not found',
          suggestion: 'Install',
        },
        {
          component: 'config',
          type: 'invalid',
          severity: 'medium',
          message: 'invalid configuration',
          suggestion: 'Fix',
        },
      ];

      const stats = service.getErrorStatistics(errors);

      expect(stats.byCategory.platform).toBe(1);
      expect(stats.byCategory.configuration).toBe(1);
    });
  });

  describe('error code detection', () => {
    it('should detect error codes from explicit code property', () => {
      const errorWithCode = {
        ...mockError,
        code: 'EXPLICIT_CODE',
      } as DeploymentError & { code: string };

      const enhanced = service.enhanceError(errorWithCode);

      expect(enhanced.errorCode).toBe('EXPLICIT_CODE');
    });

    it('should detect error codes from message patterns', () => {
      const networkError: DeploymentError = {
        component: 'network',
        type: 'timeout',
        severity: 'medium',
        message: 'network error occurred during deployment',
        suggestion: 'Check connection',
      };

      const enhanced = service.enhanceError(networkError);

      expect(enhanced.errorCode).toBe('NETWORK_ERROR');
    });

    it('should detect platform-specific error codes', () => {
      const cursorSpecificError: DeploymentError = {
        component: 'cursor',
        type: 'config-error',
        severity: 'medium',
        message: 'Error in .cursorrules file',
        suggestion: 'Check syntax',
      };

      const enhanced = service.enhanceError(cursorSpecificError, 'cursor-ide');

      expect(enhanced.errorCode).toBe('AI_CONFIG_INVALID');
    });
  });

  describe('edge cases', () => {
    it('should handle undefined error message', () => {
      const undefinedError: DeploymentError = {
        component: 'unknown',
        type: 'unknown',
        severity: 'medium',
        message: '',
        suggestion: 'Try something',
      };

      const enhanced = service.enhanceError(undefinedError);

      expect(enhanced).toBeDefined();
      expect(enhanced.quickFix).toBeDefined();
    });

    it('should handle error without suggestion', () => {
      const noSuggestionError: DeploymentError = {
        component: 'test',
        type: 'test-error',
        severity: 'low',
        message: 'Test error',
      };

      const enhanced = service.enhanceError(noSuggestionError);

      expect(enhanced).toBeDefined();
      expect(enhanced.quickFix).toBeDefined();
    });

    it('should handle very long error messages', () => {
      const longError: DeploymentError = {
        component: 'test',
        type: 'test-error',
        severity: 'medium',
        message: 'A'.repeat(1000),
        suggestion: 'Fix this very long error message',
      };

      const message = service.generateUserFriendlyMessage(longError);

      expect(message).toBeDefined();
      expect(message.length).toBeGreaterThan(0);
    });
  });
});
