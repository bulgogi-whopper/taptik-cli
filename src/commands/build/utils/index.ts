import { createHash } from 'node:crypto';

import { stat } from 'fs-extra';

/**
 * Generate a unique build ID with timestamp and random component
 */
export function generateBuildId(): string {
  const timestamp = new Date().toISOString().replace(/[.:]/g, '-');
  const random = Math.random().toString(36).slice(2, 8);
  return `build-${timestamp}-${random}`;
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2))  } ${  sizes[i]}`;
}

/**
 * Generate checksum for file content
 */
export function generateChecksum(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Get file size in bytes
 */
export async function getFileSize(filePath: string): Promise<number> {
  try {
    const stats = await stat(filePath);
    return stats.size;
  } catch {
    return 0;
  }
}

/**
 * Create timestamped directory name
 */
export function createTimestampedDirectoryName(prefix: string = 'taptik-build'): string {
  const now = new Date();
  const timestamp = now.toISOString()
    .replace(/T/, '-')
    .replace(/:/g, '')
    .replace(/\..+/, '');
  return `${prefix}-${timestamp}`;
}

/**
 * Validate category string
 */
export function isValidCategory(category: string): boolean {
  const validCategories = ['personal', 'project', 'prompts'];
  return validCategories.includes(category);
}

/**
 * Parse comma-separated categories
 */
export function parseCategories(categoriesString: string): string[] {
  return categoriesString
    .split(',')
    .map(cat => cat.trim().toLowerCase())
    .filter(cat => cat.length > 0 && isValidCategory(cat));
}

/**
 * Sanitize filename for cross-platform compatibility
 */
export function sanitizeFilename(filename: string): string {
  return filename.replace(/["*/:<>?\\|]/g, '_');
}

// Export PathResolverUtil
export { PathResolverUtil } from './path-resolver.util';