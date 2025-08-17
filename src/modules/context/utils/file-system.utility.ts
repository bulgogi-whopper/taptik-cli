import { promises as fs } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname, resolve } from 'node:path';

import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class FileSystemUtility {
  private readonly logger = new Logger(FileSystemUtility.name);

  /**
   * Check if a file or directory exists
   */
  async exists(path: string): Promise<boolean> {
    try {
      await fs.access(this.resolvePath(path));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if a file exists (alias for exists)
   */
  async fileExists(path: string): Promise<boolean> {
    return this.exists(path);
  }

  /**
   * Read a file as string
   */
  async readFile(path: string): Promise<string> {
    try {
      const resolvedPath = this.resolvePath(path);
      return await fs.readFile(resolvedPath, 'utf8');
    } catch (error) {
      this.logger.error(`Failed to read file ${path}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Write content to a file
   */
  async writeFile(path: string, content: string | Buffer): Promise<void> {
    try {
      const resolvedPath = this.resolvePath(path);
      await this.ensureDir(dirname(resolvedPath));
      await fs.writeFile(resolvedPath, content);
    } catch (error) {
      this.logger.error(`Failed to write file ${path}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Read a JSON file
   */
  async readJson<T = any>(path: string): Promise<T> {
    const content = await this.readFile(path);
    return JSON.parse(content);
  }

  /**
   * Write a JSON file
   */
  async writeJson(path: string, data: any): Promise<void> {
    const content = JSON.stringify(data, null, 2);
    await this.writeFile(path, content);
  }

  /**
   * Read directory contents
   */
  async readDirectory(path: string): Promise<string[]> {
    try {
      const resolvedPath = this.resolvePath(path);
      return await fs.readdir(resolvedPath);
    } catch (error) {
      this.logger.error(`Failed to read directory ${path}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create directory recursively
   */
  async ensureDir(path: string): Promise<void> {
    try {
      const resolvedPath = this.resolvePath(path);
      await fs.mkdir(resolvedPath, { recursive: true });
    } catch (error) {
      this.logger.error(`Failed to create directory ${path}: ${error.message}`);
      throw error;
    }
  }

  // Alias for ensureDir
  async ensureDirectory(path: string): Promise<void> {
    return this.ensureDir(path);
  }

  /**
   * Delete a file
   */
  async deleteFile(path: string): Promise<void> {
    try {
      const resolvedPath = this.resolvePath(path);
      await fs.unlink(resolvedPath);
    } catch (error) {
      this.logger.error(`Failed to delete file ${path}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Copy a file
   */
  async copyFile(source: string, destination: string): Promise<void> {
    try {
      const sourcePath = this.resolvePath(source);
      const destinationPath = this.resolvePath(destination);
      await this.ensureDir(dirname(destinationPath));
      await fs.copyFile(sourcePath, destinationPath);
    } catch (error) {
      this.logger.error(
        `Failed to copy file from ${source} to ${destination}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Get file stats
   */
  async getStats(path: string) {
    try {
      const resolvedPath = this.resolvePath(path);
      return await fs.stat(resolvedPath);
    } catch (error) {
      this.logger.error(`Failed to get stats for ${path}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if path is a directory
   */
  async isDirectory(path: string): Promise<boolean> {
    try {
      const stats = await this.getStats(path);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Check if path is a file
   */
  async isFile(path: string): Promise<boolean> {
    try {
      const stats = await this.getStats(path);
      return stats.isFile();
    } catch {
      return false;
    }
  }

  /**
   * Resolve path with tilde expansion
   */
  private resolvePath(path: string): string {
    if (path.startsWith('~')) {
      return join(homedir(), path.slice(1));
    }
    return resolve(path);
  }

  /**
   * Find files matching a pattern
   */
  async findFiles(directory: string, pattern: RegExp): Promise<string[]> {
    const results: string[] = [];

    async function* walk(directory: string): AsyncGenerator<string> {
      const entries = await fs.readdir(directory, { withFileTypes: true });

      for (const entry of entries) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) {
          yield* walk(path);
        } else {
          yield path;
        }
      }
    }

    for await (const file of walk(this.resolvePath(directory))) {
      if (pattern.test(file)) {
        results.push(file);
      }
    }

    return results;
  }

  /**
   * Get all files in a directory recursively
   */
  async getAllFiles(directory: string): Promise<string[]> {
    const results: string[] = [];

    async function* walk(directory: string): AsyncGenerator<string> {
      const entries = await fs.readdir(directory, { withFileTypes: true });

      for (const entry of entries) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) {
          yield* walk(path);
        } else {
          yield path;
        }
      }
    }

    for await (const file of walk(this.resolvePath(directory))) {
      results.push(file);
    }

    return results;
  }
}
