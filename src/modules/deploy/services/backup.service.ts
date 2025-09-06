import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { Injectable } from '@nestjs/common';

export interface BackupManifest {
  originalPath: string;
  backupPath: string;
  timestamp: number;
  files?: Array<{
    originalPath: string;
    backupPath: string;
  }>;
  components?: {
    [key: string]: {
      originalPath: string;
      backupPath: string;
      timestamp: number;
      dependencies?: string[];
    };
  };
}

export interface BackupInfo {
  filename: string;
  path: string;
  size: number;
  created: Date;
}

@Injectable()
export class BackupService {
  // FIXME: 백업 경로 수정
  protected readonly backupDir = path.join(os.homedir(), '.taptik', 'backups');

  async createBackup(filePath: string): Promise<string> {
    try {
      // Ensure backup directory exists
      await this.ensureBackupDirectory();

      // Read original file
      const content = await fs.readFile(filePath, 'utf8');

      // Generate backup filename with timestamp (YYYYMMDD_HHMMSS format)
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      const timestamp = `${year}${month}${day}_${hours}${minutes}${seconds}`;
      const backupFilename = `backup_${timestamp}.json`;
      const backupPath = path.join(this.backupDir, backupFilename);

      // Write backup file
      await fs.writeFile(backupPath, content);

      // Create manifest
      const manifestPath = path.join(
        this.backupDir,
        `manifest_${timestamp}.json`,
      );
      const manifest: BackupManifest = {
        originalPath: filePath,
        backupPath,
        timestamp: Date.now(),
      };
      await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

      return backupPath;
    } catch (error) {
      throw new Error(`Failed to create backup: ${(error as Error).message}`);
    }
  }

  async rollback(backupPath: string): Promise<void> {
    try {
      // Read manifest
      const manifestPath = backupPath.replace(/backup_/, 'manifest_');
      const manifestContent = await fs.readFile(manifestPath, 'utf8');
      const manifest: BackupManifest = JSON.parse(manifestContent);

      // Read backup content
      const backupContent = await fs.readFile(backupPath);

      // Convert to string if it's a Buffer
      const contentString =
        typeof backupContent === 'string'
          ? backupContent
          : backupContent.toString('utf8');

      // Validate JSON
      JSON.parse(contentString);

      // Restore to original path
      await fs.writeFile(manifest.originalPath, contentString);
    } catch (error) {
      throw new Error(`Failed to rollback: ${(error as Error).message}`);
    }
  }

  async rollbackComponent(
    manifestPath: string,
    componentType: string,
  ): Promise<void> {
    try {
      const manifestContent = await fs.readFile(manifestPath, 'utf8');
      const manifest: BackupManifest = JSON.parse(manifestContent);

      if (!manifest.components || !manifest.components[componentType]) {
        throw new Error(
          `Component ${componentType} not found in backup manifest`,
        );
      }

      const component = manifest.components[componentType];
      const backupContent = await fs.readFile(component.backupPath);
      const contentString =
        typeof backupContent === 'string'
          ? backupContent
          : backupContent.toString('utf8');

      await fs.writeFile(component.originalPath, contentString);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw error;
      }
      throw new Error(
        `Failed to rollback component: ${(error as Error).message}`,
      );
    }
  }

  async rollbackWithDependencies(
    manifestPath: string,
    componentType: string,
  ): Promise<void> {
    try {
      const manifestContent = await fs.readFile(manifestPath, 'utf8');
      const manifest: BackupManifest = JSON.parse(manifestContent);

      if (!manifest.components) {
        throw new Error('No components found in backup manifest');
      }

      const rolledBack = new Set<string>();
      await this.rollbackComponentRecursive(
        manifest,
        componentType,
        rolledBack,
      );
    } catch (error) {
      throw new Error(
        `Failed to rollback with dependencies: ${(error as Error).message}`,
      );
    }
  }

  async cleanupOldBackups(retentionDays: number): Promise<void> {
    try {
      const files = await fs.readdir(this.backupDir);
      const now = Date.now();
      const retentionMs = retentionDays * 24 * 60 * 60 * 1000;

      // Filter backup files first
      const backupFiles = files.filter((file) => file.startsWith('backup_'));

      // Get stats for all files in parallel
      const fileStatsPromises = backupFiles.map(async (file) => {
        const filePath = path.join(this.backupDir, file);
        try {
          const stats = await fs.stat(filePath);
          return { filePath, stats, file };
        } catch (_error) {
          // If file doesn't exist or can't be accessed, skip it
          return null;
        }
      });

      const fileStatsResults = await Promise.allSettled(fileStatsPromises);

      // Collect files to delete
      const filesToDelete: string[] = [];
      for (const result of fileStatsResults) {
        if (result.status === 'fulfilled' && result.value) {
          const { filePath, stats } = result.value;
          if (stats.isFile() && now - stats.mtime.getTime() > retentionMs) {
            filesToDelete.push(filePath);
          }
        }
      }

      // Delete files in parallel
      const deletePromises = filesToDelete.map((filePath) =>
        fs.rm(filePath, { force: true }),
      );

      await Promise.allSettled(deletePromises);
    } catch (error) {
      throw new Error(
        `Failed to cleanup old backups: ${(error as Error).message}`,
      );
    }
  }

  async getBackupManifest(manifestPath: string): Promise<BackupManifest> {
    try {
      const content = await fs.readFile(manifestPath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      throw new Error(
        `Failed to read backup manifest: ${(error as Error).message}`,
      );
    }
  }

  async listBackups(): Promise<BackupInfo[]> {
    try {
      await this.ensureBackupDirectory();

      const files = await fs.readdir(this.backupDir);

      // Filter backup files first
      const backupFiles = files.filter((file) => file.startsWith('backup_'));

      // Get stats for all files in parallel
      const backupStatsPromises = backupFiles.map(async (file) => {
        const filePath = path.join(this.backupDir, file);
        try {
          const stats = await fs.stat(filePath);
          return {
            filename: file,
            path: filePath,
            size: stats.size,
            created: stats.mtime,
            isFile: stats.isFile(),
          };
        } catch (_error) {
          // If file doesn't exist or can't be accessed, skip it
          return null;
        }
      });

      const backupStatsResults = await Promise.allSettled(backupStatsPromises);

      // Collect successful results that are files
      const backups: BackupInfo[] = [];
      for (const result of backupStatsResults) {
        if (
          result.status === 'fulfilled' &&
          result.value &&
          result.value.isFile
        ) {
          const { filename, path: filePath, size, created } = result.value;
          backups.push({
            filename,
            path: filePath,
            size,
            created,
          });
        }
      }

      return backups.sort((a, b) => b.created.getTime() - a.created.getTime());
    } catch (error) {
      throw new Error(`Failed to list backups: ${(error as Error).message}`);
    }
  }

  private async ensureBackupDirectory(): Promise<void> {
    try {
      await fs.access(this.backupDir);
    } catch {
      await fs.mkdir(this.backupDir, { recursive: true });
    }
  }

  async restore(backupId: string, platform: string): Promise<void> {
    // Implementation for restoring from backup
    const backupPath = path.join(
      os.homedir(),
      '.taptik',
      'backups',
      platform,
      backupId,
    );

    const exists = await this.fileExists(backupPath);
    if (!exists) {
      throw new Error(`Backup not found: ${backupId}`);
    }

    // Read manifest
    const manifestPath = path.join(backupPath, 'manifest.json');
    const manifestData = await fs.readFile(manifestPath, 'utf8');
    const manifest = JSON.parse(manifestData) as BackupManifest;

    // Restore each file in parallel
    if (manifest.files) {
      const restorePromises = manifest.files.map(async (file) => {
        const backupFilePath = path.join(backupPath, file.backupPath);
        const backupData = await fs.readFile(backupFilePath);
        await fs.writeFile(file.originalPath, backupData);
      });

      await Promise.allSettled(restorePromises);
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async rollbackComponentRecursive(
    manifest: BackupManifest,
    componentType: string,
    rolledBack: Set<string>,
  ): Promise<void> {
    if (rolledBack.has(componentType)) {
      return; // Already rolled back, avoid circular dependency
    }

    // Mark as being processed immediately to avoid circular dependency
    rolledBack.add(componentType);

    if (!manifest.components || !manifest.components[componentType]) {
      throw new Error(
        `Component ${componentType} not found in backup manifest`,
      );
    }

    const component = manifest.components[componentType];

    // First rollback dependencies - parallel processing for performance
    if (component.dependencies) {
      const dependencyPromises = component.dependencies
        .filter((dep) => !rolledBack.has(dep))
        .map((dep) =>
          this.rollbackComponentRecursive(manifest, dep, rolledBack),
        );

      await Promise.all(dependencyPromises);
    }

    // Then rollback this component
    const backupContent = await fs.readFile(component.backupPath);
    const contentString =
      typeof backupContent === 'string'
        ? backupContent
        : backupContent.toString('utf8');
    await fs.writeFile(component.originalPath, contentString);
  }
}
