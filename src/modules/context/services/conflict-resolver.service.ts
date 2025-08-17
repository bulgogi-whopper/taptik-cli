/* eslint-disable no-await-in-loop */
import { createHash } from 'node:crypto';
import * as path from 'node:path';

import { Injectable, Logger } from '@nestjs/common';

import * as diff from 'diff';
import * as fs from 'fs-extra';

export enum ConflictStrategy {
  OVERWRITE = 'overwrite',
  MERGE = 'merge',
  SKIP = 'skip',
  INTERACTIVE = 'interactive',
  BACKUP = 'backup',
}

export interface FileConflict {
  path: string;
  type: 'exists' | 'modified' | 'newer' | 'type_mismatch';
  existingContent?: string;
  incomingContent?: string;
  existingMeta?: {
    size: number;
    mtime: Date;
    hash: string;
  };
  incomingMeta?: {
    size: number;
    hash: string;
  };
  resolution?: ConflictStrategy;
  resolvedContent?: string;
}

export interface ConflictResolution {
  strategy: ConflictStrategy;
  conflicts: FileConflict[];
  resolved: FileConflict[];
  skipped: FileConflict[];
  errors: string[];
}

export interface MergeOptions {
  preserveComments?: boolean;
  deepMerge?: boolean;
  arrayStrategy?: 'replace' | 'concat' | 'unique';
  customMerger?: (existing: any, incoming: any) => any;
}

@Injectable()
export class ConflictResolverService {
  private readonly logger = new Logger(ConflictResolverService.name);

  /**
   * Detect conflicts between existing and incoming files
   */
  async detectConflicts(
    targetPath: string,
    incomingFiles: Map<string, string | Buffer>,
  ): Promise<FileConflict[]> {
    const conflicts: FileConflict[] = [];

    for (const [relativePath, content] of incomingFiles.entries()) {
      const fullPath = path.join(targetPath, relativePath);

      if (await fs.pathExists(fullPath)) {
        const conflict = await this.analyzeConflict(fullPath, content);
        if (conflict) {
          conflict.path = relativePath;
          conflicts.push(conflict);
        }
      }
    }

    return conflicts;
  }

  /**
   * Resolve conflicts based on strategy
   */
  async resolveConflicts(
    conflicts: FileConflict[],
    strategy: ConflictStrategy,
    options?: {
      backupPath?: string;
      mergeOptions?: MergeOptions;
      interactiveCallback?: (
        conflict: FileConflict,
      ) => Promise<ConflictStrategy>;
    },
  ): Promise<ConflictResolution> {
    const resolution: ConflictResolution = {
      strategy,
      conflicts,
      resolved: [],
      skipped: [],
      errors: [],
    };

    for (const conflict of conflicts) {
      try {
        let resolvedStrategy = strategy;

        // Handle interactive strategy
        if (
          strategy === ConflictStrategy.INTERACTIVE &&
          options?.interactiveCallback
        ) {
          resolvedStrategy = await options.interactiveCallback(conflict);
        }

        conflict.resolution = resolvedStrategy;

        switch (resolvedStrategy) {
          case ConflictStrategy.OVERWRITE:
            conflict.resolvedContent = conflict.incomingContent;
            resolution.resolved.push(conflict);
            break;

          case ConflictStrategy.SKIP:
            resolution.skipped.push(conflict);
            break;

          case ConflictStrategy.MERGE:
            const merged = await this.mergeContents(
              conflict,
              options?.mergeOptions,
            );
            if (merged) {
              conflict.resolvedContent = merged;
              resolution.resolved.push(conflict);
            } else {
              resolution.errors.push(`Failed to merge ${conflict.path}`);
              resolution.skipped.push(conflict);
            }
            break;

          case ConflictStrategy.BACKUP:
            if (options?.backupPath) {
              await this.createBackup(conflict, options.backupPath);
            }
            conflict.resolvedContent = conflict.incomingContent;
            resolution.resolved.push(conflict);
            break;

          default:
            resolution.skipped.push(conflict);
        }
      } catch (error) {
        resolution.errors.push(
          `Error resolving ${conflict.path}: ${error.message}`,
        );
        resolution.skipped.push(conflict);
      }
    }

    return resolution;
  }

  /**
   * Apply resolved conflicts to filesystem
   */
  async applyResolutions(
    targetPath: string,
    resolutions: FileConflict[],
  ): Promise<{ applied: string[]; failed: string[] }> {
    const applied: string[] = [];
    const failed: string[] = [];

    for (const resolution of resolutions) {
      if (!resolution.resolvedContent) {
        continue;
      }

      const fullPath = path.join(targetPath, resolution.path);

      try {
        await fs.ensureDir(path.dirname(fullPath));

        await (typeof resolution.resolvedContent === 'string'
          ? fs.writeFile(fullPath, resolution.resolvedContent, 'utf8')
          : fs.writeFile(fullPath, resolution.resolvedContent));

        applied.push(resolution.path);
      } catch (error) {
        this.logger.error(
          `Failed to apply resolution for ${resolution.path}: ${error.message}`,
        );
        failed.push(resolution.path);
      }
    }

    return { applied, failed };
  }

  /**
   * Generate conflict report
   */
  generateReport(resolution: ConflictResolution): string {
    const lines: string[] = [
      '=== Conflict Resolution Report ===',
      `Strategy: ${resolution.strategy}`,
      `Total conflicts: ${resolution.conflicts.length}`,
      `Resolved: ${resolution.resolved.length}`,
      `Skipped: ${resolution.skipped.length}`,
      `Errors: ${resolution.errors.length}`,
      '',
    ];

    if (resolution.resolved.length > 0) {
      lines.push('--- Resolved Conflicts ---');
      for (const conflict of resolution.resolved) {
        lines.push(
          `✓ ${conflict.path} (${conflict.type}) -> ${conflict.resolution}`,
        );
      }
      lines.push('');
    }

    if (resolution.skipped.length > 0) {
      lines.push('--- Skipped Conflicts ---');
      for (const conflict of resolution.skipped) {
        lines.push(`○ ${conflict.path} (${conflict.type})`);
      }
      lines.push('');
    }

    if (resolution.errors.length > 0) {
      lines.push('--- Errors ---');
      for (const error of resolution.errors) {
        lines.push(`✗ ${error}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Create a three-way merge for text files
   */
  async threeWayMerge(
    base: string,
    ours: string,
    theirs: string,
  ): Promise<{ merged: string; conflicts: number }> {
    const patches = diff.createPatch('file', base, theirs);
    const applied = diff.applyPatch(ours, patches);

    if (applied === false) {
      // Fallback to line-by-line merge
      const ourLines = ours.split('\n');
      const theirLines = theirs.split('\n');
      const baseLines = base.split('\n');

      const merged = this.mergeLines(baseLines, ourLines, theirLines);
      return merged;
    }

    return {
      merged: applied as string,
      conflicts: 0,
    };
  }

  /**
   * Analyze file differences
   */
  analyzeDifferences(
    existing: string,
    incoming: string,
  ): {
    additions: number;
    deletions: number;
    modifications: number;
    similarity: number;
  } {
    const changes = diff.diffLines(existing, incoming);

    let additions = 0;
    let deletions = 0;
    let modifications = 0;
    let unchanged = 0;

    for (const change of changes) {
      const lineCount = change.count || 0;

      if (change.added) {
        additions += lineCount;
      } else if (change.removed) {
        deletions += lineCount;
      } else {
        unchanged += lineCount;
      }
    }

    // Count modifications as min of additions and deletions
    modifications = Math.min(additions, deletions);
    additions -= modifications;
    deletions -= modifications;

    const totalLines = unchanged + additions + deletions + modifications;
    const similarity = totalLines > 0 ? (unchanged / totalLines) * 100 : 100;

    return {
      additions,
      deletions,
      modifications,
      similarity,
    };
  }

  // Private helper methods

  private async analyzeConflict(
    existingPath: string,
    incomingContent: string | Buffer,
  ): Promise<FileConflict | null> {
    try {
      const stats = await fs.stat(existingPath);
      const existingContent = await fs.readFile(existingPath);

      // Compare contents
      const existingString = existingContent.toString();
      const incomingString = incomingContent.toString();

      if (existingString === incomingString) {
        return null; // No conflict, identical content
      }

      const existingHash = this.hashContent(existingContent);
      const incomingHash = this.hashContent(incomingContent);

      return {
        path: existingPath,
        type: 'modified',
        existingContent: existingString,
        incomingContent: incomingString,
        existingMeta: {
          size: stats.size,
          mtime: stats.mtime,
          hash: existingHash,
        },
        incomingMeta: {
          size: Buffer.byteLength(incomingContent),
          hash: incomingHash,
        },
      };
    } catch (error) {
      this.logger.warn(
        `Failed to analyze conflict for ${existingPath}: ${error.message}`,
      );
      return null;
    }
  }

  private async mergeContents(
    conflict: FileConflict,
    options?: MergeOptions,
  ): Promise<string | null> {
    if (!conflict.existingContent || !conflict.incomingContent) {
      return null;
    }

    const extension = path.extname(conflict.path).toLowerCase();

    // Handle JSON files
    if (extension === '.json') {
      try {
        const existing = JSON.parse(conflict.existingContent);
        const incoming = JSON.parse(conflict.incomingContent);
        const merged = this.mergeJson(existing, incoming, options);
        return JSON.stringify(merged, null, 2);
      } catch (error) {
        this.logger.warn(
          `Failed to merge JSON for ${conflict.path}: ${error.message}`,
        );
        return null;
      }
    }

    // Handle markdown files
    if (extension === '.md') {
      return this.mergeMarkdown(
        conflict.existingContent,
        conflict.incomingContent,
        options,
      );
    }

    // Handle text files with line-by-line merge
    if (this.isTextFile(conflict.path)) {
      const result = await this.threeWayMerge(
        '', // No base version available
        conflict.existingContent,
        conflict.incomingContent,
      );
      return result.merged;
    }

    // Binary files cannot be merged
    return null;
  }

  private mergeJson(existing: any, incoming: any, options?: MergeOptions): any {
    if (options?.customMerger) {
      return options.customMerger(existing, incoming);
    }

    if (!options?.deepMerge) {
      return { ...existing, ...incoming };
    }

    const merged: any = { ...existing };

    for (const key in incoming) {
      if (!(key in existing)) {
        merged[key] = incoming[key];
      } else if (Array.isArray(existing[key]) && Array.isArray(incoming[key])) {
        merged[key] = this.mergeArrays(existing[key], incoming[key], options);
      } else if (
        typeof existing[key] === 'object' &&
        typeof incoming[key] === 'object' &&
        existing[key] !== null &&
        incoming[key] !== null
      ) {
        merged[key] = this.mergeJson(existing[key], incoming[key], options);
      } else {
        merged[key] = incoming[key];
      }
    }

    return merged;
  }

  private mergeArrays(
    existing: any[],
    incoming: any[],
    options?: MergeOptions,
  ): any[] {
    switch (options?.arrayStrategy) {
      case 'concat':
        return [...existing, ...incoming];

      case 'unique':
        return [...new Set([...existing, ...incoming])];

      case 'replace':
      default:
        return incoming;
    }
  }

  private mergeMarkdown(
    existing: string,
    incoming: string,
    options?: MergeOptions,
  ): string {
    // Simple strategy: append incoming content with separator
    const separator = '\n\n---\n\n';

    if (options?.preserveComments) {
      // Preserve existing comments at the top
      const existingComments = this.extractComments(existing);
      const incomingWithoutComments = this.removeComments(incoming);
      return existingComments + separator + incomingWithoutComments;
    }

    return existing + separator + incoming;
  }

  private mergeLines(
    base: string[],
    ours: string[],
    theirs: string[],
  ): { merged: string; conflicts: number } {
    const merged: string[] = [];
    let conflicts = 0;
    let i = 0,
      j = 0;

    while (i < ours.length || j < theirs.length) {
      if (i >= ours.length) {
        merged.push(...theirs.slice(j));
        break;
      }
      if (j >= theirs.length) {
        merged.push(...ours.slice(i));
        break;
      }

      if (ours[i] === theirs[j]) {
        merged.push(ours[i]);
        i++;
        j++;
      } else {
        // Conflict detected
        conflicts++;
        merged.push('<<<<<<< OURS');
        merged.push(ours[i]);
        merged.push('=======');
        merged.push(theirs[j]);
        merged.push('>>>>>>> THEIRS');
        i++;
        j++;
      }
    }

    return {
      merged: merged.join('\n'),
      conflicts,
    };
  }

  private async createBackup(
    conflict: FileConflict,
    backupPath: string,
  ): Promise<void> {
    if (!conflict.existingContent) {
      return;
    }

    const backupFile = path.join(
      backupPath,
      `${conflict.path}.backup.${Date.now()}`,
    );

    await fs.ensureDir(path.dirname(backupFile));
    await fs.writeFile(backupFile, conflict.existingContent, 'utf8');

    this.logger.log(`Created backup for ${conflict.path} at ${backupFile}`);
  }

  private hashContent(content: string | Buffer): string {
    const hash = createHash('sha256');
    hash.update(content);
    return hash.digest('hex');
  }

  private isTextFile(filePath: string): boolean {
    const textExtensions = [
      '.txt',
      '.md',
      '.json',
      '.js',
      '.ts',
      '.jsx',
      '.tsx',
      '.css',
      '.scss',
      '.html',
      '.xml',
      '.yaml',
      '.yml',
      '.toml',
      '.ini',
      '.conf',
      '.sh',
      '.bash',
      '.zsh',
      '.py',
      '.rb',
      '.go',
      '.rs',
      '.java',
      '.c',
      '.cpp',
      '.h',
      '.hpp',
      '.cs',
      '.php',
      '.sql',
      '.graphql',
    ];

    const extension = path.extname(filePath).toLowerCase();
    return textExtensions.includes(extension);
  }

  private extractComments(content: string): string {
    const lines = content.split('\n');
    const comments: string[] = [];

    for (const line of lines) {
      if (line.trim().startsWith('<!--') || line.trim().startsWith('//')) {
        comments.push(line);
      } else if (line.trim() && !line.trim().startsWith('#')) {
        break; // Stop at first non-comment line
      }
    }

    return comments.join('\n') + (comments.length > 0 ? '\n' : '');
  }

  private removeComments(content: string): string {
    const lines = content.split('\n');
    const withoutComments: string[] = [];
    let inComment = false;

    for (const line of lines) {
      if (line.trim().startsWith('<!--')) {
        inComment = true;
      }

      if (!inComment && !line.trim().startsWith('//')) {
        withoutComments.push(line);
      }

      if (line.trim().endsWith('-->')) {
        inComment = false;
      }
    }

    return withoutComments.join('\n');
  }
}
