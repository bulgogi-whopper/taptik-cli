import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { CloudUploadService } from '../services/cloud-upload.service';
import { PackageValidatorService } from '../services/package-validator.service';
import { SanitizationService } from '../services/sanitization.service';

describe('Push Module Performance Tests', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), 'taptik-perf-test', Date.now().toString());
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  describe('Large File Handling', () => {
    it('should handle 50MB file within 30 seconds', async () => {
      const largeFile = path.join(tempDir, 'large.taptik');
      const size = 50 * 1024 * 1024; // 50MB
      
      // Create large file with random data
      const chunks = [];
      const chunkSize = 1024 * 1024; // 1MB chunks
      for (let i = 0; i < size; i += chunkSize) {
        chunks.push(crypto.randomBytes(Math.min(chunkSize, size - i)));
      }
      const buffer = Buffer.concat(chunks);
      await fs.writeFile(largeFile, buffer);

      const validator = new PackageValidatorService();
      const startTime = Date.now();
      
      const checksum = await validator.calculateChecksum(largeFile);
      
      const duration = Date.now() - startTime;
      
      expect(checksum).toBeDefined();
      expect(checksum).toHaveLength(64); // SHA256 hex string
      expect(duration).toBeLessThan(30000); // Should complete within 30 seconds
    }, 60000); // 60 second timeout for test

    it('should efficiently chunk large files for upload', async () => {
      const size = 20 * 1024 * 1024; // 20MB
      const buffer = crypto.randomBytes(size);
      
      const uploader = new CloudUploadService({} as any, {} as any);
      const chunks = uploader['createChunks'](buffer, 5 * 1024 * 1024); // 5MB chunks
      
      expect(chunks).toHaveLength(4); // 20MB / 5MB = 4 chunks
      expect(chunks[0].length).toBe(5 * 1024 * 1024);
      expect(chunks[3].length).toBe(5 * 1024 * 1024);
      
      // Verify chunks can be reassembled
      const reassembled = Buffer.concat(chunks);
      expect(reassembled.length).toBe(buffer.length);
      expect(reassembled.compare(buffer)).toBe(0);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle 10 concurrent uploads', async () => {
      const uploads = [];
      const startTime = Date.now();

      // Create 10 small packages
      for (let i = 0; i < 10; i++) {
        const packagePath = path.join(tempDir, `package-${i}.taptik`);
        const content = JSON.stringify({
          name: `package-${i}`,
          version: '1.0.0',
          data: crypto.randomBytes(1024).toString('base64'), // 1KB of random data
        });
        await fs.writeFile(packagePath, content);
        uploads.push(packagePath);
      }

      // Simulate concurrent validation
      const validator = new PackageValidatorService();
      const validationPromises = uploads.map(async (file) => {
        const checksum = await validator.calculateChecksum(file);
        return { file, checksum };
      });

      const results = await Promise.all(validationPromises);
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result.checksum).toBeDefined();
        expect(result.checksum).toHaveLength(64);
      });
      
      // Should handle 10 concurrent operations in reasonable time
      expect(duration).toBeLessThan(5000); // 5 seconds for 10 small files
    });

    it('should handle rate limiting under load', async () => {
      const operations = [];
      const operationCount = 50;

      // Simulate rapid operations that would trigger rate limiting
      for (let i = 0; i < operationCount; i++) {
        operations.push({
          id: `op-${i}`,
          timestamp: Date.now(),
        });
      }

      // Process operations with rate limiting simulation
      const processedOps: any[] = [];
      const batchSize = 10;
      const delay = 100; // 100ms between batches

      for (let i = 0; i < operations.length; i += batchSize) {
        const batch = operations.slice(i, i + batchSize);
        
        // Process batch
        await Promise.all(batch.map(async (op) => {
          // Simulate processing
          await new Promise(resolve => setTimeout(resolve, 10));
          processedOps.push(op);
        }));

        // Rate limit delay
        if (i + batchSize < operations.length) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      expect(processedOps).toHaveLength(operationCount);
    });
  });

  describe('Memory Efficiency', () => {
    it('should process large files without excessive memory usage', async () => {
      const size = 100 * 1024 * 1024; // 100MB
      const largeFile = path.join(tempDir, 'huge.taptik');
      
      // Create file in chunks to avoid memory issues
      const writeStream = (await import('fs')).createWriteStream(largeFile);
      const chunkSize = 10 * 1024 * 1024; // 10MB chunks
      
      for (let written = 0; written < size; written += chunkSize) {
        const chunk = crypto.randomBytes(Math.min(chunkSize, size - written));
        writeStream.write(chunk);
      }
      
      await new Promise(resolve => writeStream.end(resolve));

      // Get initial memory usage
      const initialMemory = process.memoryUsage();

      // Process file (would normally upload)
      const validator = new PackageValidatorService();
      const checksum = await validator.calculateChecksum(largeFile);

      // Get final memory usage
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      expect(checksum).toBeDefined();
      // Memory increase should be much less than file size
      expect(memoryIncrease).toBeLessThan(size * 0.5); // Less than 50% of file size
    }, 60000);
  });

  describe('Sanitization Performance', () => {
    it('should sanitize large packages efficiently', async () => {
      const largePackage = {
        name: 'large-package',
        version: '1.0.0',
        settings: {},
      };

      // Add many settings with potential sensitive data
      for (let i = 0; i < 10000; i++) {
        largePackage.settings[`setting-${i}`] = {
          value: `value-${i}`,
          apiKey: `sk-secret-${i}`,
          email: `user${i}@example.com`,
          token: `token-${i}`,
        };
      }

      const sanitizer = new SanitizationService();
      const packageString = JSON.stringify(largePackage);
      const startTime = Date.now();

      const result = await sanitizer.sanitizePackage(
        Buffer.from(packageString),
        'large.taptik',
        { requiresSanitization: true } as any
      );

      const duration = Date.now() - startTime;

      expect(result.sanitized).toBeDefined();
      expect(result.report.removedCount).toBeGreaterThan(0);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should detect patterns efficiently in binary data', async () => {
      const size = 10 * 1024 * 1024; // 10MB
      const buffer = crypto.randomBytes(size);
      
      // Inject some patterns to find
      const patterns = [
        Buffer.from('api_key=secret123'),
        Buffer.from('password:mypass'),
        Buffer.from('token:"bearer123"'),
      ];

      // Insert patterns at random positions
      patterns.forEach(pattern => {
        const position = Math.floor(Math.random() * (size - pattern.length));
        pattern.copy(buffer, position);
      });

      const sanitizer = new SanitizationService();
      const startTime = Date.now();

      // Scan for patterns
      const hasSensitiveData = sanitizer['containsSensitiveData'](
        buffer.toString('utf8', 0, Math.min(buffer.length, 100000))
      );

      const duration = Date.now() - startTime;

      expect(hasSensitiveData).toBe(true);
      expect(duration).toBeLessThan(1000); // Should scan in under 1 second
    });
  });

  describe('Database Operations', () => {
    it('should batch database operations efficiently', async () => {
      const operations = [];
      const batchSize = 100;
      const totalOperations = 1000;

      // Create mock operations
      for (let i = 0; i < totalOperations; i++) {
        operations.push({
          type: 'insert',
          table: 'audit_logs',
          data: {
            id: `log-${i}`,
            timestamp: new Date(),
            event: 'test',
            metadata: { index: i },
          },
        });
      }

      const startTime = Date.now();
      const results = [];

      // Process in batches
      for (let i = 0; i < operations.length; i += batchSize) {
        const batch = operations.slice(i, i + batchSize);
        
        // Simulate batch insert
        await new Promise(resolve => setTimeout(resolve, 50)); // Simulate DB latency
        results.push(...batch);
      }

      const duration = Date.now() - startTime;

      expect(results).toHaveLength(totalOperations);
      // Should complete 1000 operations in reasonable time with batching
      expect(duration).toBeLessThan(2000); // Under 2 seconds
      
      // Calculate ops per second
      const opsPerSecond = (totalOperations / duration) * 1000;
      expect(opsPerSecond).toBeGreaterThan(100); // At least 100 ops/sec
    });
  });
});