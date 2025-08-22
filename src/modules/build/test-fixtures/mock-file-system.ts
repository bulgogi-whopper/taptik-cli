
/**
 * Mock file system utilities for testing with advanced error scenarios
 */

/**
 * File system error with code property
 */
interface FileSystemError extends Error {
  code: string;
}

/**
 * File system stats interface
 */
export interface MockFileStats {
  isDirectory(): boolean;
  isFile(): boolean;
  size: number;
}

/**
 * Mock file system configuration
 */
export interface MockFileSystemConfig {
  files: Record<string, string>;
  directories: string[];
  permissions?: Record<string, { readable: boolean; writable: boolean }>;
  errors?: Record<string, Error>;
}

export class MockFileSystem {
  protected files: Map<string, string> = new Map();
  protected directories: Set<string> = new Set();
  protected permissions: Map<string, { readable: boolean; writable: boolean }> = new Map();
  protected errors: Map<string, Error> = new Map();

  constructor(config: MockFileSystemConfig) {
    // Set up files
    for (const [path, content] of Object.entries(config.files)) {
      this.files.set(path, content);
    }

    // Set up directories
    for (const directory of config.directories) {
      this.directories.add(directory);
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
      const error: FileSystemError = Object.assign(
        new Error(`EACCES: permission denied, open '${filePath}'`),
        { code: 'EACCES' }
      );
      throw error;
    }

    // Check if file exists
    if (!this.files.has(filePath)) {
      const error: FileSystemError = Object.assign(
        new Error(`ENOENT: no such file or directory, open '${filePath}'`),
        { code: 'ENOENT' }
      );
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
      const error: FileSystemError = Object.assign(
        new Error(`EACCES: permission denied, open '${filePath}'`),
        { code: 'EACCES' }
      );
      throw error;
    }

    this.files.set(filePath, content);
  }

  async readdir(directoryPath: string): Promise<string[]> {
    // Check for errors first
    if (this.errors.has(directoryPath)) {
      throw this.errors.get(directoryPath);
    }

    // Check if directory exists
    if (!this.directories.has(directoryPath)) {
      const error: FileSystemError = Object.assign(
        new Error(`ENOENT: no such file or directory, scandir '${directoryPath}'`),
        { code: 'ENOENT' }
      );
      throw error;
    }

    // Return files in directory
    const filesInDirectory: string[] = [];
    const filePathsArray = Array.from(this.files.keys());
    for (const filePath of filePathsArray) {
      if (filePath.startsWith(`${directoryPath  }/`)) {
        const relativePath = filePath.slice(Math.max(0, directoryPath.length + 1));
        if (!relativePath.includes('/')) {
          filesInDirectory.push(relativePath);
        }
      }
    }

    return filesInDirectory;
  }

  async mkdir(directoryPath: string, options?: { recursive?: boolean }): Promise<void> {
    // Check for errors first
    if (this.errors.has(directoryPath)) {
      throw this.errors.get(directoryPath);
    }

    // Check permissions
    const perms = this.permissions.get(directoryPath);
    if (perms && !perms.writable) {
      const error: FileSystemError = Object.assign(
        new Error(`EACCES: permission denied, mkdir '${directoryPath}'`),
        { code: 'EACCES' }
      );
      throw error;
    }

    this.directories.add(directoryPath);

    // Add parent directories if recursive
    if (options?.recursive) {
      const parts = directoryPath.split('/');
      let currentPath = '';
      for (const part of parts) {
        if (part) {
          currentPath += `/${  part}`;
          this.directories.add(currentPath);
        }
      }
    }
  }

  async stat(filePath: string): Promise<MockFileStats> {
    // Check for errors first
    if (this.errors.has(filePath)) {
      throw this.errors.get(filePath);
    }

    if (this.directories.has(filePath)) {
      return {
        isDirectory: () => true,
        isFile: () => false,
        size: 0,
      };
    }

    if (this.files.has(filePath)) {
      const content = this.files.get(filePath)!;
      return {
        isDirectory: () => false,
        isFile: () => true,
        size: Buffer.byteLength(content, 'utf8'),
      };
    }

    const error: FileSystemError = Object.assign(
      new Error(`ENOENT: no such file or directory, stat '${filePath}'`),
      { code: 'ENOENT' }
    );
    throw error;
  }

  exists(filePath: string): boolean {
    return this.files.has(filePath) || this.directories.has(filePath);
  }

  getFile(filePath: string): string | undefined {
    return this.files.get(filePath);
  }

  hasDirectory(filePath: string): boolean {
    return this.directories.has(filePath);
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