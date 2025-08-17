import * as os from 'node:os';
import * as path from 'node:path';

import {
  PATH_TRAVERSAL_PATTERNS,
  BLOCKED_PATHS,
} from '../constants/security.constants';

export class PathResolver {
  static resolvePath(inputPath: string): string {
    if (!inputPath) {
      return '';
    }

    let resolved = inputPath;

    // Expand home directory
    if (resolved.startsWith('~')) {
      resolved = resolved.replace(/^~/, os.homedir());
    }

    // Normalize path separators
    resolved = resolved.replaceAll('\\', '/');

    // Resolve to absolute path if not already
    if (!path.isAbsolute(resolved)) {
      resolved = path.resolve(resolved);
    }

    return resolved;
  }

  static validatePath(inputPath: string): boolean {
    if (!inputPath) {
      return false;
    }

    // Check for null bytes
    if (inputPath.includes('\0')) {
      return false;
    }

    // Decode any URL encoding first
    let decodedPath = inputPath;
    try {
      decodedPath = decodeURIComponent(inputPath);
    } catch {
      // If decoding fails, use original
    }

    // Check for directory traversal patterns
    for (const pattern of PATH_TRAVERSAL_PATTERNS) {
      if (pattern.test(decodedPath)) {
        return false;
      }
    }

    // Check for blocked paths
    for (const blockedPath of BLOCKED_PATHS) {
      if (
        decodedPath.includes(blockedPath) ||
        this.resolvePath(decodedPath).includes(this.resolvePath(blockedPath))
      ) {
        return false;
      }
    }

    return true;
  }

  static isWithinAllowedDirectory(
    inputPath: string,
    allowedDirectories: string[],
  ): boolean {
    if (allowedDirectories.length === 0) {
      return false;
    }

    const resolvedPath = this.resolvePath(inputPath);

    // Check for directory traversal first
    if (!this.validatePath(inputPath)) {
      return false;
    }

    for (const allowedDirectory of allowedDirectories) {
      const resolvedAllowedDirectory = this.resolvePath(allowedDirectory);

      // Check exact match
      if (resolvedPath === resolvedAllowedDirectory) {
        return true;
      }

      // Check if path starts with allowed directory
      if (
        resolvedPath.startsWith(`${resolvedAllowedDirectory}/`) ||
        resolvedPath.startsWith(resolvedAllowedDirectory)
      ) {
        return true;
      }
    }

    return false;
  }

  static sanitizePath(inputPath: string): string {
    let sanitized = inputPath;

    // Remove null bytes
    sanitized = sanitized.replaceAll('\0', '');

    // Normalize separators
    sanitized = sanitized.replaceAll('\\', '/');

    // Remove multiple slashes
    sanitized = sanitized.replaceAll(/\/+/g, '/');

    // Trim whitespace
    sanitized = sanitized.trim();

    // Decode URL encoding
    try {
      sanitized = decodeURIComponent(sanitized);
    } catch {
      // Keep as is if decoding fails
    }

    return sanitized;
  }

  private static expandHomeDirectory(inputPath: string): string {
    if (inputPath.startsWith('~')) {
      return inputPath.replace(/^~/, os.homedir());
    }
    return inputPath;
  }

  private static preventDirectoryTraversal(inputPath: string): boolean {
    // Check for any traversal patterns
    for (const pattern of PATH_TRAVERSAL_PATTERNS) {
      if (pattern.test(inputPath)) {
        return false;
      }
    }
    return true;
  }
}
