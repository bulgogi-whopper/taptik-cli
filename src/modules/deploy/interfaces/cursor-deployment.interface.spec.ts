import { describe, it, expect } from 'vitest';

import {
  CursorComponentType,
  CursorConflictStrategy,
  AISecurityLevel,
  WorkspaceMode,
  CursorDeploymentOptions,
  CursorDeploymentResult,
  CursorValidationResult,
  CursorGlobalSettings,
  CursorAIConfig,
} from './cursor-deployment.interface';

describe('Cursor Deployment Interfaces', () => {
  describe('CursorComponentType', () => {
    it('should contain all expected component types', () => {
      const expectedTypes: CursorComponentType[] = [
        'settings',
        'extensions',
        'snippets',
        'ai-config',
        'debug-config',
        'tasks',
        'workspace',
      ];

      expectedTypes.forEach((type) => {
        expect(type).toBeDefined();
        expect(typeof type).toBe('string');
      });
    });
  });

  describe('CursorConflictStrategy', () => {
    it('should contain all expected conflict strategies', () => {
      expect(CursorConflictStrategy.PROMPT).toBe('prompt');
      expect(CursorConflictStrategy.MERGE).toBe('merge');
      expect(CursorConflictStrategy.BACKUP).toBe('backup');
      expect(CursorConflictStrategy.SKIP).toBe('skip');
      expect(CursorConflictStrategy.OVERWRITE).toBe('overwrite');
    });
  });

  describe('AISecurityLevel', () => {
    it('should contain all expected security levels', () => {
      expect(AISecurityLevel.STRICT).toBe('strict');
      expect(AISecurityLevel.STANDARD).toBe('standard');
      expect(AISecurityLevel.PERMISSIVE).toBe('permissive');
    });
  });

  describe('WorkspaceMode', () => {
    it('should contain all expected workspace modes', () => {
      expect(WorkspaceMode.SINGLE_ROOT).toBe('single-root');
      expect(WorkspaceMode.MULTI_ROOT).toBe('multi-root');
      expect(WorkspaceMode.AUTO_DETECT).toBe('auto-detect');
    });
  });

  describe('CursorDeploymentOptions', () => {
    it('should extend DeploymentOptions with Cursor-specific properties', () => {
      const options: CursorDeploymentOptions = {
        platform: 'cursor-ide',
        dryRun: false,
        validateOnly: false,
        conflictStrategy: 'prompt',
        components: ['settings'],
        skipComponents: [],
        cursorComponents: ['ai-config', 'extensions'],
        skipCursorComponents: ['debug-config'],
        cursorConflictStrategy: CursorConflictStrategy.MERGE,
        aiSecurityLevel: AISecurityLevel.STANDARD,
        extensionValidation: true,
        workspaceMode: WorkspaceMode.AUTO_DETECT,
      };

      expect(options.platform).toBe('cursor-ide');
      expect(options.cursorComponents).toEqual(['ai-config', 'extensions']);
      expect(options.skipCursorComponents).toEqual(['debug-config']);
      expect(options.cursorConflictStrategy).toBe(CursorConflictStrategy.MERGE);
      expect(options.aiSecurityLevel).toBe(AISecurityLevel.STANDARD);
      expect(options.extensionValidation).toBe(true);
      expect(options.workspaceMode).toBe(WorkspaceMode.AUTO_DETECT);
    });
  });

  describe('CursorDeploymentResult', () => {
    it('should extend DeploymentResult with Cursor-specific properties', () => {
      const result: CursorDeploymentResult = {
        success: true,
        platform: 'cursor-ide',
        deployedComponents: ['settings', 'ai-config'],
        conflicts: [],
        summary: {
          filesDeployed: 5,
          filesSkipped: 0,
          conflictsResolved: 0,
          backupCreated: true,
        },
        errors: [],
        warnings: [],
        cursorComponents: {
          'settings': {
            deployed: true,
            files: ['~/.cursor/User/settings.json', '.cursor/settings.json'],
            conflicts: [],
            errors: [],
            warnings: [],
          },
          'extensions': {
            deployed: false,
            files: [],
            conflicts: [],
            errors: [],
            warnings: ['No extensions to deploy'],
          },
          'snippets': {
            deployed: false,
            files: [],
            conflicts: [],
            errors: [],
            warnings: [],
          },
          'ai-config': {
            deployed: true,
            files: ['.cursor/ai/rules.md', '.cursorrules'],
            conflicts: [],
            errors: [],
            warnings: [],
          },
          'debug-config': {
            deployed: false,
            files: [],
            conflicts: [],
            errors: [],
            warnings: [],
          },
          'tasks': {
            deployed: false,
            files: [],
            conflicts: [],
            errors: [],
            warnings: [],
          },
          'workspace': {
            deployed: false,
            files: [],
            conflicts: [],
            errors: [],
            warnings: [],
          },
        },
        cursorDirectories: {
          global: '~/.cursor',
          project: '.cursor',
          ai: '.cursor/ai',
          workspace: '.cursor/workspace',
        },
        aiValidationResults: [],
        extensionCompatibility: [],
      };

      expect(result.platform).toBe('cursor-ide');
      expect(result.cursorComponents).toBeDefined();
      expect(result.cursorComponents.settings.deployed).toBe(true);
      expect(result.cursorComponents.settings.files).toHaveLength(2);
      expect(result.cursorDirectories).toBeDefined();
      expect(result.cursorDirectories.global).toBe('~/.cursor');
      expect(result.aiValidationResults).toEqual([]);
      expect(result.extensionCompatibility).toEqual([]);
    });
  });

  describe('CursorValidationResult', () => {
    it('should contain validation results for all components', () => {
      const validationResult: CursorValidationResult = {
        isValid: true,
        errors: [],
        warnings: [],
        componentResults: {
          'settings': { isValid: true, errors: [], warnings: [] },
          'extensions': { isValid: true, errors: [], warnings: [] },
          'snippets': { isValid: true, errors: [], warnings: [] },
          'ai-config': { isValid: true, errors: [], warnings: [] },
          'debug-config': { isValid: true, errors: [], warnings: [] },
          'tasks': { isValid: true, errors: [], warnings: [] },
          'workspace': { isValid: true, errors: [], warnings: [] },
        },
        aiSecurityResults: [],
        extensionValidationResults: [],
      };

      expect(validationResult.isValid).toBe(true);
      expect(validationResult.componentResults).toBeDefined();
      expect(Object.keys(validationResult.componentResults)).toHaveLength(7);
      expect(validationResult.aiSecurityResults).toEqual([]);
      expect(validationResult.extensionValidationResults).toEqual([]);
    });
  });

  describe('CursorGlobalSettings', () => {
    it('should define proper editor settings structure', () => {
      const settings: Partial<CursorGlobalSettings> = {
        "editor.fontSize": 14,
        "editor.fontFamily": "Monaco",
        "editor.tabSize": 2,
        "editor.insertSpaces": true,
        "editor.wordWrap": "on",
        "editor.lineNumbers": "on",
        "editor.minimap.enabled": true,
        "editor.formatOnSave": true,
        "editor.codeActionsOnSave": {
          "source.fixAll": true,
          "source.organizeImports": true,
        },
      };

      expect(settings["editor.fontSize"]).toBe(14);
      expect(settings["editor.fontFamily"]).toBe("Monaco");
      expect(settings["editor.tabSize"]).toBe(2);
      expect(settings["editor.insertSpaces"]).toBe(true);
      expect(settings["editor.wordWrap"]).toBe("on");
      expect(settings["editor.lineNumbers"]).toBe("on");
      expect(settings["editor.minimap.enabled"]).toBe(true);
      expect(settings["editor.formatOnSave"]).toBe(true);
      expect(settings["editor.codeActionsOnSave"]).toEqual({
        "source.fixAll": true,
        "source.organizeImports": true,
      });
    });

    it('should define proper AI settings structure', () => {
      const settings: Partial<CursorGlobalSettings> = {
        "cursor.ai.enabled": true,
        "cursor.ai.model": "gpt-4",
        "cursor.ai.temperature": 0.7,
        "cursor.ai.maxTokens": 2048,
        "cursor.ai.contextWindow": 8192,
        "cursor.ai.codeActions": true,
        "cursor.ai.autoComplete": true,
        "cursor.ai.chat": true,
        "cursor.ai.composer": true,
      };

      expect(settings["cursor.ai.enabled"]).toBe(true);
      expect(settings["cursor.ai.model"]).toBe("gpt-4");
      expect(settings["cursor.ai.temperature"]).toBe(0.7);
      expect(settings["cursor.ai.maxTokens"]).toBe(2048);
      expect(settings["cursor.ai.contextWindow"]).toBe(8192);
      expect(settings["cursor.ai.codeActions"]).toBe(true);
      expect(settings["cursor.ai.autoComplete"]).toBe(true);
      expect(settings["cursor.ai.chat"]).toBe(true);
      expect(settings["cursor.ai.composer"]).toBe(true);
    });
  });

  describe('CursorAIConfig', () => {
    it('should define proper AI configuration structure', () => {
      const aiConfig: CursorAIConfig = {
        rules: {
          content: '# AI Rules\n\nUse TypeScript for all code.',
          path: '.cursor/ai/rules.md',
        },
        context: {
          content: '# Project Context\n\nThis is a CLI tool.',
          path: '.cursor/ai/context.md',
        },
        prompts: {
          'code-review': {
            content: 'Review this code for best practices.',
            path: '.cursor/ai/prompts/code-review.md',
            metadata: {
              description: 'Code review prompt',
              category: 'review',
              tags: ['typescript', 'best-practices'],
            },
          },
        },
        cursorRules: {
          content: 'Always use TypeScript strict mode.',
          path: '.cursorrules',
        },
        modelSettings: {
          defaultModel: 'gpt-4',
          temperature: 0.7,
          maxTokens: 2048,
          contextWindow: 8192,
        },
      };

      expect(aiConfig.rules.path).toBe('.cursor/ai/rules.md');
      expect(aiConfig.context.path).toBe('.cursor/ai/context.md');
      expect(aiConfig.prompts['code-review'].metadata?.category).toBe('review');
      expect(aiConfig.prompts['code-review'].metadata?.tags).toEqual(['typescript', 'best-practices']);
      expect(aiConfig.cursorRules.path).toBe('.cursorrules');
      expect(aiConfig.modelSettings.defaultModel).toBe('gpt-4');
      expect(aiConfig.modelSettings.temperature).toBe(0.7);
    });
  });
});
