import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { CursorDeploymentOptions, CursorComponentType } from '../interfaces/cursor-deployment.interface';
import { DeploymentError, DeploymentWarning } from '../interfaces/deployment-result.interface';

/**
 * Task 6.2: Cursor backup service for deployment safety
 */
@Injectable()
export class CursorBackupService {
  private readonly logger = new Logger(CursorBackupService.name);
  private readonly backupBasePath: string;

  constructor() {
    // Create backup directory in system temp or user home
    this.backupBasePath = path.join(process.env.HOME || process.env.USERPROFILE || '/tmp', '.taptik-cli', 'cursor-backups');
  }

  /**
   * Create backup before deployment
   */
  async createBackup(
    deploymentId: string,
    options: CursorDeploymentOptions,
    components: CursorComponentType[]
  ): Promise<CursorBackupResult> {
    this.logger.log(`Creating backup for deployment: ${deploymentId}`);

    const backupId = this.generateBackupId(deploymentId);
    const backupPath = path.join(this.backupBasePath, backupId);
    const errors: DeploymentError[] = [];
    const warnings: DeploymentWarning[] = [];
    const backedUpFiles: BackedUpFile[] = [];

    try {
      // Ensure backup directory exists
      await fs.mkdir(backupPath, { recursive: true });

      // Create backup metadata
      const metadata: BackupMetadata = {
        backupId,
        deploymentId,
        timestamp: new Date().toISOString(),
        options,
        components,
        backedUpFiles: [],
        version: '1.0.0',
      };

      // Backup each component
      for (const component of components) {
        try {
          const componentBackup = await this.backupComponent(component, options, backupPath);
          backedUpFiles.push(...componentBackup.files);
          warnings.push(...componentBackup.warnings);
        } catch (error) {
          this.logger.error(`Failed to backup component ${component}:`, error);
          errors.push({
            component,
            type: 'backup',
            severity: 'high',
            message: `Failed to backup ${component}: ${(error as Error).message}`,
            suggestion: 'Check file permissions and disk space',
          });
        }
      }

      // Update metadata with backed up files
      metadata.backedUpFiles = backedUpFiles;

      // Save backup metadata
      const metadataPath = path.join(backupPath, 'backup-metadata.json');
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');

      this.logger.log(`Backup created successfully: ${backupPath} (${backedUpFiles.length} files)`);

      return {
        success: errors.length === 0,
        backupId,
        backupPath,
        backedUpFiles,
        errors,
        warnings,
        metadata,
      };

    } catch (error) {
      this.logger.error('Failed to create backup:', error);
      errors.push({
        component: 'backup-system',
        type: 'system',
        severity: 'critical',
        message: `Failed to create backup: ${(error as Error).message}`,
        suggestion: 'Check backup directory permissions and disk space',
      });

      return {
        success: false,
        backupId,
        backupPath,
        backedUpFiles: [],
        errors,
        warnings,
      };
    }
  }

  /**
   * Restore from backup (rollback)
   */
  async restoreFromBackup(backupId: string): Promise<CursorRestoreResult> {
    this.logger.log(`Restoring from backup: ${backupId}`);

    const backupPath = path.join(this.backupBasePath, backupId);
    const errors: DeploymentError[] = [];
    const warnings: DeploymentWarning[] = [];
    const restoredFiles: string[] = [];

    try {
      // Check if backup exists
      const metadataPath = path.join(backupPath, 'backup-metadata.json');
      const metadataContent = await fs.readFile(metadataPath, 'utf8');
      const metadata: BackupMetadata = JSON.parse(metadataContent);

      this.logger.log(`Found backup metadata: ${metadata.backedUpFiles.length} files to restore`);

      // Restore each backed up file
      for (const backedUpFile of metadata.backedUpFiles) {
        try {
          await this.restoreFile(backedUpFile, backupPath);
          restoredFiles.push(backedUpFile.originalPath);
          this.logger.debug(`Restored file: ${backedUpFile.originalPath}`);
        } catch (error) {
          this.logger.error(`Failed to restore file ${backedUpFile.originalPath}:`, error);
          errors.push({
            component: backedUpFile.component,
            type: 'restore',
            severity: 'high',
            message: `Failed to restore ${backedUpFile.originalPath}: ${(error as Error).message}`,
            path: backedUpFile.originalPath,
            suggestion: 'Check file permissions and path validity',
          });
        }
      }

      this.logger.log(`Restore completed: ${restoredFiles.length} files restored, ${errors.length} errors`);

      return {
        success: errors.length === 0,
        backupId,
        restoredFiles,
        errors,
        warnings,
        metadata,
      };

    } catch (error) {
      this.logger.error('Failed to restore from backup:', error);
      errors.push({
        component: 'backup-system',
        type: 'system',
        severity: 'critical',
        message: `Failed to restore from backup: ${(error as Error).message}`,
        suggestion: 'Check backup integrity and permissions',
      });

      return {
        success: false,
        backupId,
        restoredFiles: [],
        errors,
        warnings,
      };
    }
  }

  /**
   * List available backups
   */
  async listBackups(): Promise<BackupInfo[]> {
    try {
      await fs.mkdir(this.backupBasePath, { recursive: true });
      const backupDirs = await fs.readdir(this.backupBasePath);
      const backups: BackupInfo[] = [];

      for (const backupDir of backupDirs) {
        try {
          const metadataPath = path.join(this.backupBasePath, backupDir, 'backup-metadata.json');
          const metadataContent = await fs.readFile(metadataPath, 'utf8');
          const metadata: BackupMetadata = JSON.parse(metadataContent);

          const stats = await fs.stat(path.join(this.backupBasePath, backupDir));
          
          backups.push({
            backupId: metadata.backupId,
            deploymentId: metadata.deploymentId,
            timestamp: metadata.timestamp,
            components: metadata.components,
            fileCount: metadata.backedUpFiles.length,
            size: await this.calculateBackupSize(path.join(this.backupBasePath, backupDir)),
            created: stats.birthtime,
          });
        } catch (error) {
          this.logger.warn(`Failed to read backup metadata for ${backupDir}:`, error);
        }
      }

      return backups.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch (error) {
      this.logger.error('Failed to list backups:', error);
      return [];
    }
  }

  /**
   * Clean old backups (keep last N backups)
   */
  async cleanupBackups(keepCount: number = 10): Promise<{ cleaned: number; errors: string[] }> {
    this.logger.log(`Cleaning up old backups, keeping ${keepCount} most recent`);

    try {
      const backups = await this.listBackups();
      const toDelete = backups.slice(keepCount);
      const errors: string[] = [];
      let cleaned = 0;

      for (const backup of toDelete) {
        try {
          const backupPath = path.join(this.backupBasePath, backup.backupId);
          await fs.rm(backupPath, { recursive: true, force: true });
          cleaned++;
          this.logger.debug(`Deleted backup: ${backup.backupId}`);
        } catch (error) {
          const errorMsg = `Failed to delete backup ${backup.backupId}: ${(error as Error).message}`;
          this.logger.error(errorMsg);
          errors.push(errorMsg);
        }
      }

      this.logger.log(`Cleanup completed: ${cleaned} backups deleted, ${errors.length} errors`);
      return { cleaned, errors };
    } catch (error) {
      this.logger.error('Failed to cleanup backups:', error);
      return { cleaned: 0, errors: [(error as Error).message] };
    }
  }

  /**
   * Backup individual component
   */
  private async backupComponent(
    component: CursorComponentType,
    options: CursorDeploymentOptions,
    backupPath: string
  ): Promise<{ files: BackedUpFile[]; warnings: DeploymentWarning[] }> {
    const files: BackedUpFile[] = [];
    const warnings: DeploymentWarning[] = [];

    const filesToBackup = this.getComponentFilePaths(component, options);
    const componentBackupPath = path.join(backupPath, component);

    if (filesToBackup.length > 0) {
      await fs.mkdir(componentBackupPath, { recursive: true });
    }

    for (const filePath of filesToBackup) {
      try {
        // Check if file exists
        const exists = await this.fileExists(filePath);
        if (!exists) {
          warnings.push({
            component,
            type: 'backup',
            message: `File does not exist for backup: ${filePath}`,
            suggestion: 'File may not have been created yet, will be skipped in backup',
          });
          continue;
        }

        // Read and backup file
        const content = await fs.readFile(filePath, 'utf8');
        const backupFileName = this.sanitizeFileName(path.basename(filePath));
        const backupFilePath = path.join(componentBackupPath, backupFileName);
        
        await fs.writeFile(backupFilePath, content, 'utf8');

        files.push({
          component,
          originalPath: filePath,
          backupPath: backupFilePath,
          relativePath: path.relative(backupPath, backupFilePath),
          size: content.length,
          timestamp: new Date().toISOString(),
        });

      } catch (error) {
        warnings.push({
          component,
          type: 'backup',
          message: `Failed to backup file ${filePath}: ${(error as Error).message}`,
          suggestion: 'Check file permissions and accessibility',
        });
      }
    }

    return { files, warnings };
  }

  /**
   * Restore individual file
   */
  private async restoreFile(backedUpFile: BackedUpFile, backupBasePath: string): Promise<void> {
    const sourceBackupPath = path.join(backupBasePath, backedUpFile.relativePath);
    const targetPath = backedUpFile.originalPath;

    // Ensure target directory exists
    const targetDir = path.dirname(targetPath);
    await fs.mkdir(targetDir, { recursive: true });

    // Read backup content and restore
    const content = await fs.readFile(sourceBackupPath, 'utf8');
    await fs.writeFile(targetPath, content, 'utf8');
  }

  /**
   * Get file paths to backup for a component
   */
  private getComponentFilePaths(component: CursorComponentType, options: CursorDeploymentOptions): string[] {
    const cursorPath = options.cursorPath || this.getDefaultCursorPath();
    const workspacePath = options.workspacePath;
    
    switch (component) {
      case 'global-settings':
        return [
          path.join(cursorPath, 'User', 'settings.json'),
        ];
      
      case 'project-settings':
        return workspacePath ? [
          path.join(workspacePath, '.vscode', 'settings.json'),
        ] : [];
      
      case 'ai-config':
        const aiPaths = [path.join(cursorPath, '.cursorrules')];
        if (workspacePath) {
          aiPaths.push(path.join(workspacePath, '.cursorrules'));
        }
        return aiPaths;
      
      case 'extensions-config':
        return [
          path.join(cursorPath, 'User', 'extensions.json'),
        ];
      
      case 'debug-config':
        return workspacePath ? [
          path.join(workspacePath, '.vscode', 'launch.json'),
        ] : [];
      
      case 'tasks-config':
        return workspacePath ? [
          path.join(workspacePath, '.vscode', 'tasks.json'),
        ] : [];
      
      case 'snippets-config':
        return [
          path.join(cursorPath, 'User', 'snippets', 'typescript.json'),
          path.join(cursorPath, 'User', 'snippets', 'javascript.json'),
          path.join(cursorPath, 'User', 'snippets', 'python.json'),
        ];
      
      case 'workspace-config':
        return workspacePath ? [
          path.join(workspacePath, path.basename(workspacePath) + '.code-workspace'),
        ] : [];
      
      default:
        return [];
    }
  }

  /**
   * Check if file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Calculate backup directory size
   */
  private async calculateBackupSize(backupPath: string): Promise<number> {
    try {
      let totalSize = 0;
      const files = await fs.readdir(backupPath, { withFileTypes: true });
      
      for (const file of files) {
        const filePath = path.join(backupPath, file.name);
        if (file.isDirectory()) {
          totalSize += await this.calculateBackupSize(filePath);
        } else {
          const stats = await fs.stat(filePath);
          totalSize += stats.size;
        }
      }
      
      return totalSize;
    } catch {
      return 0;
    }
  }

  /**
   * Get default Cursor path based on OS
   */
  private getDefaultCursorPath(): string {
    const platform = process.platform;
    const home = process.env.HOME || process.env.USERPROFILE || '/tmp';
    
    switch (platform) {
      case 'darwin':
        return path.join(home, 'Library', 'Application Support', 'Cursor');
      case 'win32':
        return path.join(home, 'AppData', 'Roaming', 'Cursor');
      case 'linux':
        return path.join(home, '.config', 'Cursor');
      default:
        return path.join(home, '.cursor');
    }
  }

  /**
   * Sanitize filename for backup
   */
  private sanitizeFileName(fileName: string): string {
    return fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  }

  /**
   * Generate backup ID
   */
  private generateBackupId(deploymentId: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const shortDeploymentId = deploymentId.split('-').pop() || 'unknown';
    return `backup-${timestamp}-${shortDeploymentId}`;
  }
}

/**
 * Backup operation result
 */
export interface CursorBackupResult {
  success: boolean;
  backupId: string;
  backupPath: string;
  backedUpFiles: BackedUpFile[];
  errors: DeploymentError[];
  warnings: DeploymentWarning[];
  metadata?: BackupMetadata;
}

/**
 * Restore operation result
 */
export interface CursorRestoreResult {
  success: boolean;
  backupId: string;
  restoredFiles: string[];
  errors: DeploymentError[];
  warnings: DeploymentWarning[];
  metadata?: BackupMetadata;
}

/**
 * Backed up file information
 */
export interface BackedUpFile {
  component: CursorComponentType;
  originalPath: string;
  backupPath: string;
  relativePath: string;
  size: number;
  timestamp: string;
}

/**
 * Backup metadata
 */
export interface BackupMetadata {
  backupId: string;
  deploymentId: string;
  timestamp: string;
  options: CursorDeploymentOptions;
  components: CursorComponentType[];
  backedUpFiles: BackedUpFile[];
  version: string;
}

/**
 * Backup information for listing
 */
export interface BackupInfo {
  backupId: string;
  deploymentId: string;
  timestamp: string;
  components: CursorComponentType[];
  fileCount: number;
  size: number;
  created: Date;
}