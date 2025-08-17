import * as fs from 'node:fs/promises';

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { ComponentType } from '../interfaces/component-types.interface';
import { DeploymentResult } from '../interfaces/deployment-result.interface';

import {
  ErrorRecoveryService,
  RecoveryOptions,
} from './error-recovery.service';

vi.mock('fs/promises');

describe('ErrorRecoveryService', () => {
  let service: ErrorRecoveryService;
  let mockBackupService: any;
  let mockLockingService: any;

  beforeEach(async () => {
    mockBackupService = {
      restore: vi.fn(),
      cleanupOldBackups: vi.fn(),
    };

    mockLockingService = {
      releaseAll: vi.fn(),
      cleanupStaleLocks: vi.fn(),
    };

    // Mock fs operations
    vi.mocked(fs.access).mockResolvedValue(undefined);

    // Create service instance directly with mocks
    service = new ErrorRecoveryService(mockBackupService, mockLockingService);
  });

  describe('recoverFromFailure', () => {
    it('should successfully recover from a failed deployment', async () => {
      const deploymentResult: DeploymentResult = {
        success: false,
        platform: 'claudeCode',
        deployedComponents: ['settings', 'agents'] as ComponentType[],
        conflicts: [],
        errors: [],
        warnings: [],
        summary: {
          totalComponents: 2,
          filesDeployed: 0,
          filesSkipped: 0,
          conflictsResolved: 0,
          duration: 0,
        },
        metadata: {
          backupCreated: 'backup-123',
          timestamp: new Date(),
        },
      };

      const options: RecoveryOptions = {
        platform: 'claudeCode',
        forceRecovery: true,
      };

      const result = await service.recoverFromFailure(
        deploymentResult,
        options,
      );

      expect(result.success).toBe(true);
      expect(result.cleanedUp).toBe(true);
      expect(result.backupRestored).toBe('backup-123');
      expect(mockLockingService.releaseAll).toHaveBeenCalledWith('claudeCode');
      expect(mockBackupService.restore).toHaveBeenCalledWith(
        'backup-123',
        'claudeCode',
      );
    });

    it('should handle cleanup-only recovery', async () => {
      const deploymentResult: DeploymentResult = {
        success: false,
        platform: 'claudeCode',
        deployedComponents: [],
        conflicts: [],
        errors: [],
        warnings: [],
        summary: {
          totalComponents: 0,
          filesDeployed: 0,
          filesSkipped: 0,
          conflictsResolved: 0,
          duration: 0,
        },
      };

      const options: RecoveryOptions = {
        platform: 'claudeCode',
        cleanupOnly: true,
      };

      const result = await service.recoverFromFailure(
        deploymentResult,
        options,
      );

      expect(result.success).toBe(true);
      expect(result.cleanedUp).toBe(true);
      expect(mockBackupService.restore).not.toHaveBeenCalled();
    });

    it('should handle backup restore failure gracefully', async () => {
      vi.clearAllMocks();
      mockBackupService.restore.mockRejectedValue(
        new Error('Backup not found'),
      );

      const deploymentResult: DeploymentResult = {
        success: false,
        platform: 'claudeCode',
        deployedComponents: ['settings'] as ComponentType[],
        conflicts: [],
        errors: [],
        warnings: [],
        summary: {
          totalComponents: 1,
          filesDeployed: 0,
          filesSkipped: 0,
          conflictsResolved: 0,
          duration: 0,
        },
        metadata: {
          backupCreated: 'backup-123',
          timestamp: new Date(),
        },
      };

      const options: RecoveryOptions = {
        platform: 'claudeCode',
      };

      const result = await service.recoverFromFailure(
        deploymentResult,
        options,
      );

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        component: 'backup',
        error: 'Backup restore failed: Backup not found',
      });
    });

    it('should recover individual components', async () => {
      const deploymentResult: DeploymentResult = {
        success: false,
        platform: 'claudeCode',
        deployedComponents: [
          'settings',
          'agents',
          'commands',
          'project',
        ] as ComponentType[],
        conflicts: [],
        errors: [],
        warnings: [],
        summary: {
          totalComponents: 4,
          filesDeployed: 0,
          filesSkipped: 0,
          conflictsResolved: 0,
          duration: 0,
        },
      };

      const options: RecoveryOptions = {
        platform: 'claudeCode',
      };

      const result = await service.recoverFromFailure(
        deploymentResult,
        options,
      );

      expect(result.recoveredComponents).toEqual([
        'settings',
        'agents',
        'commands',
        'project',
      ]);
      // fs.access is called multiple times due to implementation details
    });

    it('should handle component recovery failure', async () => {
      vi.mocked(fs.access).mockRejectedValueOnce(new Error('File not found'));

      const deploymentResult: DeploymentResult = {
        success: false,
        platform: 'claudeCode',
        deployedComponents: ['settings'] as ComponentType[],
        conflicts: [],
        errors: [],
        warnings: [],
        summary: {
          totalComponents: 1,
          filesDeployed: 0,
          filesSkipped: 0,
          conflictsResolved: 0,
          duration: 0,
        },
      };

      const options: RecoveryOptions = {
        platform: 'claudeCode',
      };

      const result = await service.recoverFromFailure(
        deploymentResult,
        options,
      );

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].component).toBe('settings');
      expect(result.errors[0].error).toContain(
        'Settings path validation failed',
      );
    });

    it('should clean up partial deployments', async () => {
      const deploymentResult: DeploymentResult = {
        success: false,
        platform: 'claudeCode',
        deployedComponents: [],
        conflicts: [],
        errors: [],
        warnings: [],
        summary: {
          totalComponents: 0,
          filesDeployed: 0,
          filesSkipped: 0,
          conflictsResolved: 0,
          duration: 0,
        },
      };

      const options: RecoveryOptions = {
        platform: 'claudeCode',
      };

      await service.recoverFromFailure(deploymentResult, options);

      expect(mockLockingService.cleanupStaleLocks).toHaveBeenCalled();
      expect(mockBackupService.cleanupOldBackups).toHaveBeenCalledWith(5);
    });
  });

  describe('validateRecovery', () => {
    it('should validate successful recovery', async () => {
      const result = {
        success: true,
        recoveredComponents: ['settings', 'agents'] as ComponentType[],
        errors: [],
        cleanedUp: true,
      };

      const expectedComponents: ComponentType[] = ['settings', 'agents'];

      const isValid = await service.validateRecovery(
        result,
        expectedComponents,
      );

      expect(isValid).toBe(true);
    });

    it('should detect incomplete recovery', async () => {
      const result = {
        success: true,
        recoveredComponents: ['settings'] as ComponentType[],
        errors: [],
        cleanedUp: true,
      };

      const expectedComponents: ComponentType[] = ['settings', 'agents'];

      const isValid = await service.validateRecovery(
        result,
        expectedComponents,
      );

      expect(isValid).toBe(false);
    });

    it('should detect recovery with errors', async () => {
      const result = {
        success: false,
        recoveredComponents: ['settings', 'agents'] as ComponentType[],
        errors: [
          { component: 'settings' as ComponentType, error: 'Some error' },
        ],
        cleanedUp: true,
      };

      const expectedComponents: ComponentType[] = ['settings', 'agents'];

      const isValid = await service.validateRecovery(
        result,
        expectedComponents,
      );

      expect(isValid).toBe(false);
    });
  });
});
