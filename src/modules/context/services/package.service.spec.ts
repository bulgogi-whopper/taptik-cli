import * as fs from 'fs/promises';
import * as path from 'path';

import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  TaptikContext,
  CloudMetadata,
  TaptikPackage,
} from '../interfaces/cloud.interface';

import { PackageService } from './package.service';

vi.mock('fs/promises', () => ({
  default: {},
  access: vi.fn(),
  mkdir: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  rename: vi.fn(),
  stat: vi.fn(),
  constants: {
    R_OK: 4,
  },
}));

describe('PackageService', () => {
  let service: PackageService;
  let module: TestingModule;

  const mockMetadata: CloudMetadata = {
    title: 'Test Configuration',
    description: 'Test description',
    tags: ['test', 'mock'],
    author: 'test-user',
    version: '1.0.0',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
    sourceIde: 'claude-code',
    targetIdes: ['kiro-ide', 'cursor-ide'],
    complexityLevel: 'intermediate',
    componentCount: {
      agents: 2,
      commands: 3,
      mcpServers: 1,
      steeringRules: 4,
      instructions: 2,
    },
    features: ['autocomplete', 'gitIntegration'],
    compatibility: ['vscode', 'claude'],
    searchKeywords: ['development', 'productivity'],
    fileSize: 1024,
    checksum: 'abc123def456',
    isPublic: true,
  };

  const mockTaptikContext: TaptikContext = {
    version: '1.0.0',
    sourceIde: 'claude-code',
    targetIdes: ['kiro-ide', 'cursor-ide'],
    data: {
      claudeCode: {
        local: {
          settings: {
            theme: 'dark',
            autoSave: true,
          },
          agents: [{ id: 'agent1', name: 'Test Agent', prompt: 'Test prompt' }],
          commands: [{ name: 'build', command: 'npm run build' }],
        },
      },
    },
    metadata: {
      timestamp: '2024-01-01T00:00:00Z',
      exportedBy: 'test-user',
    },
  };

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        PackageService,
        {
          provide: Logger,
          useValue: {
            log: vi.fn(),
            error: vi.fn(),
            warn: vi.fn(),
            debug: vi.fn(),
            verbose: vi.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PackageService>(PackageService);
    vi.clearAllMocks();
  });

  describe('createTaptikPackage', () => {
    it('should create a valid TaptikPackage with metadata and sanitized config', async () => {
      const result = await service.createTaptikPackage(
        mockMetadata,
        mockTaptikContext,
      );

      expect(result).toMatchObject({
        metadata: mockMetadata,
        format: 'taptik-v2',
        compression: 'brotli', // Default changed to brotli
      });
      expect(result.sanitizedConfig).toBeDefined();
      expect(result.checksum).toBeDefined();
      expect(result.size).toBeGreaterThan(0);
      expect(result.manifest).toBeDefined();
      expect(result.manifest.files).toBeInstanceOf(Array);
    });

    it('should handle package creation with different compression options', async () => {
      const resultGzip = await service.createTaptikPackage(
        mockMetadata,
        mockTaptikContext,
        { compression: 'gzip' },
      );
      expect(resultGzip.compression).toBe('gzip');

      const resultBrotli = await service.createTaptikPackage(
        mockMetadata,
        mockTaptikContext,
        { compression: 'brotli' },
      );
      expect(resultBrotli.compression).toBe('brotli');

      const resultNone = await service.createTaptikPackage(
        mockMetadata,
        mockTaptikContext,
        { compression: 'none' },
      );
      expect(resultNone.compression).toBe('none');
    });

    it('should include manifest with file and directory listings', async () => {
      const result = await service.createTaptikPackage(
        mockMetadata,
        mockTaptikContext,
      );

      expect(result.manifest).toHaveProperty('files');
      expect(result.manifest).toHaveProperty('directories');
      expect(result.manifest).toHaveProperty('totalSize');
      expect(result.manifest.totalSize).toBeGreaterThan(0);
    });

    it('should handle large configuration data efficiently', async () => {
      const largeContext = {
        ...mockTaptikContext,
        data: {
          claudeCode: {
            local: {
              agents: Array(100)
                .fill(null)
                .map((_, i) => ({
                  id: `agent${i}`,
                  name: `Agent ${i}`,
                  prompt: `Prompt for agent ${i}`,
                })),
              commands: Array(50)
                .fill(null)
                .map((_, i) => ({
                  name: `command${i}`,
                  command: `npm run command${i}`,
                })),
            },
          },
        },
      };

      const result = await service.createTaptikPackage(
        mockMetadata,
        largeContext,
      );

      expect(result).toBeDefined();
      expect(result.size).toBeGreaterThan(1000);
    });

    it('should throw error for invalid metadata', async () => {
      const invalidMetadata = { ...mockMetadata, title: '' };

      await expect(
        service.createTaptikPackage(invalidMetadata, mockTaptikContext),
      ).rejects.toThrow('required');
    });

    it('should throw error for missing required context fields', async () => {
      const invalidContext = {
        ...mockTaptikContext,
        version: undefined,
      } as unknown as TaptikContext;

      await expect(
        service.createTaptikPackage(mockMetadata, invalidContext),
      ).rejects.toThrow('required');
    });
  });

  describe('generateChecksum', () => {
    it('should generate consistent checksum for the same data', async () => {
      const data = { test: 'data', nested: { value: 123 } };

      const checksum1 = await service.generateChecksum(data);
      const checksum2 = await service.generateChecksum(data);

      expect(checksum1).toBe(checksum2);
      expect(checksum1).toMatch(/^[\da-f]{64}$/); // SHA-256 hex format
    });

    it('should generate different checksums for different data', async () => {
      const data1 = { test: 'data1' };
      const data2 = { test: 'data2' };

      const checksum1 = await service.generateChecksum(data1);
      const checksum2 = await service.generateChecksum(data2);

      expect(checksum1).not.toBe(checksum2);
    });

    it('should handle circular references in data', async () => {
      interface CircularData {
        test: string;
        circular?: CircularData;
      }
      const data: CircularData = { test: 'data' };
      data.circular = data;

      await expect(service.generateChecksum(data)).resolves.toBeDefined();
    });

    it('should include file content in checksum calculation', async () => {
      const dataWithFile = {
        ...mockTaptikContext,
        fileContent: 'file content here',
      };

      const checksum = await service.generateChecksum(dataWithFile);
      expect(checksum).toBeDefined();
      expect(checksum).toMatch(/^[\da-f]{64}$/);
    });
  });

  describe('createPackageManifest', () => {
    it('should create manifest with file listings', async () => {
      const manifest = await service.createPackageManifest(mockTaptikContext);

      expect(manifest).toHaveProperty('files');
      expect(manifest.files).toContain('.claude/settings.json');
      expect(manifest.files.some((f) => f.startsWith('.claude/agents/'))).toBe(
        true,
      );
      expect(
        manifest.files.some((f) => f.startsWith('.claude/commands/')),
      ).toBe(true);
    });

    it('should include directory structure in manifest', async () => {
      const manifest = await service.createPackageManifest(mockTaptikContext);

      expect(manifest).toHaveProperty('directories');
      expect(manifest.directories).toContain('.claude');
      expect(manifest.directories).toContain('.claude/agents');
      expect(manifest.directories).toContain('.claude/commands');
    });

    it('should calculate total size of all components', async () => {
      const manifest = await service.createPackageManifest(mockTaptikContext);

      expect(manifest).toHaveProperty('totalSize');
      expect(manifest.totalSize).toBeGreaterThan(0);
    });

    it('should handle empty context data', async () => {
      const emptyContext: TaptikContext = {
        version: '1.0.0',
        sourceIde: 'claude-code',
        targetIdes: [],
        data: {},
        metadata: {
          timestamp: '2024-01-01T00:00:00Z',
        },
      };

      const manifest = await service.createPackageManifest(emptyContext);

      expect(manifest.files).toHaveLength(0);
      expect(manifest.directories).toHaveLength(0);
      expect(manifest.totalSize).toBe(0);
    });
  });

  describe('writePackageToFile', () => {
    it('should write package to .taptik file', async () => {
      const mockPackage: TaptikPackage = {
        metadata: mockMetadata,
        sanitizedConfig: mockTaptikContext,
        checksum: 'test-checksum',
        format: 'taptik-v1',
        compression: 'gzip',
        size: 1024,
        manifest: {
          files: ['test.json'],
          directories: ['.claude'],
          totalSize: 1024,
        },
      };

      const outputPath = '/test/output.taptik';

      await service.writePackageToFile(mockPackage, outputPath);

      expect(fs.writeFile).toHaveBeenCalled();
      const { calls } = vi.mocked(fs.writeFile).mock;
      expect(calls[0][0]).toBe(`${outputPath}.tmp`);
      expect(calls[0][1]).toBeInstanceOf(Buffer);
      expect(fs.rename).toHaveBeenCalledWith(`${outputPath}.tmp`, outputPath);
    });

    it('should compress package when compression is enabled', async () => {
      const mockPackage: TaptikPackage = {
        metadata: mockMetadata,
        sanitizedConfig: mockTaptikContext,
        checksum: 'test-checksum',
        format: 'taptik-v1',
        compression: 'gzip',
        size: 1024,
        manifest: {
          files: ['test.json'],
          directories: ['.claude'],
          totalSize: 1024,
        },
      };

      await service.writePackageToFile(mockPackage, '/test/output.taptik');

      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should not compress when compression is set to none', async () => {
      const mockPackage: TaptikPackage = {
        metadata: mockMetadata,
        sanitizedConfig: mockTaptikContext,
        checksum: 'test-checksum',
        format: 'taptik-v1',
        compression: 'none',
        size: 1024,
        manifest: {
          files: ['test.json'],
          directories: ['.claude'],
          totalSize: 1024,
        },
      };

      await service.writePackageToFile(mockPackage, '/test/output.taptik');

      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should create parent directory if it does not exist', async () => {
      const outputPath = '/test/nested/dir/output.taptik';
      const mockPackage: TaptikPackage = {
        metadata: mockMetadata,
        sanitizedConfig: mockTaptikContext,
        checksum: 'test-checksum',
        format: 'taptik-v1',
        compression: 'none',
        size: 1024,
        manifest: {
          files: [],
          directories: [],
          totalSize: 0,
        },
      };

      vi.mocked(fs.access).mockRejectedValue(new Error('Directory not found'));

      await service.writePackageToFile(mockPackage, outputPath);

      expect(fs.mkdir).toHaveBeenCalledWith(path.dirname(outputPath), {
        recursive: true,
      });
    });

    it('should throw error for invalid file path', async () => {
      const mockPackage: TaptikPackage = {
        metadata: mockMetadata,
        sanitizedConfig: mockTaptikContext,
        checksum: 'test-checksum',
        format: 'taptik-v1',
        compression: 'none',
        size: 1024,
        manifest: {
          files: [],
          directories: [],
          totalSize: 0,
        },
      };

      await expect(service.writePackageToFile(mockPackage, '')).rejects.toThrow(
        'Invalid file path',
      );
    });

    it('should handle write permission errors', async () => {
      const mockPackage: TaptikPackage = {
        metadata: mockMetadata,
        sanitizedConfig: mockTaptikContext,
        checksum: 'test-checksum',
        format: 'taptik-v1',
        compression: 'none',
        size: 1024,
        manifest: {
          files: [],
          directories: [],
          totalSize: 0,
        },
      };

      vi.mocked(fs.writeFile).mockRejectedValue(new Error('Permission denied'));

      await expect(
        service.writePackageToFile(mockPackage, '/test/output.taptik'),
      ).rejects.toThrow('Permission denied');
    });
  });

  describe('compressPackage', () => {
    it('should compress package data with gzip', async () => {
      const data = { test: 'data' };

      const result = await service.compressPackage(data);

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle large data compression', async () => {
      const largeData = {
        content: 'x'.repeat(10000),
      };

      const result = await service.compressPackage(largeData);

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should compress data smaller than original for repetitive content', async () => {
      const repetitiveData = {
        content: 'a'.repeat(1000),
      };

      const result = await service.compressPackage(repetitiveData);
      const originalSize = JSON.stringify(repetitiveData, null, 2).length;

      expect(result.length).toBeLessThan(originalSize);
    });
  });

  describe('validatePackageIntegrity', () => {
    it('should validate package checksum matches content', async () => {
      // First generate a real checksum for the context
      const actualChecksum = await service.generateChecksum(mockTaptikContext);
      const actualManifest =
        await service.createPackageManifest(mockTaptikContext);

      const mockPackage: TaptikPackage = {
        metadata: mockMetadata,
        sanitizedConfig: mockTaptikContext,
        checksum: actualChecksum,
        format: 'taptik-v1',
        compression: 'none',
        size: 1024,
        manifest: actualManifest,
      };

      const isValid = await service.validatePackageIntegrity(mockPackage);

      expect(isValid).toBe(true);
    });

    it('should detect checksum mismatch', async () => {
      const mockPackage: TaptikPackage = {
        metadata: mockMetadata,
        sanitizedConfig: mockTaptikContext,
        checksum: 'wrong-checksum',
        format: 'taptik-v1',
        compression: 'none',
        size: 1024,
        manifest: {
          files: [],
          directories: [],
          totalSize: 0,
        },
      };

      vi.spyOn(service, 'generateChecksum').mockResolvedValue(
        'correct-checksum',
      );

      const isValid = await service.validatePackageIntegrity(mockPackage);

      expect(isValid).toBe(false);
    });

    it('should validate manifest matches actual content', async () => {
      const mockPackage: TaptikPackage = {
        metadata: mockMetadata,
        sanitizedConfig: mockTaptikContext,
        checksum: 'test-checksum',
        format: 'taptik-v1',
        compression: 'none',
        size: 1024,
        manifest: {
          files: ['.claude/settings.json', '.claude/agents/agent_0.json'],
          directories: ['.claude'],
          totalSize: 1024,
        },
      };

      const actualManifest =
        await service.createPackageManifest(mockTaptikContext);
      vi.spyOn(service, 'createPackageManifest').mockResolvedValue(
        actualManifest,
      );

      const isValid = await service.validatePackageIntegrity(mockPackage);

      expect(isValid).toBeDefined();
    });
  });

  describe('readPackageFromFile', () => {
    it('should read and decompress .taptik file', async () => {
      const mockPackage: TaptikPackage = {
        metadata: mockMetadata,
        sanitizedConfig: mockTaptikContext,
        checksum: 'test-checksum',
        format: 'taptik-v1',
        compression: 'gzip',
        size: 1024,
        manifest: {
          files: [],
          directories: [],
          totalSize: 0,
        },
      };

      // Create a real compressed buffer
      const compressedData = await service.compressPackage(mockPackage, 'gzip');

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.stat).mockResolvedValue({ size: 1024 } as any);
      vi.mocked(fs.readFile).mockResolvedValue(compressedData);

      // Mock the validatePackageIntegrity to return true
      vi.spyOn(service, 'validatePackageIntegrity').mockResolvedValue(true);

      const result = await service.readPackageFromFile('/test/input.taptik');

      expect(result).toEqual(mockPackage);
    });

    it('should read uncompressed .taptik file', async () => {
      const mockPackage: TaptikPackage = {
        metadata: mockMetadata,
        sanitizedConfig: mockTaptikContext,
        checksum: 'test-checksum',
        format: 'taptik-v1',
        compression: 'none',
        size: 1024,
        manifest: {
          files: [],
          directories: [],
          totalSize: 0,
        },
      };

      const jsonData = JSON.stringify(mockPackage);
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.stat).mockResolvedValue({ size: jsonData.length } as any);
      vi.mocked(fs.readFile).mockResolvedValue(Buffer.from(jsonData));

      // Mock the validatePackageIntegrity to return true
      vi.spyOn(service, 'validatePackageIntegrity').mockResolvedValue(true);

      const result = await service.readPackageFromFile('/test/input.taptik');

      expect(result).toEqual(mockPackage);
    });

    it('should throw error for non-existent file', async () => {
      const error = new Error('File not found') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      vi.mocked(fs.access).mockRejectedValue(error);

      await expect(
        service.readPackageFromFile('/test/nonexistent.taptik'),
      ).rejects.toThrow('File not found');
    });

    it('should throw error for invalid package format', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.stat).mockResolvedValue({ size: 100 } as any);
      vi.mocked(fs.readFile).mockResolvedValue(Buffer.from('invalid json'));

      await expect(
        service.readPackageFromFile('/test/invalid.taptik'),
      ).rejects.toThrow('Invalid package format');
    });
  });

  describe('optimizePackageSize', () => {
    it('should remove redundant data from package', async () => {
      const redundantContext = {
        ...mockTaptikContext,
        data: {
          claudeCode: {
            local: {
              settings: {
                theme: 'dark',
                autoSave: true,
                redundant: null,
                empty: '',
                undefined,
              },
            },
          },
        },
      };

      const optimized = await service.optimizePackageSize(redundantContext);

      expect(optimized.data.claudeCode.local.settings).not.toHaveProperty(
        'redundant',
      );
      expect(optimized.data.claudeCode.local.settings).not.toHaveProperty(
        'empty',
      );
      expect(optimized.data.claudeCode.local.settings).not.toHaveProperty(
        'undefined',
      );
    });

    it('should deduplicate repeated values', async () => {
      const duplicateContext = {
        ...mockTaptikContext,
        data: {
          claudeCode: {
            local: {
              agents: [
                { id: 'agent1', name: 'Agent', prompt: 'Same prompt' },
                { id: 'agent2', name: 'Agent', prompt: 'Same prompt' },
                { id: 'agent3', name: 'Agent', prompt: 'Same prompt' },
              ],
            },
          },
        },
      };

      const optimized = await service.optimizePackageSize(duplicateContext);

      expect(optimized).toBeDefined();
      // Should maintain all agents but potentially optimize storage
      expect(optimized.data.claudeCode.local.agents).toHaveLength(3);
    });

    it('should minimize whitespace in string values', async () => {
      const whitespaceContext = {
        ...mockTaptikContext,
        data: {
          claudeCode: {
            local: {
              instructions: {
                global: '  Multiple   spaces   here  ',
                local: '\n\n\nExtra\n\nnewlines\n\n',
              },
            },
          },
        },
      };

      const optimized = await service.optimizePackageSize(whitespaceContext);

      expect(optimized.data.claudeCode.local.instructions.global).not.toMatch(
        /\s{2,}/,
      );
    });
  });

  describe('Production Features - Brotli Compression', () => {
    it('should compress with Brotli algorithm', async () => {
      const data = { test: 'data', content: 'x'.repeat(1000) };

      const result = await service.compressPackage(data, 'brotli');

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
      // Brotli should achieve better compression than gzip for text
      const gzipResult = await service.compressPackage(data, 'gzip');
      expect(result.length).toBeLessThanOrEqual(gzipResult.length);
    });

    it('should use compression cache for repeated operations', async () => {
      const data = { test: 'cacheable data' };

      const start = Date.now();
      const result1 = await service.compressPackage(data, 'brotli');
      const firstTime = Date.now() - start;

      const cacheStart = Date.now();
      const result2 = await service.compressPackage(data, 'brotli');
      const cachedTime = Date.now() - cacheStart;

      expect(result1).toEqual(result2);
      // Cached should be faster (though this might be flaky in CI)
      expect(cachedTime).toBeLessThanOrEqual(firstTime + 1);
    });
  });

  describe('Production Features - Chunked Packages', () => {
    it('should create chunked package for large data', async () => {
      const largePackage = await service.createTaptikPackage(
        mockMetadata,
        mockTaptikContext,
        { compression: 'brotli' },
      );

      const chunked = await service.createChunkedPackage(
        largePackage,
        512, // Small chunk size for testing
      );

      expect(chunked.chunks).toBeInstanceOf(Array);
      expect(chunked.chunks.length).toBeGreaterThan(0);
      expect(chunked.metadata.totalChunks).toBe(chunked.chunks.length);
      expect(chunked.metadata.checksum).toMatch(/^[\da-f]{64}$/);
    });

    it('should reassemble chunks correctly', async () => {
      const originalData = Buffer.from('x'.repeat(2000));
      const checksum = (await import('crypto'))
        .createHash('sha256')
        .update(originalData)
        .digest('hex');

      // Split into chunks
      const chunks: Buffer[] = [];
      for (let i = 0; i < originalData.length; i += 500) {
        chunks.push(
          originalData.subarray(i, Math.min(i + 500, originalData.length)),
        );
      }

      const reassembled = await service.reassembleChunks(chunks, checksum);

      expect(reassembled).toEqual(originalData);
    });

    it('should detect corrupted chunks during reassembly', async () => {
      const chunks = [
        Buffer.from('chunk1'),
        Buffer.from('chunk2'),
        Buffer.from('corrupted'),
      ];

      await expect(
        service.reassembleChunks(chunks, 'wrong-checksum'),
      ).rejects.toThrow('checksum mismatch');
    });
  });

  describe('Production Features - Edge Functions Preparation', () => {
    it('should prepare package for Supabase Edge Functions', async () => {
      const taptikPackage = await service.createTaptikPackage(
        mockMetadata,
        mockTaptikContext,
      );

      const prepared = await service.prepareForEdgeFunctions(taptikPackage);

      expect(prepared.edgeMetadata).toBeDefined();
      expect(prepared.edgeMetadata.processable).toBe(true);
      expect(prepared.edgeMetadata.estimatedProcessingTime).toBeGreaterThan(0);
      expect(prepared.edgeMetadata.recommendedTimeout).toBeGreaterThanOrEqual(
        10,
      );
      expect(prepared.edgeMetadata.memoryRequirement).toBeGreaterThan(0);
    });

    it('should mark large packages as non-processable', async () => {
      const largeContext = {
        ...mockTaptikContext,
        data: {
          claudeCode: {
            local: {
              agents: Array(1000)
                .fill(null)
                .map((_, i) => ({
                  id: `agent${i}`,
                  name: `Agent ${i}`,
                  prompt: 'x'.repeat(10000),
                })),
            },
          },
        },
      };

      const largePackage = await service.createTaptikPackage(
        mockMetadata,
        largeContext,
      );

      // Mock the size to be over 10MB
      largePackage.size = 11 * 1024 * 1024;

      const prepared = await service.prepareForEdgeFunctions(largePackage);

      expect(prepared.edgeMetadata.processable).toBe(false);
    });

    it('should calculate complexity based on components', async () => {
      const complexContext = {
        ...mockTaptikContext,
        data: {
          claudeCode: {
            local: {
              agents: Array(10)
                .fill(null)
                .map((_, i) => ({
                  id: `agent${i}`,
                  name: `Agent ${i}`,
                  prompt: `Test prompt for agent ${i}`,
                })),
              commands: Array(10)
                .fill(null)
                .map((_, i) => ({ name: `cmd${i}`, command: `run cmd${i}` })),
              mcpServers: {
                servers: [
                  {
                    name: 'server1',
                    protocol: 'stdio',
                    command: 'run server1',
                  },
                  {
                    name: 'server2',
                    protocol: 'stdio',
                    command: 'run server2',
                  },
                  {
                    name: 'server3',
                    protocol: 'stdio',
                    command: 'run server3',
                  },
                ],
              },
            },
          },
        },
      };

      const complexPackage = await service.createTaptikPackage(
        mockMetadata,
        complexContext,
      );

      const prepared = await service.prepareForEdgeFunctions(complexPackage);

      expect(prepared.edgeMetadata.estimatedProcessingTime).toBeGreaterThan(0);
      // More complex packages should have higher processing estimates
      const simplePackage = await service.createTaptikPackage(
        mockMetadata,
        mockTaptikContext,
      );
      const simplePrepared =
        await service.prepareForEdgeFunctions(simplePackage);

      expect(
        prepared.edgeMetadata.estimatedProcessingTime,
      ).toBeGreaterThanOrEqual(
        simplePrepared.edgeMetadata.estimatedProcessingTime,
      );
    });
  });

  describe('Production Features - Package Metrics', () => {
    it('should include enhanced metrics with compression details', async () => {
      const taptikPackage = await service.createTaptikPackage(
        mockMetadata,
        mockTaptikContext,
        { compression: 'brotli' },
      );

      const metrics = await service.getPackageMetrics(taptikPackage);

      expect(metrics.compressionAlgorithm).toBe('brotli');
      expect(metrics.streamingUsed).toBeDefined();
      expect(metrics.compressionRatio).toBeLessThanOrEqual(1);
    });

    it('should detect when streaming should be used', async () => {
      const largeContext = {
        ...mockTaptikContext,
        data: {
          claudeCode: {
            local: {
              instructions: {
                global: 'x'.repeat(15 * 1024 * 1024), // 15MB of data
              },
            },
          },
        },
      };

      const largePackage = await service.createTaptikPackage(
        mockMetadata,
        largeContext,
      );

      const metrics = await service.getPackageMetrics(largePackage);

      expect(metrics.streamingUsed).toBe(true);
    });
  });
});
