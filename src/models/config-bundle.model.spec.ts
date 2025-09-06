import { describe, it, expect } from 'vitest';

import {
  ConfigBundle,
  DisplayConfiguration,
  ListOptions,
  ConfigurationListResult,
  toDisplayConfiguration,
  formatFileSize,
  validateListOptions,
  DEFAULT_LIST_OPTIONS,
  MAX_LIST_LIMIT,
  DEFAULT_LIST_LIMIT,
} from './config-bundle.model';

describe('ConfigBundle Models', () => {
  const mockConfigBundle: ConfigBundle = {
    id: 'test-id-123',
    title: 'Test Configuration',
    description: 'A test configuration bundle',
    source_ide: 'claude-code',
    target_ides: ['kiro-ide', 'cursor-ide'],
    tags: ['frontend', 'typescript'],
    is_public: true,
    file_path: '/public/test-config.taptik',
    file_size: 2457600, // 2.4MB
    download_count: 42,
    like_count: 15,
    version: '1.0.0',
    created_at: new Date('2025-08-20T10:00:00Z'),
    updated_at: new Date('2025-08-20T10:00:00Z'),
    user_id: 'user-123',
    author: 'testuser',
    isLiked: false,
  };

  describe('toDisplayConfiguration', () => {
    it('should convert ConfigBundle to DisplayConfiguration', () => {
      const result = toDisplayConfiguration(mockConfigBundle);

      expect(result).toEqual({
        id: 'test-id-123',
        title: 'Test Configuration',
        description: 'A test configuration bundle',
        createdAt: new Date('2025-08-20T10:00:00Z'),
        size: '2.3 MB',
        accessLevel: 'Public',
        author: 'testuser',
        isLiked: false,
      });
    });

    it('should handle private configurations', () => {
      const privateBundle = { ...mockConfigBundle, is_public: false };
      const result = toDisplayConfiguration(privateBundle);

      expect(result.accessLevel).toBe('Private');
    });

    it('should handle missing optional fields', () => {
      const minimalBundle: ConfigBundle = {
        ...mockConfigBundle,
        description: undefined,
        author: undefined,
        isLiked: undefined,
      };

      const result = toDisplayConfiguration(minimalBundle);

      expect(result.description).toBeUndefined();
      expect(result.author).toBeUndefined();
      expect(result.isLiked).toBeUndefined();
    });
  });

  describe('formatFileSize', () => {
    it('should format bytes correctly', () => {
      expect(formatFileSize(0)).toBe('0 B');
      expect(formatFileSize(512)).toBe('512 B');
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(1536)).toBe('1.5 KB');
      expect(formatFileSize(1048576)).toBe('1 MB');
      expect(formatFileSize(2457600)).toBe('2.3 MB');
      expect(formatFileSize(1073741824)).toBe('1 GB');
    });

    it('should handle large file sizes', () => {
      expect(formatFileSize(5368709120)).toBe('5 GB');
      expect(formatFileSize(1099511627776)).toBe('1 TB');
    });
  });

  describe('validateListOptions', () => {
    it('should validate correct options', () => {
      const validOptions: ListOptions = {
        filter: 'test',
        sort: 'date',
        limit: 20,
      };

      const result = validateListOptions(validOptions);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate sort options', () => {
      const invalidSort = validateListOptions({ sort: 'invalid' as any });
      expect(invalidSort.isValid).toBe(false);
      expect(invalidSort.errors).toContain(
        "Invalid sort option 'invalid'. Valid options: date, name",
      );

      const validDate = validateListOptions({ sort: 'date' });
      expect(validDate.isValid).toBe(true);

      const validName = validateListOptions({ sort: 'name' });
      expect(validName.isValid).toBe(true);
    });

    it('should validate limit options', () => {
      const zeroLimit = validateListOptions({ limit: 0 });
      expect(zeroLimit.isValid).toBe(false);
      expect(zeroLimit.errors).toContain('Limit must be greater than 0');

      const negativeLimit = validateListOptions({ limit: -5 });
      expect(negativeLimit.isValid).toBe(false);
      expect(negativeLimit.errors).toContain('Limit must be greater than 0');

      const tooHighLimit = validateListOptions({ limit: 150 });
      expect(tooHighLimit.isValid).toBe(false);
      expect(tooHighLimit.errors).toContain('Limit cannot exceed 100');

      const validLimit = validateListOptions({ limit: 50 });
      expect(validLimit.isValid).toBe(true);
    });

    it('should validate filter options', () => {
      const invalidFilter = validateListOptions({ filter: 123 as any });
      expect(invalidFilter.isValid).toBe(false);
      expect(invalidFilter.errors).toContain('Filter must be a string');

      const validFilter = validateListOptions({ filter: 'test query' });
      expect(validFilter.isValid).toBe(true);
    });

    it('should handle multiple validation errors', () => {
      const multipleErrors = validateListOptions({
        sort: 'invalid' as any,
        limit: 0,
        filter: 123 as any,
      });

      expect(multipleErrors.isValid).toBe(false);
      expect(multipleErrors.errors).toHaveLength(3);
    });

    it('should handle empty options', () => {
      const emptyOptions = validateListOptions({});
      expect(emptyOptions.isValid).toBe(true);
      expect(emptyOptions.errors).toHaveLength(0);
    });
  });

  describe('Constants', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_LIST_OPTIONS).toEqual({
        filter: '',
        sort: 'date',
        limit: 20,
      });

      expect(MAX_LIST_LIMIT).toBe(100);
      expect(DEFAULT_LIST_LIMIT).toBe(20);
    });
  });

  describe('Type definitions', () => {
    it('should define correct interfaces', () => {
      // Test that interfaces are properly defined by creating instances
      const listOptions: ListOptions = {
        filter: 'test',
        sort: 'name',
        limit: 10,
      };

      const displayConfig: DisplayConfiguration = {
        id: 'test',
        title: 'Test',
        createdAt: new Date(),
        size: '1 MB',
        accessLevel: 'Public',
      };

      const listResult: ConfigurationListResult = {
        configurations: [displayConfig],
        totalCount: 1,
        hasMore: false,
      };

      // If these compile without errors, the interfaces are correctly defined
      expect(listOptions.sort).toBe('name');
      expect(displayConfig.accessLevel).toBe('Public');
      expect(listResult.totalCount).toBe(1);
    });
  });
});
