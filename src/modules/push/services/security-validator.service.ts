import * as crypto from 'crypto';
import * as path from 'path';

import { Injectable, Logger } from '@nestjs/common';

export interface SecurityValidationResult {
  isValid: boolean;
  issues: SecurityIssue[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface SecurityIssue {
  type: SecurityIssueType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details?: Record<string, unknown>;
}

export enum SecurityIssueType {
  INJECTION_ATTEMPT = 'INJECTION_ATTEMPT',
  PATH_TRAVERSAL = 'PATH_TRAVERSAL',
  MALICIOUS_PATTERN = 'MALICIOUS_PATTERN',
  SUSPICIOUS_FILENAME = 'SUSPICIOUS_FILENAME',
  EXECUTABLE_CONTENT = 'EXECUTABLE_CONTENT',
  OVERSIZED_INPUT = 'OVERSIZED_INPUT',
  INVALID_ENCODING = 'INVALID_ENCODING',
  SUSPICIOUS_METADATA = 'SUSPICIOUS_METADATA',
}

@Injectable()
export class SecurityValidatorService {
  private readonly logger = new Logger(SecurityValidatorService.name);

  // Patterns that might indicate injection attempts
  private readonly INJECTION_PATTERNS = [
    /(\.\.(\/|\\))+/g, // Path traversal
    /<script[\S\s]*?<\/script>/gi, // Script tags
    /javascript:/gi, // JavaScript protocol
    /on\w+\s*=/gi, // Event handlers
    /\${.*}/g, // Template literals
    /\beval\s*\(/gi, // eval() calls
    /\bexec\s*\(/gi, // exec() calls
    /\brequire\s*\(/gi, // require() calls
    /\bimport\s+/gi, // import statements
    /\bprocess\.\w+/gi, // process access
    /\b__proto__\b/gi, // Prototype pollution
    /\bconstructor\b/gi, // Constructor access
  ];

  // Suspicious file extensions
  private readonly SUSPICIOUS_EXTENSIONS = [
    '.exe',
    '.bat',
    '.cmd',
    '.sh',
    '.ps1',
    '.vbs',
    '.js',
    '.jar',
    '.com',
    '.scr',
    '.msi',
    '.dll',
    '.app',
    '.deb',
    '.rpm',
  ];

  // Maximum input sizes (to prevent DOS)
  private readonly MAX_STRING_LENGTH = 10000;
  private readonly MAX_ARRAY_LENGTH = 1000;
  private readonly MAX_OBJECT_DEPTH = 10;

  /**
   * Validate user input for security issues
   */
  validateInput(input: unknown, fieldName: string): SecurityValidationResult {
    const issues: SecurityIssue[] = [];

    try {
      // Check input type and size
      const sizeIssue = this.validateInputSize(input, fieldName);
      if (sizeIssue) {
        issues.push(sizeIssue);
      }

      // Validate based on type
      if (typeof input === 'string') {
        issues.push(...this.validateString(input, fieldName));
      } else if (Array.isArray(input)) {
        issues.push(...this.validateArray(input, fieldName));
      } else if (typeof input === 'object' && input !== null) {
        issues.push(
          ...this.validateObject(input as Record<string, unknown>, fieldName),
        );
      }

      // Determine risk level
      const riskLevel = this.calculateRiskLevel(issues);

      return {
        isValid: riskLevel !== 'critical',
        issues,
        riskLevel,
      };
    } catch (error) {
      this.logger.error(`Security validation error for ${fieldName}`, error);

      return {
        isValid: false,
        issues: [
          {
            type: SecurityIssueType.INVALID_ENCODING,
            severity: 'high',
            message: 'Invalid input encoding or format',
          },
        ],
        riskLevel: 'high',
      };
    }
  }

  /**
   * Validate a file path for security issues
   */
  validateFilePath(filePath: string): SecurityValidationResult {
    const issues: SecurityIssue[] = [];

    // Check for path traversal
    const normalizedPath = path.normalize(filePath);
    if (normalizedPath.includes('..')) {
      issues.push({
        type: SecurityIssueType.PATH_TRAVERSAL,
        severity: 'critical',
        message: 'Path traversal attempt detected',
        details: { path: filePath },
      });
    }

    // Check for absolute paths where they shouldn't be
    if (path.isAbsolute(filePath) && !this.isAllowedAbsolutePath(filePath)) {
      issues.push({
        type: SecurityIssueType.PATH_TRAVERSAL,
        severity: 'medium',
        message: 'Absolute path not allowed',
        details: { path: filePath },
      });
    }

    // Check for suspicious file extensions
    const ext = path.extname(filePath).toLowerCase();
    if (this.SUSPICIOUS_EXTENSIONS.includes(ext)) {
      issues.push({
        type: SecurityIssueType.SUSPICIOUS_FILENAME,
        severity: 'high',
        message: 'Suspicious file extension detected',
        details: { extension: ext },
      });
    }

    // Check for hidden files
    const basename = path.basename(filePath);
    if (basename.startsWith('.') && basename !== '.taptik') {
      issues.push({
        type: SecurityIssueType.SUSPICIOUS_FILENAME,
        severity: 'low',
        message: 'Hidden file detected',
        details: { filename: basename },
      });
    }

    const riskLevel = this.calculateRiskLevel(issues);

    return {
      isValid: riskLevel !== 'critical',
      issues,
      riskLevel,
    };
  }

  /**
   * Validate package metadata for security issues
   */
  validatePackageMetadata(
    metadata: Record<string, unknown>,
  ): SecurityValidationResult {
    const issues: SecurityIssue[] = [];

    // Check each metadata field
    for (const [key, value] of Object.entries(metadata)) {
      const fieldValidation = this.validateInput(value, key);
      issues.push(...fieldValidation.issues);
    }

    // Check for suspicious metadata patterns
    const metadataString = JSON.stringify(metadata);
    if (metadataString.length > 100000) {
      issues.push({
        type: SecurityIssueType.OVERSIZED_INPUT,
        severity: 'medium',
        message: 'Metadata size exceeds limits',
        details: { size: metadataString.length },
      });
    }

    // Check for embedded scripts or code
    for (const pattern of this.INJECTION_PATTERNS) {
      if (pattern.test(metadataString)) {
        issues.push({
          type: SecurityIssueType.MALICIOUS_PATTERN,
          severity: 'high',
          message: 'Suspicious pattern detected in metadata',
          details: { pattern: pattern.source },
        });
        break;
      }
    }

    const riskLevel = this.calculateRiskLevel(issues);

    return {
      isValid: riskLevel !== 'critical' && riskLevel !== 'high',
      issues,
      riskLevel,
    };
  }

  /**
   * Detect malicious content in buffer
   */
  detectMaliciousContent(buffer: Buffer): SecurityValidationResult {
    const issues: SecurityIssue[] = [];

    try {
      // Check for executable signatures
      if (this.hasExecutableSignature(buffer)) {
        issues.push({
          type: SecurityIssueType.EXECUTABLE_CONTENT,
          severity: 'critical',
          message: 'Executable content detected',
        });
      }

      // Check for embedded scripts in first 10KB
      const sampleSize = Math.min(buffer.length, 10240);
      const sample = buffer
        .slice(0, sampleSize)
        .toString('utf8', 0, sampleSize);

      for (const pattern of this.INJECTION_PATTERNS) {
        if (pattern.test(sample)) {
          issues.push({
            type: SecurityIssueType.MALICIOUS_PATTERN,
            severity: 'high',
            message: 'Suspicious pattern detected in content',
          });
          break;
        }
      }

      // Check for abnormal entropy (might indicate encryption or obfuscation)
      const entropy = this.calculateEntropy(buffer.slice(0, 1024));
      if (entropy > 7.5) {
        issues.push({
          type: SecurityIssueType.SUSPICIOUS_METADATA,
          severity: 'medium',
          message: 'High entropy detected (possible encryption or obfuscation)',
          details: { entropy },
        });
      }
    } catch (error) {
      this.logger.error('Error detecting malicious content', error);
    }

    const riskLevel = this.calculateRiskLevel(issues);

    return {
      isValid: riskLevel !== 'critical',
      issues,
      riskLevel,
    };
  }

  /**
   * Generate secure token
   */
  generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Hash sensitive data
   */
  hashSensitiveData(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Validate input size
   */
  private validateInputSize(
    input: unknown,
    fieldName: string,
  ): SecurityIssue | null {
    if (typeof input === 'string' && input.length > this.MAX_STRING_LENGTH) {
      return {
        type: SecurityIssueType.OVERSIZED_INPUT,
        severity: 'medium',
        message: `Input ${fieldName} exceeds maximum length`,
        details: { length: input.length, max: this.MAX_STRING_LENGTH },
      };
    }

    if (Array.isArray(input) && input.length > this.MAX_ARRAY_LENGTH) {
      return {
        type: SecurityIssueType.OVERSIZED_INPUT,
        severity: 'medium',
        message: `Array ${fieldName} exceeds maximum length`,
        details: { length: input.length, max: this.MAX_ARRAY_LENGTH },
      };
    }

    return null;
  }

  /**
   * Validate string input
   */
  private validateString(input: string, fieldName: string): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    // Check for injection patterns
    for (const pattern of this.INJECTION_PATTERNS) {
      if (pattern.test(input)) {
        issues.push({
          type: SecurityIssueType.INJECTION_ATTEMPT,
          severity: 'high',
          message: `Potential injection attempt in ${fieldName}`,
          details: { pattern: pattern.source },
        });
        break;
      }
    }

    // Check for null bytes
    if (input.includes('\0')) {
      issues.push({
        type: SecurityIssueType.INJECTION_ATTEMPT,
        severity: 'high',
        message: `Null byte detected in ${fieldName}`,
      });
    }

    // Check for control characters using character code validation
    if (this.hasControlCharacters(input)) {
      issues.push({
        type: SecurityIssueType.INVALID_ENCODING,
        severity: 'low',
        message: `Control characters detected in ${fieldName}`,
      });
    }

    return issues;
  }

  /**
   * Validate array input
   */
  private validateArray(input: unknown[], fieldName: string): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    for (let i = 0; i < input.length; i++) {
      const itemValidation = this.validateInput(input[i], `${fieldName}[${i}]`);
      issues.push(...itemValidation.issues);
    }

    return issues;
  }

  /**
   * Validate object input
   */
  private validateObject(
    input: Record<string, unknown>,
    fieldName: string,
    depth: number = 0,
  ): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    if (depth > this.MAX_OBJECT_DEPTH) {
      issues.push({
        type: SecurityIssueType.OVERSIZED_INPUT,
        severity: 'medium',
        message: `Object ${fieldName} exceeds maximum depth`,
        details: { depth, max: this.MAX_OBJECT_DEPTH },
      });
      return issues;
    }

    for (const [key, value] of Object.entries(input)) {
      // Validate the key itself
      const keyValidation = this.validateString(
        key,
        `${fieldName}.${key} (key)`,
      );
      issues.push(...keyValidation);

      // Validate the value
      if (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value)
      ) {
        const nestedIssues = this.validateObject(
          value as Record<string, unknown>,
          `${fieldName}.${key}`,
          depth + 1,
        );
        issues.push(...nestedIssues);
      } else {
        const valueValidation = this.validateInput(
          value,
          `${fieldName}.${key}`,
        );
        issues.push(...valueValidation.issues);
      }
    }

    return issues;
  }

  /**
   * Check for executable file signatures
   */
  private hasExecutableSignature(buffer: Buffer): boolean {
    if (buffer.length < 4) return false;

    // Check for common executable signatures
    const signatures = [
      [0x4d, 0x5a], // PE/COFF (Windows EXE/DLL)
      [0x7f, 0x45, 0x4c, 0x46], // ELF (Linux)
      [0xce, 0xfa, 0xed, 0xfe], // Mach-O (macOS) 32-bit
      [0xcf, 0xfa, 0xed, 0xfe], // Mach-O (macOS) 64-bit
      [0xca, 0xfe, 0xba, 0xbe], // Java class file
      [0x23, 0x21], // Shebang (#!)
    ];

    for (const sig of signatures) {
      let match = true;
      for (let i = 0; i < sig.length; i++) {
        if (buffer[i] !== sig[i]) {
          match = false;
          break;
        }
      }
      if (match) return true;
    }

    return false;
  }

  /**
   * Calculate entropy of data
   */
  private calculateEntropy(buffer: Buffer): number {
    const freq: Map<number, number> = new Map();

    for (const byte of buffer) {
      freq.set(byte, (freq.get(byte) || 0) + 1);
    }

    let entropy = 0;
    const len = buffer.length;

    for (const count of freq.values()) {
      const p = count / len;
      entropy -= p * Math.log2(p);
    }

    return entropy;
  }

  /**
   * Check if string contains control characters
   * Replaces regex-based approach to avoid ESLint no-control-regex warning
   */
  private hasControlCharacters(input: string): boolean {
    for (let i = 0; i < input.length; i++) {
      const charCode = input.charCodeAt(i);
      
      // Check for control characters (0x00-0x08, 0x0B, 0x0C, 0x0E-0x1F, 0x7F)
      if (
        (charCode >= 0x00 && charCode <= 0x08) ||
        charCode === 0x0B ||
        charCode === 0x0C ||
        (charCode >= 0x0E && charCode <= 0x1F) ||
        charCode === 0x7F
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if absolute path is allowed
   */
  private isAllowedAbsolutePath(filePath: string): boolean {
    // Allow home directory paths
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    if (homeDir && filePath.startsWith(homeDir)) {
      return true;
    }

    // Allow temp directory paths
    const tmpDir = process.env.TMPDIR || process.env.TEMP || '/tmp';
    if (filePath.startsWith(tmpDir)) {
      return true;
    }

    return false;
  }

  /**
   * Calculate overall risk level from issues
   */
  private calculateRiskLevel(
    issues: SecurityIssue[],
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (issues.some((i) => i.severity === 'critical')) {
      return 'critical';
    }
    if (issues.some((i) => i.severity === 'high')) {
      return 'high';
    }
    if (issues.some((i) => i.severity === 'medium')) {
      return 'medium';
    }
    if (issues.length > 0) {
      return 'low';
    }
    return 'low';
  }
}
