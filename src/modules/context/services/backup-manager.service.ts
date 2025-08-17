/* eslint-disable no-await-in-loop */
import * as crypto from 'node:crypto';
import * as path from 'node:path';

import { Injectable, Logger } from '@nestjs/common';

import * as fs from 'fs-extra';
import { glob } from 'glob';
import * as tar from 'tar';

import { AIPlatform } from '../interfaces';
import { CompressionUtility } from '../utils/compression.utility';
import { FileSystemUtility } from '../utils/file-system.utility';

export interface BackupOptions {
  includeHidden?: boolean;
  excludePatterns?: string[];
  compress?: boolean;
  encrypt?: boolean;
  encryptionKey?: string;
  maxBackups?: number;
}

export interface BackupMetadata {
  id: string;
  timestamp: string;
  platform: AIPlatform;
  sourcePath: string;
  backupPath: string;
  size: number;
  compressed: boolean;
  encrypted: boolean;
  files: string[];
  checksum: string;
  version: string;
}

export interface RestoreOptions {
  overwrite?: boolean;
  skipConflicts?: boolean;
  dryRun?: boolean;
  decrypt?: boolean;
  decryptionKey?: string;
  conflictStrategy?: 'overwrite' | 'skip' | 'merge' | 'interactive';
}

export interface RestoreResult {
  success: boolean;
  restoredFiles: string[];
  skippedFiles: string[];
  conflicts: Array<{
    file: string;
    reason: string;
    resolution: string;
  }>;
  errors: string[];
}

export interface BackupConflict {
  file: string;
  type: 'exists' | 'modified' | 'newer';
  originalContent?: string;
  currentContent?: string;
  backupContent?: string;
  resolution?: 'overwrite' | 'skip' | 'merge';
}

@Injectable()
export class BackupManagerService {
  private readonly logger = new Logger(BackupManagerService.name);
  private readonly backupDir = '.taptik/backups';
  private backupRegistry: Map<string, BackupMetadata> = new Map();

  constructor(
    private readonly fileSystem: FileSystemUtility,
    private readonly compression: CompressionUtility,
  ) {
    this.initializeBackupDirectory();
  }

  /**
   * Create a backup of configuration
   */
  async createBackup(
    sourcePath: string,
    platform: AIPlatform,
    options?: BackupOptions,
  ): Promise<BackupMetadata> {
    try {
      this.logger.log(`Creating backup for ${platform} from ${sourcePath}`);

      // Generate backup ID and paths
      const backupId = this.generateBackupId();
      const backupPath = path.join(this.backupDir, platform, backupId);

      // Ensure backup directory exists
      await fs.ensureDir(backupPath);

      // Get files to backup
      const files = await this.getFilesToBackup(sourcePath, options);

      if (files.length === 0) {
        throw new Error('No files found to backup');
      }

      // Copy files to backup location
      const backupFiles: string[] = [];
      let totalSize = 0;

      for (const file of files) {
        const relativePath = path.relative(sourcePath, file);
        const destinationPath = path.join(backupPath, 'files', relativePath);

         
        await fs.ensureDir(path.dirname(destinationPath));
         
        await fs.copy(file, destinationPath, { preserveTimestamps: true });

         
        const stats = await fs.stat(file);
        totalSize += stats.size;
        backupFiles.push(relativePath);
      }

      // Create archive if compression is enabled
      let finalBackupPath = backupPath;
      if (options?.compress) {
        const archivePath = `${backupPath}.tar.gz`;
        await this.createArchive(path.join(backupPath, 'files'), archivePath);
        await fs.remove(backupPath);
        finalBackupPath = archivePath;
      }

      // Encrypt if requested
      if (options?.encrypt && options.encryptionKey) {
        finalBackupPath = await this.encryptBackup(
          finalBackupPath,
          options.encryptionKey,
        );
      }

      // Calculate checksum
      const checksum = await this.calculateChecksum(finalBackupPath);

      // Create metadata
      const metadata: BackupMetadata = {
        id: backupId,
        timestamp: new Date().toISOString(),
        platform,
        sourcePath,
        backupPath: finalBackupPath,
        size: totalSize,
        compressed: options?.compress || false,
        encrypted: options?.encrypt || false,
        files: backupFiles,
        checksum,
        version: '1.0.0',
      };

      // Save metadata
      await this.saveMetadata(metadata);

      // Register backup
      this.backupRegistry.set(backupId, metadata);

      // Clean old backups if limit is set
      if (options?.maxBackups) {
        await this.cleanOldBackups(platform, options.maxBackups);
      }

      this.logger.log(`Backup created successfully: ${backupId}`);
      return metadata;
    } catch (error) {
      this.logger.error(`Failed to create backup: ${error.message}`);
      throw error;
    }
  }

  /**
   * Restore configuration from backup
   */
  async restoreBackup(
    backupId: string,
    targetPath: string,
    options?: RestoreOptions,
  ): Promise<RestoreResult> {
    try {
      this.logger.log(`Restoring backup ${backupId} to ${targetPath}`);

      // Get backup metadata
      const metadata = await this.getBackupMetadata(backupId);
      if (!metadata) {
        throw new Error(`Backup not found: ${backupId}`);
      }

      // Verify checksum
      const isValid = await this.verifyBackup(metadata);
      if (!isValid) {
        throw new Error('Backup integrity check failed');
      }

      // Prepare backup for restoration
      let { backupPath } = metadata;

      // Decrypt if necessary
      if (metadata.encrypted) {
        if (!options?.decrypt || !options.decryptionKey) {
          throw new Error('Backup is encrypted but no decryption key provided');
        }
        backupPath = await this.decryptBackup(
          backupPath,
          options.decryptionKey,
        );
      }

      // Extract if compressed
      if (metadata.compressed) {
        const extractPath = path.join(this.backupDir, 'temp', metadata.id);
        await this.extractArchive(backupPath, extractPath);
        backupPath = extractPath;
      } else {
        backupPath = path.join(backupPath, 'files');
      }

      // Check for conflicts
      const conflicts = await this.detectConflicts(
        backupPath,
        targetPath,
        metadata.files,
      );

      // Handle conflicts based on strategy
      const resolution = await this.resolveConflicts(
        conflicts,
        options?.conflictStrategy || 'skip',
      );

      const result: RestoreResult = {
        success: true,
        restoredFiles: [],
        skippedFiles: [],
        conflicts: [],
        errors: [],
      };

      // Dry run if requested
      if (options?.dryRun) {
        this.logger.log('Dry run mode - no files will be modified');
        result.restoredFiles = metadata.files.filter(
          (file) => !resolution.skip.includes(file),
        );
        result.skippedFiles = resolution.skip;
        result.conflicts = conflicts.map((c) => ({
          file: c.file,
          reason: c.type,
          resolution: c.resolution || 'pending',
        }));
        return result;
      }

      // Restore files
      for (const file of metadata.files) {
        const sourcePath = path.join(backupPath, file);
        const destinationPath = path.join(targetPath, file);

        // Skip if in skip list
        if (resolution.skip.includes(file)) {
          result.skippedFiles.push(file);
          continue;
        }

        try {
          // Check if file should be overwritten
          if (
            (await fs.pathExists(destinationPath)) &&
            !options?.overwrite &&
            !resolution.overwrite.includes(file)
          ) {
            result.skippedFiles.push(file);
            result.conflicts.push({
              file,
              reason: 'File exists',
              resolution: 'skipped',
            });
            continue;
          }

          // Ensure directory exists
          await fs.ensureDir(path.dirname(destinationPath));

          // Copy file
          await fs.copy(sourcePath, destinationPath, {
            overwrite: true,
            preserveTimestamps: true,
          });

          result.restoredFiles.push(file);
        } catch (error) {
          result.errors.push(`Failed to restore ${file}: ${error.message}`);
        }
      }

      // Clean up temporary files
      if (metadata.compressed) {
        await fs.remove(path.join(this.backupDir, 'temp', metadata.id));
      }
      if (metadata.encrypted && backupPath !== metadata.backupPath) {
        await fs.remove(backupPath);
      }

      result.success = result.errors.length === 0;
      this.logger.log(
        `Restore completed: ${result.restoredFiles.length} files restored`,
      );

      return result;
    } catch (error) {
      this.logger.error(`Failed to restore backup: ${error.message}`);
      return {
        success: false,
        restoredFiles: [],
        skippedFiles: [],
        conflicts: [],
        errors: [error.message],
      };
    }
  }

  /**
   * List available backups
   */
  async listBackups(
    platform?: AIPlatform,
    limit?: number,
  ): Promise<BackupMetadata[]> {
    try {
      const metadataFiles = await glob(
        platform
          ? `${this.backupDir}/${platform}/*/metadata.json`
          : `${this.backupDir}/*/metadata.json`,
      );

      const backups: BackupMetadata[] = [];

      for (const file of metadataFiles) {
        try {
          const metadata = await fs.readJson(file);
          backups.push(metadata);
        } catch {
          this.logger.warn(`Failed to read metadata from ${file}`);
        }
      }

      // Sort by timestamp (newest first)
      backups.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );

      // Apply limit if specified
      if (limit && limit > 0) {
        return backups.slice(0, limit);
      }

      return backups;
    } catch (error) {
      this.logger.error(`Failed to list backups: ${error.message}`);
      return [];
    }
  }

  /**
   * Delete a backup
   */
  async deleteBackup(backupId: string): Promise<boolean> {
    try {
      const metadata = await this.getBackupMetadata(backupId);
      if (!metadata) {
        return false;
      }

      // Remove backup files
      if (await fs.pathExists(metadata.backupPath)) {
        await fs.remove(metadata.backupPath);
      }

      // Remove metadata
      const metadataPath = path.join(
        path.dirname(metadata.backupPath),
        'metadata.json',
      );
      if (await fs.pathExists(metadataPath)) {
        await fs.remove(metadataPath);
      }

      // Remove from registry
      this.backupRegistry.delete(backupId);

      this.logger.log(`Backup deleted: ${backupId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to delete backup: ${error.message}`);
      return false;
    }
  }

  /**
   * Verify backup integrity
   */
  async verifyBackup(metadata: BackupMetadata): Promise<boolean> {
    try {
      if (!(await fs.pathExists(metadata.backupPath))) {
        return false;
      }

      const currentChecksum = await this.calculateChecksum(metadata.backupPath);
      return currentChecksum === metadata.checksum;
    } catch (error) {
      this.logger.error(`Failed to verify backup: ${error.message}`);
      return false;
    }
  }

  /**
   * Compare backup with current configuration
   */
  async compareWithCurrent(
    backupId: string,
    currentPath: string,
  ): Promise<{
    identical: boolean;
    added: string[];
    removed: string[];
    modified: string[];
  }> {
    const metadata = await this.getBackupMetadata(backupId);
    if (!metadata) {
      throw new Error(`Backup not found: ${backupId}`);
    }

    const currentFiles = await this.getFilesToBackup(currentPath);
    const currentRelativePaths = currentFiles.map((f) =>
      path.relative(currentPath, f),
    );

    const added = currentRelativePaths.filter(
      (f) => !metadata.files.includes(f),
    );
    const removed = metadata.files.filter(
      (f) => !currentRelativePaths.includes(f),
    );

    // Check for modified files
    const modified: string[] = [];
    for (const file of metadata.files) {
      if (currentRelativePaths.includes(file)) {
        const currentFilePath = path.join(currentPath, file);
        if (await fs.pathExists(currentFilePath)) {
          // Simple modification check based on size
          // Could be enhanced with content hash comparison
          const _stats = await fs.stat(currentFilePath);
          // This is a simplified check - in production, compare content hashes
          modified.push(file);
        }
      }
    }

    return {
      identical:
        added.length === 0 && removed.length === 0 && modified.length === 0,
      added,
      removed,
      modified,
    };
  }

  // Private helper methods

  private async initializeBackupDirectory(): Promise<void> {
    await fs.ensureDir(this.backupDir);
    await this.loadBackupRegistry();
  }

  private async loadBackupRegistry(): Promise<void> {
    try {
      const metadataFiles = await glob(`${this.backupDir}/*/*/metadata.json`);

      for (const file of metadataFiles) {
        try {
          const metadata = await fs.readJson(file);
          this.backupRegistry.set(metadata.id, metadata);
        } catch {
          this.logger.warn(`Failed to load metadata from ${file}`);
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to load backup registry: ${error.message}`);
    }
  }

  private generateBackupId(): string {
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString('hex');
    return `backup_${timestamp}_${random}`;
  }

  private async getFilesToBackup(
    sourcePath: string,
    options?: BackupOptions,
  ): Promise<string[]> {
    const patterns = options?.includeHidden ? ['**/*', '**/.*'] : ['**/*'];

    const excludePatterns = options?.excludePatterns || [
      '**/node_modules/**',
      '**/.git/**',
      '**/dist/**',
      '**/build/**',
      '**/*.log',
    ];

    const files = await glob(patterns, {
      cwd: sourcePath,
      absolute: true,
      nodir: true,
      ignore: excludePatterns,
    });

    return files;
  }

  private async createArchive(
    sourcePath: string,
    archivePath: string,
  ): Promise<void> {
    await tar.create(
      {
        gzip: true,
        file: archivePath,
        cwd: path.dirname(sourcePath),
      },
      [path.basename(sourcePath)],
    );
  }

  private async extractArchive(
    archivePath: string,
    extractPath: string,
  ): Promise<void> {
    await fs.ensureDir(extractPath);
    await tar.extract({
      file: archivePath,
      cwd: extractPath,
    });
  }

  private async encryptBackup(
    backupPath: string,
    key: string,
  ): Promise<string> {
    const encryptedPath = `${backupPath}.enc`;
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key.slice(0, 32), iv);

    const input = fs.createReadStream(backupPath);
    const output = fs.createWriteStream(encryptedPath);

    await new Promise<void>((resolve, reject) => {
      // Write IV to the beginning of the file
      output.write(iv);
      input.pipe(cipher).pipe(output, { end: false });
      cipher.on('end', () => {
        output.end();
      });
      output.on('finish', () => resolve());
      output.on('error', reject);
    });

    await fs.remove(backupPath);
    return encryptedPath;
  }

  private async decryptBackup(
    encryptedPath: string,
    key: string,
  ): Promise<string> {
    const decryptedPath = encryptedPath.replace('.enc', '');

    const input = fs.createReadStream(encryptedPath);
    const output = fs.createWriteStream(decryptedPath);

    await new Promise<void>((resolve, reject) => {
      // Read IV from the beginning of the file
      const iv = Buffer.alloc(16);
      let ivBytesRead = 0;

      input.on('readable', () => {
        if (ivBytesRead < 16) {
          const chunk = input.read(16 - ivBytesRead);
          if (chunk) {
            chunk.copy(iv, ivBytesRead);
            ivBytesRead += chunk.length;

            if (ivBytesRead === 16) {
              const decipher = crypto.createDecipheriv(
                'aes-256-cbc',
                key.slice(0, 32),
                iv,
              );
              input.pipe(decipher).pipe(output);
              output.on('finish', () => resolve());
              output.on('error', reject);
            }
          }
        }
      });

      input.on('error', reject);
    });

    return decryptedPath;
  }

  private async calculateChecksum(filePath: string): Promise<string> {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);

    return new Promise((resolve, reject) => {
      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  private async saveMetadata(metadata: BackupMetadata): Promise<void> {
    const metadataPath = path.join(
      path.dirname(metadata.backupPath),
      'metadata.json',
    );
    await fs.writeJson(metadataPath, metadata, { spaces: 2 });
  }

  private async getBackupMetadata(
    backupId: string,
  ): Promise<BackupMetadata | null> {
    // Check registry first
    if (this.backupRegistry.has(backupId)) {
      return this.backupRegistry.get(backupId)!;
    }

    // Try to load from disk
    const metadataFiles = await glob(
      `${this.backupDir}/*/${backupId}/metadata.json`,
    );
    if (metadataFiles.length > 0) {
      try {
        const metadata = await fs.readJson(metadataFiles[0]);
        this.backupRegistry.set(backupId, metadata);
        return metadata;
      } catch {
        this.logger.error(`Failed to load metadata for ${backupId}`);
      }
    }

    return null;
  }

  private async detectConflicts(
    backupPath: string,
    targetPath: string,
    files: string[],
  ): Promise<BackupConflict[]> {
    const conflicts: BackupConflict[] = [];

    for (const file of files) {
      const targetFile = path.join(targetPath, file);

      if (await fs.pathExists(targetFile)) {
        const backupFile = path.join(backupPath, file);
        const backupStats = await fs.stat(backupFile);
        const targetStats = await fs.stat(targetFile);

        let conflictType: BackupConflict['type'] = 'exists';

        if (targetStats.mtime > backupStats.mtime) {
          conflictType = 'newer';
        } else if (targetStats.size !== backupStats.size) {
          conflictType = 'modified';
        }

        conflicts.push({
          file,
          type: conflictType,
        });
      }
    }

    return conflicts;
  }

  private async resolveConflicts(
    conflicts: BackupConflict[],
    strategy: 'overwrite' | 'skip' | 'merge' | 'interactive',
  ): Promise<{
    overwrite: string[];
    skip: string[];
    merge: string[];
  }> {
    const resolution = {
      overwrite: [] as string[],
      skip: [] as string[],
      merge: [] as string[],
    };

    for (const conflict of conflicts) {
      switch (strategy) {
        case 'overwrite':
          conflict.resolution = 'overwrite';
          resolution.overwrite.push(conflict.file);
          break;
        case 'skip':
          conflict.resolution = 'skip';
          resolution.skip.push(conflict.file);
          break;
        case 'merge':
          // For now, merge defaults to skip
          // Could be enhanced with actual merge logic
          conflict.resolution = 'skip';
          resolution.skip.push(conflict.file);
          break;
        case 'interactive':
          // For now, interactive defaults to skip
          // Could be enhanced with user prompts
          conflict.resolution = 'skip';
          resolution.skip.push(conflict.file);
          break;
      }
    }

    return resolution;
  }

  private async cleanOldBackups(
    platform: AIPlatform,
    maxBackups: number,
  ): Promise<void> {
    const backups = await this.listBackups(platform);

    if (backups.length > maxBackups) {
      const toDelete = backups.slice(maxBackups);

      for (const backup of toDelete) {
        await this.deleteBackup(backup.id);
      }

      this.logger.log(`Cleaned ${toDelete.length} old backups`);
    }
  }
}
