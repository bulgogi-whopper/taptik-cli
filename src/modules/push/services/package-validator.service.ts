import * as crypto from 'crypto';
import { Readable } from 'stream';

import { Injectable, Logger } from '@nestjs/common';

import * as tar from 'tar';

import { PLATFORM_CONFIGS, RATE_LIMITS } from '../constants/push.constants';

import { UserTier } from './rate-limiter.service';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface PackageMetadata {
  platform: string;
  version: string;
  checksum: string;
}

@Injectable()
export class PackageValidatorService {
  private readonly logger = new Logger(PackageValidatorService.name);

  // Malware detection patterns
  private readonly MALWARE_PATTERNS = [
    // Shell injection patterns
    /rm\s+-rf\s+\//gi,
    /format\s+c:/gi,
    /del\s+\/f\s+\/s\s+\/q/gi,

    // Code execution patterns
    /exec\s*\(\s*["']os\.system/gi,
    /eval\s*\(\s*atob/gi,
    /require\s*\(\s*["']child_process["']\s*\)\s*\.\s*exec/gi,
    /spawn\s*\(\s*["']sh["']/gi,

    // Network backdoor patterns
    /new\s+websocket\s*\(\s*["']ws:\/\/[^"']*:\d{4}/gi,
    /\.connect\s*\(\s*\d{4,5}\s*,\s*["'][^"']+["']\s*\)/gi,
    /fetch\s*\(\s*["']https?:\/\/[^"']*\/steal-data/gi,

    // Crypto mining patterns
    /coinhive\./gi,
    /cryptonight_hash/gi,
    /stratum\+tcp:\/\//gi,
    /minergate/gi,

    // Command injection via template literals
    /`[^`]*rm\s+-rf[^`]*`/gi,
    /\$\([^)]*curl[^)]*\|[^)]*sh[^)]*\)/gi,
    /`[^`]*wget[^`]*backdoor[^`]*`/gi,
  ];

  async validateStructure(buffer: Buffer): Promise<boolean> {
    if (!buffer || buffer.length === 0) {
      this.logger.warn('Empty buffer provided for validation');
      return false;
    }

    try {
      // First try to parse as gzipped JSON (build command format)
      try {
        const zlib = await import('zlib');
        const decompressed = zlib.gunzipSync(buffer);
        const packageData = JSON.parse(decompressed.toString());
        
        // Validate that it's a valid Taptik package
        if (packageData && packageData.metadata && packageData.sanitizedConfig) {
          // This is a valid Taptik package from build command
          return true;
        }
      } catch {
        // Not gzipped JSON, try tar.gz format
      }

      // Try to parse as tar.gz package (alternative format)
      let hasMetadata = false;
      let hasValidPaths = true;
      const entries: string[] = [];

      const stream = Readable.from(buffer);

      await new Promise<void>((resolve, reject) => {
        stream
          .pipe(
            tar.list({
              onentry: (entry: tar.ReadEntry) => {
                const filePath = entry.path;
                entries.push(filePath);

                // Check for required metadata.json
                if (filePath === 'metadata.json') {
                  hasMetadata = true;
                }

                // Detect path traversal attempts
                if (this.isPathTraversal(filePath)) {
                  hasValidPaths = false;
                  this.logger.warn(`Path traversal detected: ${filePath}`);
                }
              },
            }),
          )
          .on('finish', () => resolve())
          .on('error', (err: Error) => reject(err));
      });

      // Package must have metadata.json and no path traversal
      return hasMetadata && hasValidPaths && entries.length > 0;
    } catch (error) {
      this.logger.error('Failed to validate package structure', error);
      return false;
    }
  }

  private isPathTraversal(filePath: string): boolean {
    // Check for path traversal patterns
    const normalizedPath = filePath.replace(/\\/g, '/');
    return (
      normalizedPath.includes('../') ||
      normalizedPath.includes('..\\') ||
      normalizedPath.startsWith('/') ||
      normalizedPath.includes(':') || // Windows drive letters
      normalizedPath.includes('~') // Home directory expansion
    );
  }

  async validateChecksum(
    buffer: Buffer,
    expectedChecksum: string,
  ): Promise<boolean> {
    const actualChecksum = await this.calculateChecksum(buffer);
    return actualChecksum === expectedChecksum;
  }

  async calculateChecksum(buffer: Buffer): Promise<string> {
    const hash = crypto.createHash('sha256');
    hash.update(buffer);
    return hash.digest('hex');
  }

  async validateSize(size: number, userTier: UserTier): Promise<boolean> {
    // Reject negative sizes
    if (size < 0) {
      return false;
    }

    // Check size limits based on user tier
    const maxSize =
      userTier === 'pro'
        ? RATE_LIMITS.PRO_TIER.MAX_PACKAGE_SIZE
        : RATE_LIMITS.FREE_TIER.MAX_PACKAGE_SIZE;

    return size <= maxSize;
  }

  async validatePlatform(platform: string): Promise<boolean> {
    return platform in PLATFORM_CONFIGS;
  }

  async scanForMalware(buffer: Buffer): Promise<boolean> {
    if (!buffer || buffer.length === 0) {
      // Empty content is safe
      return true;
    }

    let content: string;
    
    try {
      // Try to decompress if it's gzipped
      const zlib = await import('zlib');
      const decompressed = zlib.gunzipSync(buffer);
      content = decompressed.toString('utf-8');
    } catch {
      // Not gzipped, use raw buffer
      content = buffer.toString('utf-8');
    }

    // Check against malware patterns
    for (const pattern of this.MALWARE_PATTERNS) {
      if (pattern.test(content)) {
        this.logger.warn(`Malware pattern detected: ${pattern}`);
        return false;
      }
    }

    // Additional checks for suspicious content
    if (this.containsSuspiciousContent(content)) {
      return false;
    }

    return true;
  }

  private containsSuspiciousContent(content: string): boolean {
    // Check for suspicious function calls
    const suspiciousFunctions = [
      'system(',
      'exec(',
      'spawn(',
      'execFile(',
      'execSync(',
      '.shell(',
      'shelljs.',
    ];

    const lowerContent = content.toLowerCase();
    for (const func of suspiciousFunctions) {
      if (lowerContent.includes(func.toLowerCase())) {
        // Allow if it's in a comment or string
        if (!this.isInCommentOrString(content, func)) {
          this.logger.warn(`Suspicious function detected: ${func}`);
          return true;
        }
      }
    }

    return false;
  }

  private isInCommentOrString(content: string, pattern: string): boolean {
    // Simple heuristic: check if pattern appears within quotes or after //
    const lines = content.split('\n');
    for (const line of lines) {
      if (line.includes(pattern)) {
        // Check if it's in a comment
        const commentIndex = line.indexOf('//');
        const patternIndex = line.indexOf(pattern);
        if (commentIndex >= 0 && commentIndex < patternIndex) {
          continue; // It's in a comment, safe
        }

        // Check if it's in a string (very basic check)
        const beforePattern = line.substring(0, patternIndex);
        const singleQuotes = (beforePattern.match(/'/g) || []).length;
        const doubleQuotes = (beforePattern.match(/"/g) || []).length;

        if (singleQuotes % 2 !== 0 || doubleQuotes % 2 !== 0) {
          continue; // Likely in a string
        }

        return false; // Not in comment or string, suspicious
      }
    }
    return true; // Pattern not found or only in safe contexts
  }

  async validatePackage(
    buffer: Buffer,
    metadata: PackageMetadata,
    userTier: UserTier,
  ): Promise<ValidationResult> {
    const errors: string[] = [];

    // Validate structure
    if (!(await this.validateStructure(buffer))) {
      errors.push('Invalid package structure');
    }

    // Validate size
    if (!(await this.validateSize(buffer.length, userTier))) {
      errors.push(`Package size exceeds ${userTier} tier limit`);
    }

    // Validate platform
    if (!(await this.validatePlatform(metadata.platform))) {
      errors.push(`Unsupported platform: ${metadata.platform}`);
    }

    // Validate checksum
    if (!(await this.validateChecksum(buffer, metadata.checksum))) {
      errors.push('Checksum mismatch');
    }

    // Scan for malware
    if (!(await this.scanForMalware(buffer))) {
      errors.push('Potential malware detected');
    }

    // Validate version format (basic semver check)
    if (!this.isValidSemver(metadata.version)) {
      errors.push(`Invalid version format: ${metadata.version}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private isValidSemver(version: string): boolean {
    // Basic semver validation
    const semverRegex = /^\d+\.\d+\.\d+(-[\w.]+)?(\+[\w.]+)?$/;
    return semverRegex.test(version);
  }
}
