import { Injectable, Logger } from '@nestjs/common';

import { TaptikContext } from '../../context/interfaces/taptik-context.interface';
import { MigrationValidationResult, CompatibilityResult, SchemaInfo } from '../interfaces/migration-result.interface';

@Injectable()
export class SchemaMigrationService {
  private readonly logger = new Logger(SchemaMigrationService.name);
  private readonly currentVersion = '1.2.0';
  private readonly supportedVersions = ['1.0.0', '1.1.0', '1.2.0'];

  /**
   * Detects the schema version of a TaptikContext
   */
  detectSchemaVersion(context: TaptikContext): string {
    try {
      // Check explicit version in metadata
      if (context?.metadata?.version) {
        return context.metadata.version;
      }

      // Heuristic detection based on structure
      if (this.hasV12Features(context)) {
        return '1.2.0';
      }

      if (this.hasV11Features(context)) {
        return '1.1.0';
      }

      // Default to oldest version
      return '1.0.0';
    } catch (error) {
      this.logger.warn(`Failed to detect schema version: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return '1.0.0';
    }
  }

  /**
   * Checks if configuration is compatible with current version
   */
  isCompatible(configVersion: string, targetVersion: string = this.currentVersion): CompatibilityResult {
    try {
      const configSemver = this.parseSemver(configVersion);
      const targetSemver = this.parseSemver(targetVersion);

      if (!configSemver || !targetSemver) {
        return {
          compatible: false,
          migrationRequired: false,
          warnings: [`Invalid version format: ${!configSemver ? configVersion : targetVersion}`],
        };
      }

      // Same version - fully compatible
      if (configVersion === targetVersion) {
        return {
          compatible: true,
          migrationRequired: false,
          warnings: [],
        };
      }

      // Future version - not compatible
      if (this.compareVersions(configVersion, targetVersion) > 0) {
        return {
          compatible: false,
          migrationRequired: false,
          warnings: [`Configuration version ${configVersion} is newer than supported version ${targetVersion}`],
          suggestedActions: ['Update taptik-cli to latest version', 'Use a newer IDE version'],
        };
      }

      // Older version - compatible with migration
      const warnings: string[] = [];
      if (configSemver.major < targetSemver.major) {
        warnings.push(`Major version difference: ${configVersion} → ${targetVersion} may require significant migration`);
      } else if (configSemver.minor < targetSemver.minor) {
        warnings.push(`Configuration version ${configVersion} may have reduced functionality with current version ${targetVersion}`);
      }

      return {
        compatible: true,
        migrationRequired: true,
        warnings,
        suggestedActions: warnings.length > 0 ? ['Review migration changes before deployment'] : [],
      };
    } catch (error) {
      return {
        compatible: false,
        migrationRequired: false,
        warnings: [`Version compatibility check failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
      };
    }
  }

  /**
   * Migrates configuration to latest supported version
   */
  async migrateToLatest(context: TaptikContext): Promise<TaptikContext> {
    try {
      const currentVersion = this.detectSchemaVersion(context);
      
      if (currentVersion === this.currentVersion) {
        return context;
      }

      this.logger.log(`Migrating configuration from ${currentVersion} to ${this.currentVersion}`);

      let migrated = { ...context };

      // Apply migrations in sequence
      if (currentVersion === '1.0.0') {
        migrated = await this.migrateV1ToV11(migrated);
        migrated = await this.migrateV11ToV12(migrated);
      } else if (currentVersion === '1.1.0') {
        migrated = await this.migrateV11ToV12(migrated);
      }

      // Update version metadata
      migrated.metadata = {
        ...migrated.metadata,
        version: this.currentVersion,
        exportedAt: new Date().toISOString(),
      };

      this.logger.log(`Successfully migrated configuration to ${this.currentVersion}`);
      return migrated;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Migration failed: ${message}`);
      throw new Error(`Migration failed: ${message}`);
    }
  }

  /**
   * Validates that migration preserved important data
   */
  async validateMigration(original: TaptikContext, migrated: TaptikContext): Promise<MigrationValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Check that essential data is preserved
      if (original.content?.personal && !migrated.content?.personal) {
        errors.push('Data loss detected: personal content missing after migration');
      }

      if (original.content?.project && !migrated.content?.project) {
        errors.push('Data loss detected: project content missing after migration');
      }

      // Validate schema version
      const migratedVersion = this.detectSchemaVersion(migrated);
      if (!this.isValidVersion(migratedVersion)) {
        errors.push(`Invalid target schema version: ${migratedVersion}`);
      }

      // Check for structural integrity
      if (!migrated.metadata || !migrated.content || !migrated.security) {
        errors.push('Migration resulted in invalid context structure');
      }

      // Validate security section
      if (!migrated.security.scanResults) {
        warnings.push('Security scan results missing after migration');
      }

      return {
        passed: errors.length === 0,
        errors,
        warnings,
      };
    } catch (error) {
      return {
        passed: false,
        errors: [`Migration validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings,
      };
    }
  }

  /**
   * Returns the migration path from source to target version
   */
  getMigrationPath(sourceVersion: string, targetVersion: string): string[] {
    if (sourceVersion === targetVersion) {
      return [];
    }

    if (this.compareVersions(sourceVersion, targetVersion) > 0) {
      return [`Downgrade not supported: ${sourceVersion} → ${targetVersion}`];
    }

    const path: string[] = [];

    if (sourceVersion === '1.0.0' && targetVersion === '1.2.0') {
      path.push('1.0.0 → 1.1.0', '1.1.0 → 1.2.0');
    } else if (sourceVersion === '1.0.0' && targetVersion === '1.1.0') {
      path.push('1.0.0 → 1.1.0');
    } else if (sourceVersion === '1.1.0' && targetVersion === '1.2.0') {
      path.push('1.1.0 → 1.2.0');
    }

    return path;
  }

  /**
   * Returns detailed information about a schema version
   */
  getSchemaInfo(version: string): SchemaInfo {
    const info: Record<string, SchemaInfo> = {
      '1.0.0': {
        version: '1.0.0',
        features: [
          'Basic context structure',
          'Personal and project settings',
          'Simple IDE configuration',
          'Basic security scanning',
        ],
        deprecatedFeatures: [],
        compatibleWith: [],
        migrationComplexity: 'low',
      },
      '1.1.0': {
        version: '1.1.0',
        features: [
          'Enhanced personal profiles',
          'Project architecture settings',
          'Custom tools and scripts',
          'Improved IDE support',
          'MCP server configuration',
        ],
        deprecatedFeatures: ['Basic IDE settings format'],
        compatibleWith: ['1.0.0'],
        migrationComplexity: 'medium',
      },
      '1.2.0': {
        version: '1.2.0',
        features: [
          'Enhanced security patterns',
          'Advanced prompt templates',
          'Multi-platform IDE support',
          'Agent and command management',
          'Comprehensive MCP integration',
          'Detailed security auditing',
        ],
        deprecatedFeatures: ['Legacy tool format', 'Simple IDE configuration'],
        compatibleWith: ['1.0.0', '1.1.0'],
        migrationComplexity: 'high',
      },
    };

    return info[version] || {
      version: 'unknown',
      features: [],
      deprecatedFeatures: [],
      compatibleWith: [],
    };
  }

  private hasV12Features(context: TaptikContext): boolean {
    return !!(
      context?.content?.prompts?.system_prompts ||
      context?.content?.tools?.agents ||
      context?.content?.ide?.['claude-code'] ||
      context?.security?.detectedPatterns !== undefined
    );
  }

  private hasV11Features(context: TaptikContext): boolean {
    return !!(
      context?.content?.personal?.profile ||
      context?.content?.project?.architecture ||
      context?.content?.tools?.custom_tools ||
      context?.content?.ide?.claudeCode?.mcp_config
    );
  }

  private async migrateV1ToV11(context: TaptikContext): Promise<TaptikContext> {
    const migrated = { ...context };

    // Enhance personal section
    if (migrated.content.personal) {
      migrated.content.personal = {
        ...migrated.content.personal,
        profile: {
          name: migrated.content.personal.name,
          email: migrated.content.personal.email,
          experience_years: 0, // Default value
          primary_role: 'developer', // Default value
        },
        preferences: {
          theme: 'dark', // Default value
        },
        communication: {
          explanation_level: 'standard', // Default value
        },
      };
    }

    // Enhance project section
    if (migrated.content.project) {
      migrated.content.project = {
        ...migrated.content.project,
        architecture: {
          pattern: 'monolith', // Default value
        },
        tech_stack: {
          language: 'javascript', // Default value
        },
      };
    }

    // Add tools section if missing
    if (!migrated.content.tools) {
      migrated.content.tools = {
        custom_tools: [],
      };
    }

    // Enhance IDE section
    if (migrated.content.ide?.claudeCode) {
      migrated.content.ide.claudeCode = {
        ...migrated.content.ide.claudeCode,
        mcp_config: {},
      };
    }

    return migrated;
  }

  private async migrateV11ToV12(context: TaptikContext): Promise<TaptikContext> {
    const migrated = { ...context };

    // Add prompts section
    if (!migrated.content.prompts) {
      migrated.content.prompts = {
        system_prompts: [],
        templates: [],
        examples: [],
      };
    }

    // Enhance tools section
    if (migrated.content.tools) {
      migrated.content.tools = {
        ...migrated.content.tools,
        mcp_servers: migrated.content.tools.mcp_servers || [],
        agents: migrated.content.tools.agents || [],
        commands: migrated.content.tools.commands || [],
      };
    }

    // Update IDE section to new format
    if (migrated.content.ide?.claudeCode) {
      const claudeCodeConfig = migrated.content.ide.claudeCode;
      delete migrated.content.ide.claudeCode;
      
      migrated.content.ide['claude-code'] = {
        ...claudeCodeConfig,
        claude_md: claudeCodeConfig.claude_md || '',
      };
    }

    // Enhance security section
    if (migrated.security) {
      migrated.security = {
        ...migrated.security,
        detectedPatterns: migrated.security.detectedPatterns || [],
      };
    }

    return migrated;
  }

  private parseSemver(version: string): { major: number; minor: number; patch: number } | null {
    const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
    if (!match) return null;

    return {
      major: Number.parseInt(match[1], 10),
      minor: Number.parseInt(match[2], 10),
      patch: Number.parseInt(match[3], 10),
    };
  }

  private compareVersions(version1: string, version2: string): number {
    const v1 = this.parseSemver(version1);
    const v2 = this.parseSemver(version2);

    if (!v1 || !v2) return 0;

    if (v1.major !== v2.major) return v1.major - v2.major;
    if (v1.minor !== v2.minor) return v1.minor - v2.minor;
    return v1.patch - v2.patch;
  }

  private isValidVersion(version: string): boolean {
    return this.supportedVersions.includes(version);
  }
}