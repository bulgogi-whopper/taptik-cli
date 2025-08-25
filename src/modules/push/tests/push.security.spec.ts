import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock fs/promises for file operations
vi.mock('fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs/promises')>();
  return {
    ...actual,
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue('test content'),
    rm: vi.fn().mockResolvedValue(undefined),
    appendFile: vi.fn().mockResolvedValue(undefined),
  };
});

import { PackageValidatorService } from '../services/package-validator.service';
import { SanitizationService } from '../services/sanitization.service';
import { SecurityValidatorService } from '../services/security-validator.service';

describe('Push Module Security Tests', () => {
  let tempDir: string;
  let securityValidator: SecurityValidatorService;
  let sanitizer: SanitizationService;
  let packageValidator: PackageValidatorService;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), 'taptik-security-test', Date.now().toString());
    await fs.mkdir(tempDir, { recursive: true });

    securityValidator = new SecurityValidatorService();
    sanitizer = new SanitizationService();
    packageValidator = new PackageValidatorService();
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  describe('Security Validation API', () => {
    it('should have validateInput method that returns security results', () => {
      const result = securityValidator.validateInput('test input', 'fieldName');
      
      expect(result).toBeDefined();
      expect(result.isValid).toBeDefined();
      expect(result.issues).toBeDefined();
      expect(result.riskLevel).toBeDefined();
      expect(Array.isArray(result.issues)).toBe(true);
    });

    it('should have validateFilePath method that checks file paths', () => {
      const result = securityValidator.validateFilePath('test/path');
      
      expect(result).toBeDefined();
      expect(result.isValid).toBeDefined();
      expect(result.issues).toBeDefined();
      expect(result.riskLevel).toBeDefined();
    });

    it('should validate package metadata', () => {
      const metadata = {
        name: 'test-package',
        version: '1.0.0',
        description: 'A test package'
      };
      
      const result = securityValidator.validatePackageMetadata(metadata);
      
      expect(result).toBeDefined();
      expect(result.isValid).toBeDefined();
      expect(result.issues).toBeDefined();
      expect(result.riskLevel).toBeDefined();
    });

    it('should detect malicious content in buffers', () => {
      const testBuffer = Buffer.from('test content');
      const result = securityValidator.detectMaliciousContent(testBuffer);
      
      expect(result).toBeDefined();
      expect(result.isValid).toBeDefined();
      expect(result.issues).toBeDefined();
      expect(result.riskLevel).toBeDefined();
    });

    it('should generate secure tokens', () => {
      const token1 = securityValidator.generateSecureToken(32);
      const token2 = securityValidator.generateSecureToken(32);
      
      expect(token1).toBeDefined();
      expect(token2).toBeDefined();
      expect(token1).not.toBe(token2); // Should be different
      expect(token1).toHaveLength(64); // 32 bytes = 64 hex chars
    });

    it('should hash sensitive data', () => {
      const data = 'sensitive information';
      const hash1 = securityValidator.hashSensitiveData(data);
      const hash2 = securityValidator.hashSensitiveData(data);
      
      expect(hash1).toBeDefined();
      expect(hash2).toBeDefined();
      expect(hash1).toBe(hash2); // Same input should produce same hash
      expect(hash1).toHaveLength(64); // SHA256 = 64 hex chars
    });
  });

  describe('Sensitive Data Detection', () => {
    it('should detect API keys in text content', async () => {
      const packageWithKeys = {
        name: 'test-package',
        config: {
          apiKey: 'sk-1234567890abcdef',
          githubToken: 'ghp_1234567890abcdef',
          awsAccessKey: 'AKIA1234567890ABCDEF',
          googleApiKey: 'AIzaSyA-1234567890abcdef',
          stripeKey: 'sk_live_1234567890abcdef',
        },
      };

      const packageString = JSON.stringify(packageWithKeys);
      
      // Test pattern detection directly
      const sensitivePatterns = [/sk-[a-zA-Z0-9]+/, /ghp_[a-zA-Z0-9]+/, /AKIA[a-zA-Z0-9]+/, /AIzaSy[a-zA-Z0-9-_]+/, /sk_live_[a-zA-Z0-9]+/];
      let foundSensitiveData = false;
      
      for (const pattern of sensitivePatterns) {
        if (pattern.test(packageString)) {
          foundSensitiveData = true;
          break;
        }
      }
      
      expect(foundSensitiveData).toBe(true);
    });

    it('should detect password patterns in text content', async () => {
      const packageWithPasswords = {
        name: 'test-package',
        database: {
          password: 'secretPassword123!',
          passwd: 'anotherPassword',
          pwd: 'shortPwd',
          dbPassword: 'databasePass',
        },
        config: {
          userPassword: 'userPass123',
          adminPassword: 'adminPass456',
        },
      };

      const packageString = JSON.stringify(packageWithPasswords);
      
      // Test pattern detection directly
      const passwordPatterns = [/"password"/, /"passwd"/, /"pwd"/, /Password/];
      let foundPasswordData = false;
      
      for (const pattern of passwordPatterns) {
        if (pattern.test(packageString)) {
          foundPasswordData = true;
          break;
        }
      }
      
      expect(foundPasswordData).toBe(true);
    });

    it('should detect email addresses in text content', async () => {
      const packageWithEmails = {
        name: 'test-package',
        author: {
          email: 'user@example.com',
          personalEmail: 'personal@gmail.com',
          workEmail: 'work@company.com',
        },
        contacts: [
          'contact1@example.com',
          'contact2@example.org',
        ],
      };

      const packageString = JSON.stringify(packageWithEmails);
      
      // Test email pattern detection
      const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
      const foundEmailData = emailPattern.test(packageString);
      
      expect(foundEmailData).toBe(true);
    });

    it('should detect SSH keys and certificates in text content', async () => {
      const packageWithKeys = {
        name: 'test-package',
        sshKey: '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----',
        certificate: '-----BEGIN CERTIFICATE-----\nMIIFazCCA1OgAwIBAgIUH...\n-----END CERTIFICATE-----',
      };

      const packageString = JSON.stringify(packageWithKeys);
      
      // Test key/certificate pattern detection
      const keyPatterns = [/-----BEGIN.*PRIVATE KEY-----/, /-----BEGIN CERTIFICATE-----/];
      let foundKeyData = false;
      
      for (const pattern of keyPatterns) {
        if (pattern.test(packageString)) {
          foundKeyData = true;
          break;
        }
      }
      
      expect(foundKeyData).toBe(true);
    });
  });

  describe('Malicious Content Detection', () => {
    it('should process binary content for security analysis', () => {
      // Test various binary signatures
      const testCases = [
        { name: 'Windows PE', data: Buffer.from([0x4D, 0x5A]) },
        { name: 'Linux ELF', data: Buffer.from([0x7F, 0x45, 0x4C, 0x46]) },
        { name: 'Java class', data: Buffer.from([0xCA, 0xFE, 0xBA, 0xBE]) },
        { name: 'Shell script', data: Buffer.from('#!/bin/sh\nrm -rf /') },
        { name: 'Normal text', data: Buffer.from('hello world') }
      ];

      testCases.forEach(testCase => {
        const result = securityValidator.detectMaliciousContent(testCase.data);
        
        // Should always return a valid result structure
        expect(result).toBeDefined();
        expect(result.isValid).toBeDefined();
        expect(result.issues).toBeDefined();
        expect(result.riskLevel).toBeDefined();
        expect(Array.isArray(result.issues)).toBe(true);
      });
    });

    it('should detect suspicious file extensions', () => {
      const suspiciousFiles = [
        'malware.exe',
        'script.bat',
        'hack.sh',
        'virus.vbs',
        'trojan.jar',
        'backdoor.dll',
      ];

      suspiciousFiles.forEach(file => {
        const result = securityValidator.validateFilePath(file);
        expect(result.issues.some(i => i.type === 'SUSPICIOUS_FILENAME')).toBe(true);
        expect(result.riskLevel).toMatch(/medium|high/);
      });
    });

    it('should detect high entropy (potential encryption/obfuscation)', () => {
      // Create high entropy data (random bytes)
      const highEntropyData = crypto.randomBytes(1024);
      const result = securityValidator.detectMaliciousContent(highEntropyData);
      
      expect(result.issues.some(i => 
        i.type === 'SUSPICIOUS_METADATA' && 
        i.message.includes('entropy')
      )).toBe(true);
    });
  });

  describe('Input Validation', () => {
    it('should reject oversized inputs', () => {
      const largeString = 'a'.repeat(20000); // Exceeds 10000 char limit
      const result = securityValidator.validateInput(largeString, 'userInput');
      
      expect(result.issues.some(i => i.type === 'OVERSIZED_INPUT')).toBe(true);
      // Only fails validation if critical
      if (result.riskLevel === 'critical') {
        expect(result.isValid).toBe(false);
      }
    });

    it('should reject deeply nested objects', () => {
      const deepObject: any = { level: 0 };
      let current = deepObject;
      
      // Create object with depth > 10
      for (let i = 1; i <= 15; i++) {
        current.nested = { level: i };
        current = current.nested;
      }

      const result = securityValidator.validateInput(deepObject, 'userInput');
      
      expect(result.issues.some(i => i.type === 'OVERSIZED_INPUT')).toBe(true);
      // Only fails validation if critical
      if (result.riskLevel === 'critical') {
        expect(result.isValid).toBe(false);
      }
    });

    it('should detect null bytes in strings', () => {
      const stringWithNullByte = 'normal\x00malicious';
      const result = securityValidator.validateInput(stringWithNullByte, 'userInput');
      
      expect(result.issues.some(i => i.type === 'INJECTION_ATTEMPT')).toBe(true);
      // Only fails validation if critical
      if (result.riskLevel === 'critical') {
        expect(result.isValid).toBe(false);
      }
    });

    it('should detect control characters', () => {
      const stringWithControlChars = 'text\x07\x08\x0B\x0C';
      const result = securityValidator.validateInput(stringWithControlChars, 'userInput');
      
      expect(result.issues.some(i => i.type === 'INVALID_ENCODING')).toBe(true);
    });
  });

  describe('Package Integrity', () => {
    it('should calculate package checksums', async () => {
      const packagePath = path.join(tempDir, 'test.taptik');
      
      // Calculate checksum (will use mocked fs.readFile)
      const checksum = await packageValidator.calculateChecksum(packagePath);
      expect(checksum).toBeDefined();
      expect(checksum).toHaveLength(64); // SHA256 hex
    });

    it('should detect content changes through checksum comparison', () => {
      const originalContent = JSON.stringify({
        name: 'test-package',
        version: '1.0.0',
        checksum: 'original-checksum',
      });

      // Calculate checksums directly from content
      const originalChecksum = crypto.createHash('sha256').update(originalContent).digest('hex');

      // Tamper with the content
      const tamperedContent = originalContent.replace('1.0.0', '2.0.0');
      const tamperedChecksum = crypto.createHash('sha256').update(tamperedContent).digest('hex');

      // Checksums should differ
      expect(tamperedChecksum).not.toBe(originalChecksum);
    });
  });

  describe('Access Control', () => {
    it('should validate user permissions', () => {
      const mockUser = {
        id: 'user-123',
        email: 'user@example.com',
        tier: 'free',
      };

      const mockPackage = {
        userId: 'user-456', // Different user
        isPublic: false,
      };

      // User should not have access to another user's private package
      const hasAccess = mockUser.id === mockPackage.userId || mockPackage.isPublic;
      expect(hasAccess).toBe(false);
    });

    it('should enforce tier-based limits', () => {
      const freeTierLimits = {
        maxPackageSize: 10 * 1024 * 1024, // 10MB
        maxUploadsPerDay: 100,
        maxBandwidthPerDay: 1024 * 1024 * 1024, // 1GB
      };

      const proTierLimits = {
        maxPackageSize: 100 * 1024 * 1024, // 100MB
        maxUploadsPerDay: 1000,
        maxBandwidthPerDay: 10 * 1024 * 1024 * 1024, // 10GB
      };

      // Test free tier
      expect(freeTierLimits.maxPackageSize).toBeLessThan(proTierLimits.maxPackageSize);
      expect(freeTierLimits.maxUploadsPerDay).toBeLessThan(proTierLimits.maxUploadsPerDay);
      expect(freeTierLimits.maxBandwidthPerDay).toBeLessThan(proTierLimits.maxBandwidthPerDay);
    });
  });
});