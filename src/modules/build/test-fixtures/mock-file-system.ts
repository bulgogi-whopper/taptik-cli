import { promises as fs } from 'fs';
import { join } from 'path';

/**
 * Mock file system utilities for testing
 */

export interface MockFileSystemConfig {
  files: Record<string, string>;
  directories: string[];
  permissions?: Record<string, { readable: boolean; writable: boolean }>;
  errors?: Record<string, Error>;
}

export class MockFileSystem {
  private files: Map<string, string> = new Map();
  private directories: Set<string> = new Set();
  private permissions: Map<string, { readable: boolean; writable: boolean }> = new Map();
  private errors: Map<string, Error> = new Map();

  constructor(config: MockFileSystemConfig) {
    // Set up files
    for (const [path, content] of Object.entries(config.files)) {
      this.files.set(path, content);
    }

    // Set up directories
    for (const dir of config.directories) {
      this.directories.add(dir);
    }

    // Set up permissions
    if (config.permissions) {
      for (const [path, perms] of Object.entries(config.permissions)) {
        this.permissions.set(path, perms);
      }
    }

    // Set up errors
    if (config.errors) {
      for (const [path, error] of Object.entries(config.errors)) {
        this.errors.set(path, error);
      }
    }
  }

  async readFile(filePath: string): Promise<string> {
    // Check for errors first
    if (this.errors.has(filePath)) {
      throw this.errors.get(filePath);
    }

    // Check permissions
    const perms = this.permissions.get(filePath);
    if (perms && !perms.readable) {
      const error = new Error(`EACCES: permission denied, open '${filePath}'`);
      (error as any).code = 'EACCES';
      throw error;
    }

    // Check if file exists
    if (!this.files.has(filePath)) {
      const error = new Error(`ENOENT: no such file or directory, open '${filePath}'`);
      (error as any).code = 'ENOENT';
      throw error;
    }

    return this.files.get(filePath)!;
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    // Check for errors first
    if (this.errors.has(filePath)) {
      throw this.errors.get(filePath);
    }

    // Check permissions
    const perms = this.permissions.get(filePath);
    if (perms && !perms.writable) {
      const error = new Error(`EACCES: permission denied, open '${filePath}'`);
      (error as any).code = 'EACCES';
      throw error;
    }

    this.files.set(filePath, content);
  }

  async readdir(dirPath: string): Promise<string[]> {
    // Check for errors first
    if (this.errors.has(dirPath)) {
      throw this.errors.get(dirPath);
    }

    // Check if directory exists
    if (!this.directories.has(dirPath)) {
      const error = new Error(`ENOENT: no such file or directory, scandir '${dirPath}'`);
      (error as any).code = 'ENOENT';
      throw error;
    }

    // Return files in directory
    const filesInDir: string[] = [];
    for (const filePath of this.files.keys()) {
      if (filePath.startsWith(dirPath + '/')) {
        const relativePath = filePath.substring(dirPath.length + 1);
        if (!relativePath.includes('/')) {
          filesInDir.push(relativePath);
        }
      }
    }

    return filesInDir;
  }

  async mkdir(dirPath: string, options?: { recursive?: boolean }): Promise<void> {
    // Check for errors first
    if (this.errors.has(dirPath)) {
      throw this.errors.get(dirPath);
    }

    // Check permissions
    const perms = this.permissions.get(dirPath);
    if (perms && !perms.writable) {
      const error = new Error(`EACCES: permission denied, mkdir '${dirPath}'`);
      (error as any).code = 'EACCES';
      throw error;
    }

    this.directories.add(dirPath);

    // Add parent directories if recursive
    if (options?.recursive) {
      const parts = dirPath.split('/');
      let currentPath = '';
      for (const part of parts) {
        if (part) {
          currentPath += '/' + part;
          this.directories.add(currentPath);
        }
      }
    }
  }

  async stat(path: string): Promise<{ isDirectory(): boolean; isFile(): boolean; size: number }> {
    // Check for errors first
    if (this.errors.has(path)) {
      throw this.errors.get(path);
    }

    if (this.directories.has(path)) {
      return {
        isDirectory: () => true,
        isFile: () => false,
        size: 0,
      };
    }

    if (this.files.has(path)) {
      const content = this.files.get(path)!;
      return {
        isDirectory: () => false,
        isFile: () => true,
        size: Buffer.byteLength(content, 'utf8'),
      };
    }

    const error = new Error(`ENOENT: no such file or directory, stat '${path}'`);
    (error as any).code = 'ENOENT';
    throw error;
  }

  exists(path: string): boolean {
    return this.files.has(path) || this.directories.has(path);
  }

  getFile(path: string): string | undefined {
    return this.files.get(path);
  }

  hasDirectory(path: string): boolean {
    return this.directories.has(path);
  }
}

/**
 * Create mock file system for Kiro project structure
 */
export function createMockKiroFileSystem(): MockFileSystem {
  return new MockFileSystem({
    files: {
      '.kiro/settings/context.md': `# Project Context
This is a test project for the taptik CLI build command.`,
      '.kiro/settings/user-preferences.md': `# User Preferences
- Editor: VS Code
- Terminal: iTerm2`,
      '.kiro/settings/project-spec.md': `# Project Specification
Build command for converting Kiro to taptik format.`,
      '.kiro/steering/git.md': `# Git Standards
Use gitmoji for all commits.`,
      '.kiro/steering/typescript.md': `# TypeScript Standards
Use strict mode and interfaces.`,
      '.kiro/hooks/commit.kiro.hook': `#!/bin/bash
# Commit validation hook`,
      '~/.kiro/config/user.yaml': `name: Test User
email: test@example.com`,
      '~/.kiro/preferences/global.md': `# Global Preferences
Development workflow preferences.`,
      '~/.kiro/prompts/code-review.md': `# Code Review Template
Template for reviewing code changes.`,
      '~/.kiro/prompts/bug-investigation.md': `# Bug Investigation Template
Template for investigating bugs.`,
    },
    directories: [
      '.kiro',
      '.kiro/settings',
      '.kiro/steering',
      '.kiro/hooks',
      '~/.kiro',
      '~/.kiro/config',
      '~/.kiro/preferences',
      '~/.kiro/prompts',
    ],
  });
}

/**
 * Create mock file system with permission errors
 */
export function createMockFileSystemWithErrors(): MockFileSystem {
  return new MockFileSystem({
    files: {
      '.kiro/settings/context.md': 'Content',
    },
    directories: ['.kiro', '.kiro/settings'],
    permissions: {
      '.kiro/settings/user-preferences.md': { readable: false, writable: false },
      '~/.kiro': { readable: false, writable: false },
    },
    errors: {
      '.kiro/settings/project-spec.md': new Error('ENOENT: no such file or directory'),
    },
  });
}

/**
 * Create empty mock file system
 */
export function createEmptyMockFileSystem(): MockFileSystem {
  return new MockFileSystem({
    files: {},
    directories: [],
  });
}