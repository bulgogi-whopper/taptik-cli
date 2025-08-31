export type VersionBumpType = 'major' | 'minor' | 'patch';

export interface VersionInfo {
  major: number;
  minor: number;
  patch: number;
}

export class VersionUtils {
  /**
   * Parse a semantic version string into components
   */
  static parseVersion(version: string): VersionInfo {
    const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
    if (!match) {
      throw new Error(`Invalid version format: ${version}`);
    }

    return {
      major: parseInt(match[1], 10),
      minor: parseInt(match[2], 10),
      patch: parseInt(match[3], 10),
    };
  }

  /**
   * Format version components into a string
   */
  static formatVersion(version: VersionInfo): string {
    return `${version.major}.${version.minor}.${version.patch}`;
  }

  /**
   * Bump version based on bump type
   */
  static bumpVersion(currentVersion: string, bumpType: VersionBumpType = 'patch'): string {
    const version = this.parseVersion(currentVersion);

    switch (bumpType) {
      case 'major':
        version.major++;
        version.minor = 0;
        version.patch = 0;
        break;
      case 'minor':
        version.minor++;
        version.patch = 0;
        break;
      case 'patch':
        version.patch++;
        break;
    }

    return this.formatVersion(version);
  }

  /**
   * Compare two version strings
   * Returns: -1 if v1 < v2, 0 if v1 === v2, 1 if v1 > v2
   */
  static compareVersions(v1: string, v2: string): number {
    const version1 = this.parseVersion(v1);
    const version2 = this.parseVersion(v2);

    if (version1.major !== version2.major) {
      return version1.major > version2.major ? 1 : -1;
    }
    if (version1.minor !== version2.minor) {
      return version1.minor > version2.minor ? 1 : -1;
    }
    if (version1.patch !== version2.patch) {
      return version1.patch > version2.patch ? 1 : -1;
    }
    return 0;
  }

  /**
   * Get next available version (auto-increment patch by default)
   */
  static getNextVersion(latestVersion?: string, bumpType: VersionBumpType = 'patch'): string {
    if (!latestVersion) {
      return '1.0.0';
    }
    return this.bumpVersion(latestVersion, bumpType);
  }
}