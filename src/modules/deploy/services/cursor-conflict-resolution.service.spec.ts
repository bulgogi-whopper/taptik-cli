import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CursorBackupService } from './cursor-backup.service';
import { CursorConflictResolverService } from './cursor-conflict-resolver.service';
import { CursorDeploymentStateService } from './cursor-deployment-state.service';
import { CursorDeploymentOptions } from '../interfaces/cursor-deployment.interface';

describe('Task 6.2: Cursor Conflict Resolution Services', () => {
  let backupService: CursorBackupService;
  let conflictResolver: CursorConflictResolverService;
  let stateManager: CursorDeploymentStateService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CursorBackupService,
        CursorConflictResolverService,
        CursorDeploymentStateService,
      ],
    }).compile();

    backupService = module.get<CursorBackupService>(CursorBackupService);
    conflictResolver = module.get<CursorConflictResolverService>(CursorConflictResolverService);
    stateManager = module.get<CursorDeploymentStateService>(CursorDeploymentStateService);
  });

  describe('CursorBackupService', () => {
    const mockOptions: CursorDeploymentOptions = {
      platform: 'cursor',
      cursorPath: '/test/cursor',
      workspacePath: '/test/workspace',
      components: ['global-settings', 'ai-config'],
      skipComponents: [],
    };

    it('should be defined', () => {
      expect(backupService).toBeDefined();
    });

    it('should create backup successfully', async () => {
      const result = await backupService.createBackup('test-deployment', mockOptions, ['global-settings']);

      expect(result).toBeDefined();
      expect(result.backupId).toContain('backup-');
      expect(result.backupPath).toBeDefined();
    });

    it('should list available backups', async () => {
      const backups = await backupService.listBackups();

      expect(Array.isArray(backups)).toBe(true);
    });

    it('should cleanup old backups', async () => {
      const result = await backupService.cleanupBackups(5);

      expect(result).toHaveProperty('cleaned');
      expect(result).toHaveProperty('errors');
      expect(Array.isArray(result.errors)).toBe(true);
    });
  });

  describe('CursorConflictResolverService', () => {
    const mockOptions: CursorDeploymentOptions = {
      platform: 'cursor',
      components: ['global-settings'],
      skipComponents: [],
      mergeStrategy: 'merge',
    };

    it('should be defined', () => {
      expect(conflictResolver).toBeDefined();
    });

    it('should resolve conflicts for settings configuration', async () => {
      const newConfig = {
        'editor.fontSize': 16,
        'editor.tabSize': 4,
      };

      const result = await conflictResolver.resolveConfigurationConflicts(
        'global-settings',
        newConfig,
        mockOptions
      );

      expect(result).toBeDefined();
      expect(result).toHaveProperty('hasConflicts');
      expect(result).toHaveProperty('resolvedConfig');
      expect(result).toHaveProperty('resolutionStrategy');
    });

    it('should handle no existing configuration', async () => {
      const newConfig = { 'editor.fontSize': 14 };

      const result = await conflictResolver.resolveConfigurationConflicts(
        'global-settings',
        newConfig,
        mockOptions
      );

      expect(result.hasConflicts).toBe(false);
      expect(result.resolutionStrategy).toBe('no_existing_config');
      expect(result.resolvedConfig).toEqual(newConfig);
    });

    it('should detect AI configuration conflicts', async () => {
      const newConfig = {
        rules: ['Use TypeScript', 'Follow clean code'],
        systemPrompt: 'You are a helpful assistant',
      };

      const result = await conflictResolver.resolveConfigurationConflicts(
        'ai-config',
        newConfig,
        mockOptions
      );

      expect(result).toBeDefined();
      expect(result.resolvedConfig).toHaveProperty('rules');
    });
  });

  describe('CursorDeploymentStateService', () => {
    const mockOptions: CursorDeploymentOptions = {
      platform: 'cursor',
      components: ['global-settings'],
      skipComponents: [],
    };

    it('should be defined', () => {
      expect(stateManager).toBeDefined();
    });

    it('should save and load deployment state', async () => {
      const deploymentId = 'test-deployment-123';
      const progress = {
        status: 'in_progress' as const,
        startedAt: new Date().toISOString(),
        completedComponents: [],
        failedComponents: [],
        inProgressComponents: ['global-settings'],
        componentErrors: {},
      };

      await stateManager.saveDeploymentState(deploymentId, mockOptions, progress);
      const loadedState = await stateManager.loadDeploymentState(deploymentId);

      expect(loadedState).toBeDefined();
      expect(loadedState?.deploymentId).toBe(deploymentId);
      expect(loadedState?.status).toBe('in_progress');
    });

    it('should find interrupted deployments', async () => {
      const interruptedDeployments = await stateManager.findInterruptedDeployments();

      expect(Array.isArray(interruptedDeployments)).toBe(true);
    });

    it('should update deployment progress', async () => {
      const deploymentId = 'test-deployment-456';
      
      // First save initial state
      await stateManager.saveDeploymentState(deploymentId, mockOptions, {
        status: 'in_progress',
        startedAt: new Date().toISOString(),
        completedComponents: [],
        failedComponents: [],
        inProgressComponents: [],
        componentErrors: {},
      });

      // Then update progress
      await stateManager.updateDeploymentProgress(deploymentId, 'global-settings', 'started');
      await stateManager.updateDeploymentProgress(deploymentId, 'global-settings', 'completed');

      const finalState = await stateManager.loadDeploymentState(deploymentId);
      expect(finalState?.progress.completedComponents).toContain('global-settings');
    });

    it('should create recovery plan for interrupted deployment', async () => {
      const deploymentId = 'test-interrupted-789';
      
      // Create interrupted deployment state
      await stateManager.saveDeploymentState(deploymentId, {
        ...mockOptions,
        components: ['global-settings', 'ai-config'],
      }, {
        status: 'in_progress',
        startedAt: new Date().toISOString(),
        completedComponents: ['global-settings'],
        failedComponents: [],
        inProgressComponents: ['ai-config'],
        componentErrors: {},
      });

      const recoveryPlan = await stateManager.resumeDeployment(deploymentId);

      expect(recoveryPlan).toBeDefined();
      expect(recoveryPlan.deploymentId).toBe(deploymentId);
      expect(recoveryPlan.completedComponents).toContain('global-settings');
      expect(recoveryPlan.recoveryActions.length).toBeGreaterThan(0);
    });

    it('should cleanup old deployment states', async () => {
      await stateManager.cleanupOldStates(1000); // Very short max age for testing
      // Test doesn't throw - cleanup is optional and should be resilient
    });
  });

  describe('Integration Tests', () => {
    it('should work together for complete conflict resolution workflow', async () => {
      const deploymentId = 'integration-test-001';
      const mockOptions: CursorDeploymentOptions = {
        platform: 'cursor',
        components: ['global-settings'],
        skipComponents: [],
        mergeStrategy: 'merge',
      };

      // 1. Create backup
      const backupResult = await backupService.createBackup(
        deploymentId,
        mockOptions,
        ['global-settings']
      );

      expect(backupResult.backupId).toBeDefined();

      // 2. Save deployment state
      await stateManager.saveDeploymentState(deploymentId, mockOptions, {
        status: 'in_progress',
        startedAt: new Date().toISOString(),
        completedComponents: [],
        failedComponents: [],
        inProgressComponents: ['global-settings'],
        componentErrors: {},
      });

      // 3. Resolve configuration conflicts
      const conflictResult = await conflictResolver.resolveConfigurationConflicts(
        'global-settings',
        { 'editor.fontSize': 14 },
        mockOptions
      );

      expect(conflictResult.resolvedConfig).toBeDefined();

      // 4. Update state as completed
      await stateManager.updateDeploymentProgress(deploymentId, 'global-settings', 'completed');

      const finalState = await stateManager.loadDeploymentState(deploymentId);
      expect(finalState?.progress.completedComponents).toContain('global-settings');
    });
  });
});