import { describe, it, expect } from 'vitest';

import { VersionUtils } from './version.utils';

describe('VersionUtils', () => {
  describe('parseVersion', () => {
    it('should parse valid version string', () => {
      const result = VersionUtils.parseVersion('1.2.3');
      expect(result).toEqual({
        major: 1,
        minor: 2,
        patch: 3,
      });
    });

    it('should throw error for invalid version format', () => {
      expect(() => VersionUtils.parseVersion('1.2')).toThrow(
        'Invalid version format: 1.2',
      );
      expect(() => VersionUtils.parseVersion('1.2.3.4')).toThrow(
        'Invalid version format: 1.2.3.4',
      );
      expect(() => VersionUtils.parseVersion('abc')).toThrow(
        'Invalid version format: abc',
      );
    });
  });

  describe('formatVersion', () => {
    it('should format version components to string', () => {
      const result = VersionUtils.formatVersion({
        major: 2,
        minor: 5,
        patch: 10,
      });
      expect(result).toBe('2.5.10');
    });
  });

  describe('bumpVersion', () => {
    it('should bump patch version by default', () => {
      const result = VersionUtils.bumpVersion('1.2.3');
      expect(result).toBe('1.2.4');
    });

    it('should bump patch version explicitly', () => {
      const result = VersionUtils.bumpVersion('1.2.3', 'patch');
      expect(result).toBe('1.2.4');
    });

    it('should bump minor version and reset patch', () => {
      const result = VersionUtils.bumpVersion('1.2.3', 'minor');
      expect(result).toBe('1.3.0');
    });

    it('should bump major version and reset minor and patch', () => {
      const result = VersionUtils.bumpVersion('1.2.3', 'major');
      expect(result).toBe('2.0.0');
    });
  });

  describe('compareVersions', () => {
    it('should return 0 for equal versions', () => {
      expect(VersionUtils.compareVersions('1.2.3', '1.2.3')).toBe(0);
    });

    it('should return 1 when v1 > v2 (major)', () => {
      expect(VersionUtils.compareVersions('2.0.0', '1.9.9')).toBe(1);
    });

    it('should return -1 when v1 < v2 (major)', () => {
      expect(VersionUtils.compareVersions('1.9.9', '2.0.0')).toBe(-1);
    });

    it('should return 1 when v1 > v2 (minor)', () => {
      expect(VersionUtils.compareVersions('1.3.0', '1.2.9')).toBe(1);
    });

    it('should return -1 when v1 < v2 (minor)', () => {
      expect(VersionUtils.compareVersions('1.2.9', '1.3.0')).toBe(-1);
    });

    it('should return 1 when v1 > v2 (patch)', () => {
      expect(VersionUtils.compareVersions('1.2.4', '1.2.3')).toBe(1);
    });

    it('should return -1 when v1 < v2 (patch)', () => {
      expect(VersionUtils.compareVersions('1.2.3', '1.2.4')).toBe(-1);
    });
  });

  describe('getNextVersion', () => {
    it('should return 1.0.0 if no latest version exists', () => {
      expect(VersionUtils.getNextVersion()).toBe('1.0.0');
      expect(VersionUtils.getNextVersion(undefined)).toBe('1.0.0');
    });

    it('should bump patch version by default', () => {
      expect(VersionUtils.getNextVersion('1.2.3')).toBe('1.2.4');
    });

    it('should bump minor version when specified', () => {
      expect(VersionUtils.getNextVersion('1.2.3', 'minor')).toBe('1.3.0');
    });

    it('should bump major version when specified', () => {
      expect(VersionUtils.getNextVersion('1.2.3', 'major')).toBe('2.0.0');
    });
  });
});