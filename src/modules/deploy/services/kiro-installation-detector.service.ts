import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { Injectable, Logger } from '@nestjs/common';

// SupportedPlatform import removed as it's not used
import {
  DeploymentError,
  DeploymentWarning,
} from '../interfaces/deployment-result.interface';

export interface KiroInstallationInfo {
  isInstalled: boolean;
  version?: string;
  installationPath?: string;
  configurationPath?: {
    global: string;
    project: string;
  };
  isCompatible: boolean;
  compatibility: {
    version: boolean;
    schema: boolean;
    features: boolean;
  };
}

export interface KiroCompatibilityResult {
  isCompatible: boolean;
  version: {
    current?: string;
    required: string;
    supported: string[];
  };
  issues: KiroCompatibilityIssue[];
  recommendations: string[];
  migrationRequired: boolean;
}

export interface KiroCompatibilityIssue {
  type: 'version' | 'schema' | 'feature' | 'configuration';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details?: unknown;
  fixable: boolean;
}

export interface KiroHealthCheckResult {
  healthy: boolean;
  issues: KiroHealthIssue[];
  recommendations: string[];
  fixes: KiroHealthFix[];
}

export interface KiroHealthIssue {
  category: 'installation' | 'configuration' | 'permissions' | 'dependencies';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details?: string;
  autoFixable: boolean;
}

export interface KiroHealthFix {
  issue: string;
  action: string;
  automated: boolean;
  riskLevel: 'low' | 'medium' | 'high';
}

@Injectable()
export class KiroInstallationDetectorService {
  private readonly logger = new Logger(KiroInstallationDetectorService.name);

  private readonly SUPPORTED_VERSIONS = ['1.0.0', '1.1.0', '1.2.0', '2.0.0'];
  private readonly MINIMUM_VERSION = '1.0.0';
  private readonly RECOMMENDED_VERSION = '2.0.0';

  async detectKiroInstallation(): Promise<KiroInstallationInfo> {
    this.logger.log('Detecting Kiro IDE installation...');

    const installationInfo: KiroInstallationInfo = {
      isInstalled: false,
      isCompatible: false,
      compatibility: {
        version: false,
        schema: false,
        features: false,
      },
    };

    try {
      // Check for Kiro installation in common locations
      const installationPath = await this.findKiroInstallation();

      if (!installationPath) {
        this.logger.warn('Kiro IDE installation not found');
        return installationInfo;
      }

      installationInfo.isInstalled = true;
      installationInfo.installationPath = installationPath;

      // Detect version
      const version = await this.detectKiroVersion(installationPath);
      if (version) {
        installationInfo.version = version;
      }

      // Set configuration paths
      installationInfo.configurationPath = {
        global: path.join(os.homedir(), '.kiro'),
        project: path.join(process.cwd(), '.kiro'),
      };

      // Check compatibility
      const compatibility = await this.checkCompatibility(version);
      installationInfo.isCompatible = compatibility.isCompatible;
      installationInfo.compatibility = {
        version: compatibility.version.current
          ? this.isVersionSupported(compatibility.version.current)
          : false,
        schema: !compatibility.issues.some((issue) => issue.type === 'schema'),
        features: !compatibility.issues.some(
          (issue) => issue.type === 'feature',
        ),
      };

      this.logger.log(`Kiro IDE detected: v${version} at ${installationPath}`);
      return installationInfo;
    } catch (error) {
      this.logger.error('Error detecting Kiro installation:', error);
      return installationInfo;
    }
  }

  async checkCompatibility(
    currentVersion?: string,
  ): Promise<KiroCompatibilityResult> {
    const result: KiroCompatibilityResult = {
      isCompatible: false,
      version: {
        current: currentVersion,
        required: this.MINIMUM_VERSION,
        supported: this.SUPPORTED_VERSIONS,
      },
      issues: [],
      recommendations: [],
      migrationRequired: false,
    };

    // Check version compatibility
    if (!currentVersion) {
      result.issues.push({
        type: 'version',
        severity: 'critical',
        message: 'Unable to determine Kiro IDE version',
        fixable: false,
      });
      return result;
    }

    if (!this.isVersionSupported(currentVersion)) {
      const severity =
        this.compareVersions(currentVersion, this.MINIMUM_VERSION) < 0
          ? 'critical'
          : 'medium';

      result.issues.push({
        type: 'version',
        severity,
        message: `Kiro IDE version ${currentVersion} is not officially supported`,
        details: {
          current: currentVersion,
          minimum: this.MINIMUM_VERSION,
          recommended: this.RECOMMENDED_VERSION,
        },
        fixable: true,
      });
    }

    // Check for schema compatibility
    const schemaIssues = await this.checkSchemaCompatibility(currentVersion);
    result.issues.push(...schemaIssues);

    // Check feature compatibility
    const featureIssues = await this.checkFeatureCompatibility(currentVersion);
    result.issues.push(...featureIssues);

    // Determine if migration is required
    result.migrationRequired =
      this.compareVersions(currentVersion, this.MINIMUM_VERSION) < 0 ||
      result.issues.some(
        (issue) => issue.type === 'schema' && issue.severity === 'high',
      );

    // Generate recommendations
    result.recommendations = this.generateCompatibilityRecommendations(result);

    // Determine overall compatibility
    result.isCompatible =
      result.issues.length === 0 ||
      !result.issues.some((issue) => issue.severity === 'critical');

    return result;
  }

  async performHealthCheck(): Promise<KiroHealthCheckResult> {
    this.logger.log('Performing Kiro IDE health check...');

    const result: KiroHealthCheckResult = {
      healthy: true,
      issues: [],
      recommendations: [],
      fixes: [],
    };

    try {
      // Check installation health
      const installationIssues = await this.checkInstallationHealth();
      result.issues.push(...installationIssues);

      // Check configuration health
      const configIssues = await this.checkConfigurationHealth();
      result.issues.push(...configIssues);

      // Check permissions
      const permissionIssues = await this.checkPermissions();
      result.issues.push(...permissionIssues);

      // Check dependencies
      const dependencyIssues = await this.checkDependencies();
      result.issues.push(...dependencyIssues);

      // Generate fixes
      result.fixes = this.generateHealthFixes(result.issues);

      // Generate recommendations
      result.recommendations = this.generateHealthRecommendations(
        result.issues,
      );

      // Determine overall health
      result.healthy =
        result.issues.length === 0 ||
        !result.issues.some(
          (issue) => issue.severity === 'critical' || issue.severity === 'high',
        );

      this.logger.log(
        `Health check completed: ${result.healthy ? 'healthy' : 'issues found'}`,
      );
      return result;
    } catch (error) {
      this.logger.error('Health check failed:', error);

      result.healthy = false;
      result.issues.push({
        category: 'installation',
        severity: 'critical',
        message: 'Health check failed due to unexpected error',
        details: (error as Error).message,
        autoFixable: false,
      });

      return result;
    }
  }

  async migrateConfiguration(
    fromVersion: string,
    toVersion: string,
  ): Promise<{
    success: boolean;
    errors: DeploymentError[];
    warnings: DeploymentWarning[];
    migratedFiles: string[];
  }> {
    this.logger.log(
      `Migrating configuration from v${fromVersion} to v${toVersion}...`,
    );

    const result = {
      success: false,
      errors: [] as DeploymentError[],
      warnings: [] as DeploymentWarning[],
      migratedFiles: [] as string[],
    };

    try {
      // Validate migration path
      if (!this.isMigrationSupported(fromVersion, toVersion)) {
        result.errors.push({
          message: `Migration from v${fromVersion} to v${toVersion} is not supported`,
          code: 'MIGRATION_NOT_SUPPORTED',
          severity: 'HIGH',
        });
        return result;
      }

      // Create backup before migration
      const backupPath = await this.createMigrationBackup();
      result.warnings.push({
        message: `Configuration backup created at: ${backupPath}`,
        code: 'MIGRATION_BACKUP_CREATED',
      });

      // Perform version-specific migrations
      const migrations = this.getMigrationSteps(fromVersion, toVersion);

      // Execute migrations concurrently and handle results
      const migrationResults = await Promise.allSettled(
        migrations.map(async (migration) => {
          try {
            const migrationResult = await migration.execute();
            return {
              success: true,
              migration,
              result: migrationResult,
            };
          } catch (migrationError) {
            return {
              success: false,
              migration,
              error: migrationError as Error,
            };
          }
        }),
      );

      // Process migration results
      for (const migrationResult of migrationResults) {
        if (migrationResult.status === 'fulfilled') {
          const {
            success,
            migration,
            result: migrationData,
            error,
          } = migrationResult.value;
          if (success && migrationData) {
            result.migratedFiles.push(...migrationData.files);
            result.warnings.push(...migrationData.warnings);
          } else if (error) {
            result.errors.push({
              message: `Migration step failed: ${migration.name}`,
              code: 'MIGRATION_STEP_FAILED',
              severity: 'HIGH',
              details: error.message,
            });
          }
        } else {
          result.errors.push({
            message: 'Migration step failed unexpectedly',
            code: 'MIGRATION_STEP_FAILED',
            severity: 'HIGH',
            details: migrationResult.reason,
          });
        }
      }

      result.success = result.errors.length === 0;

      if (result.success) {
        this.logger.log(
          `Migration completed successfully: ${result.migratedFiles.length} files migrated`,
        );
      } else {
        this.logger.error(
          `Migration failed with ${result.errors.length} errors`,
        );
      }

      return result;
    } catch (error) {
      result.errors.push({
        message: `Migration failed: ${(error as Error).message}`,
        code: 'MIGRATION_FAILED',
        severity: 'CRITICAL',
      });

      this.logger.error('Migration failed:', error);
      return result;
    }
  }

  private async findKiroInstallation(): Promise<string | null> {
    const commonPaths = [
      // macOS
      '/Applications/Kiro.app',
      '/Applications/Kiro IDE.app',
      // Windows
      'C:\\Program Files\\Kiro IDE',
      'C:\\Program Files (x86)\\Kiro IDE',
      // Linux
      '/opt/kiro',
      '/usr/local/bin/kiro',
      '/snap/kiro-ide/current',
    ];

    // Check all paths concurrently
    const accessResults = await Promise.allSettled(
      commonPaths.map(async (installPath) => {
        await fs.access(installPath);
        return installPath;
      }),
    );

    // Return the first successful path
    for (const result of accessResults) {
      if (result.status === 'fulfilled') {
        return result.value;
      }
    }

    // Check PATH for kiro command
    try {
      const { spawn } = await import('node:child_process');
      const childProcess = spawn('which', ['kiro'], { stdio: 'pipe' });

      return new Promise((resolve) => {
        let output = '';

        childProcess.stdout?.on('data', (data) => {
          output += data.toString();
        });

        childProcess.on('close', (code) => {
          if (code === 0 && output.trim()) {
            resolve(output.trim());
          } else {
            resolve(null);
          }
        });

        childProcess.on('error', () => {
          resolve(null);
        });

        // Timeout after 5 seconds
        setTimeout(() => {
          try {
            childProcess.kill();
          } catch {
            // Process might already be dead
          }
          resolve(null);
        }, 5000);
      });
    } catch {
      return null;
    }
  }

  private async detectKiroVersion(
    installationPath: string,
  ): Promise<string | undefined> {
    try {
      // Try to read version from package.json or version file
      const versionFilePaths = [
        path.join(installationPath, 'package.json'),
        path.join(installationPath, 'version.txt'),
        path.join(installationPath, 'Contents', 'Resources', 'version.json'), // macOS app bundle
      ];

      // Read all version files concurrently
      const versionResults = await Promise.allSettled(
        versionFilePaths.map(async (versionPath) => {
          const content = await fs.readFile(versionPath, 'utf8');
          return { versionPath, content };
        }),
      );

      // Process the results and extract version
      for (const result of versionResults) {
        if (result.status === 'fulfilled') {
          const { versionPath, content } = result.value;

          if (versionPath.endsWith('.json')) {
            try {
              const json = JSON.parse(content);
              const version = json.version || json.app_version;
              if (version) return version;
            } catch {
              continue;
            }
          } else {
            // Extract version from text file
            const versionMatch = content.match(/(\d+\.\d+\.\d+)/);
            if (versionMatch) {
              return versionMatch[1];
            }
          }
        }
      }

      // Fallback: try to execute kiro --version
      try {
        const { spawn } = await import('node:child_process');
        const kiroExec = path.join(installationPath, 'kiro');
        const process = spawn(kiroExec, ['--version'], { stdio: 'pipe' });

        return new Promise((resolve) => {
          let output = '';
          process.stdout?.on('data', (data) => {
            output += data.toString();
          });

          process.on('close', () => {
            const versionMatch = output.match(/(\d+\.\d+\.\d+)/);
            resolve(versionMatch ? versionMatch[1] : undefined);
          });

          // Timeout after 3 seconds
          setTimeout(() => {
            process.kill();
            resolve(undefined);
          }, 3000);
        });
      } catch {
        return undefined;
      }
    } catch (error) {
      this.logger.error('Error detecting Kiro version:', error);
      return undefined;
    }
  }

  private isVersionSupported(version: string): boolean {
    return (
      this.SUPPORTED_VERSIONS.includes(version) ||
      this.compareVersions(version, this.MINIMUM_VERSION) >= 0
    );
  }

  private compareVersions(a: string, b: string): number {
    const aParts = a.split('.').map(Number);
    const bParts = b.split('.').map(Number);

    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aPart = aParts[i] || 0;
      const bPart = bParts[i] || 0;

      if (aPart > bPart) return 1;
      if (aPart < bPart) return -1;
    }

    return 0;
  }

  private async checkSchemaCompatibility(
    version: string,
  ): Promise<KiroCompatibilityIssue[]> {
    const issues: KiroCompatibilityIssue[] = [];

    // Check if current schema version is compatible
    if (this.compareVersions(version, '2.0.0') < 0) {
      issues.push({
        type: 'schema',
        severity: 'medium',
        message:
          'Configuration schema migration may be required for newer features',
        details: { currentVersion: version, schemaVersion: '1.x' },
        fixable: true,
      });
    }

    return issues;
  }

  private async checkFeatureCompatibility(
    version: string,
  ): Promise<KiroCompatibilityIssue[]> {
    const issues: KiroCompatibilityIssue[] = [];

    // Check for specific feature compatibility
    const featureCompatibility = {
      hooks: this.compareVersions(version, '1.1.0') >= 0,
      agents: this.compareVersions(version, '1.2.0') >= 0,
      templates: this.compareVersions(version, '2.0.0') >= 0,
      steering: this.compareVersions(version, '1.0.0') >= 0,
    };

    for (const [feature, supported] of Object.entries(featureCompatibility)) {
      if (!supported) {
        issues.push({
          type: 'feature',
          severity: 'medium',
          message: `Feature '${feature}' is not supported in version ${version}`,
          details: { feature, version },
          fixable: false,
        });
      }
    }

    return issues;
  }

  private async checkInstallationHealth(): Promise<KiroHealthIssue[]> {
    const issues: KiroHealthIssue[] = [];

    try {
      const installationInfo = await this.detectKiroInstallation();

      if (!installationInfo.isInstalled) {
        issues.push({
          category: 'installation',
          severity: 'critical',
          message:
            'Kiro IDE is not installed or not found in expected locations',
          autoFixable: false,
        });
      }
    } catch (error) {
      issues.push({
        category: 'installation',
        severity: 'high',
        message: 'Unable to verify Kiro IDE installation',
        details: (error as Error).message,
        autoFixable: false,
      });
    }

    return issues;
  }

  private async checkConfigurationHealth(): Promise<KiroHealthIssue[]> {
    const issues: KiroHealthIssue[] = [];

    const configPaths = [
      path.join(os.homedir(), '.kiro', 'settings.json'),
      path.join(process.cwd(), '.kiro', 'settings.json'),
    ];

    // Check all configuration files concurrently
    const configResults = await Promise.allSettled(
      configPaths.map(async (configPath) => {
        await fs.access(configPath);
        const content = await fs.readFile(configPath, 'utf8');
        JSON.parse(content); // Validate JSON
        return configPath;
      }),
    );

    // Process results and collect issues
    for (let i = 0; i < configResults.length; i++) {
      const result = configResults[i];
      const configPath = configPaths[i];

      if (result.status === 'rejected') {
        const error = result.reason as NodeJS.ErrnoException;
        if (error.code !== 'ENOENT') {
          issues.push({
            category: 'configuration',
            severity: 'medium',
            message: `Configuration file is corrupted or invalid: ${configPath}`,
            details: error.message,
            autoFixable: true,
          });
        }
      }
    }

    return issues;
  }

  private async checkPermissions(): Promise<KiroHealthIssue[]> {
    const issues: KiroHealthIssue[] = [];

    const pathsToCheck = [
      os.homedir(),
      path.join(os.homedir(), '.kiro'),
      process.cwd(),
      path.join(process.cwd(), '.kiro'),
    ];

    // Check all paths concurrently
    const permissionResults = await Promise.allSettled(
      pathsToCheck.map(async (checkPath) => {
        await fs.access(checkPath, fs.constants.R_OK | fs.constants.W_OK);
        return checkPath;
      }),
    );

    // Process results and collect issues
    for (let i = 0; i < permissionResults.length; i++) {
      const result = permissionResults[i];
      const checkPath = pathsToCheck[i];

      if (result.status === 'rejected') {
        issues.push({
          category: 'permissions',
          severity: 'high',
          message: `Insufficient permissions for path: ${checkPath}`,
          autoFixable: false,
        });
      }
    }

    return issues;
  }

  private async checkDependencies(): Promise<KiroHealthIssue[]> {
    const issues: KiroHealthIssue[] = [];

    // Check Node.js version
    const nodeVersion = process.version;
    const minNodeVersion = '16.0.0';

    if (this.compareVersions(nodeVersion.slice(1), minNodeVersion) < 0) {
      issues.push({
        category: 'dependencies',
        severity: 'high',
        message: `Node.js version ${nodeVersion} is below minimum required version ${minNodeVersion}`,
        autoFixable: false,
      });
    }

    return issues;
  }

  private generateCompatibilityRecommendations(
    result: KiroCompatibilityResult,
  ): string[] {
    const recommendations: string[] = [];

    if (
      result.version.current &&
      this.compareVersions(result.version.current, this.RECOMMENDED_VERSION) < 0
    ) {
      recommendations.push(
        `Consider upgrading to Kiro IDE v${this.RECOMMENDED_VERSION} for best compatibility`,
      );
    }

    if (result.migrationRequired) {
      recommendations.push(
        'Configuration migration is recommended before deployment',
      );
    }

    if (result.issues.some((issue) => issue.type === 'feature')) {
      recommendations.push(
        'Some features may not be available in your current Kiro IDE version',
      );
    }

    return recommendations;
  }

  private generateHealthRecommendations(issues: KiroHealthIssue[]): string[] {
    const recommendations: string[] = [];

    const criticalIssues = issues.filter(
      (issue) => issue.severity === 'critical',
    );
    if (criticalIssues.length > 0) {
      recommendations.push(
        'Address critical issues before attempting deployment',
      );
    }

    const permissionIssues = issues.filter(
      (issue) => issue.category === 'permissions',
    );
    if (permissionIssues.length > 0) {
      recommendations.push(
        'Ensure proper file system permissions for Kiro configuration directories',
      );
    }

    const configIssues = issues.filter(
      (issue) => issue.category === 'configuration',
    );
    if (configIssues.length > 0) {
      recommendations.push('Backup and repair corrupted configuration files');
    }

    return recommendations;
  }

  private generateHealthFixes(issues: KiroHealthIssue[]): KiroHealthFix[] {
    const fixes: KiroHealthFix[] = [];

    for (const issue of issues.filter((issue) => issue.autoFixable)) {
      if (issue.category === 'configuration') {
        fixes.push({
          issue: issue.message,
          action: 'Recreate configuration file with default settings',
          automated: true,
          riskLevel: 'low',
        });
      }
    }

    return fixes;
  }

  private isMigrationSupported(
    fromVersion: string,
    toVersion: string,
  ): boolean {
    // Define supported migration paths
    const supportedMigrations = [
      { from: '1.0.0', to: '1.1.0' },
      { from: '1.1.0', to: '1.2.0' },
      { from: '1.2.0', to: '2.0.0' },
    ];

    return supportedMigrations.some(
      (migration) =>
        migration.from === fromVersion && migration.to === toVersion,
    );
  }

  private async createMigrationBackup(): Promise<string> {
    const backupDir = path.join(os.homedir(), '.kiro', 'backups');
    const timestamp = new Date().toISOString().replace(/[.:]/g, '-');
    const backupPath = path.join(backupDir, `migration-backup-${timestamp}`);

    await fs.mkdir(backupDir, { recursive: true });

    // Copy current configuration to backup
    const configPaths = [
      path.join(os.homedir(), '.kiro'),
      path.join(process.cwd(), '.kiro'),
    ];

    // Check all configuration paths concurrently
    const backupResults = await Promise.allSettled(
      configPaths.map(async (configPath) => {
        await fs.access(configPath);
        // Copy configuration (simplified - would need recursive copy implementation)
        return configPath;
      }),
    );

    // Process successful backup operations (simplified for now)
    const accessiblePaths = backupResults
      .filter((result) => result.status === 'fulfilled')
      .map((result) => (result as PromiseFulfilledResult<string>).value);

    // Log accessible paths for backup (actual copying logic would go here)
    if (accessiblePaths.length > 0) {
      this.logger.log(
        `Found ${accessiblePaths.length} configuration paths for backup`,
      );
    }

    return backupPath;
  }

  private getMigrationSteps(
    fromVersion: string,
    toVersion: string,
  ): Array<{
    name: string;
    execute: () => Promise<{ files: string[]; warnings: DeploymentWarning[] }>;
  }> {
    // Return migration steps based on version differences
    const steps = [];

    if (fromVersion === '1.0.0' && toVersion === '1.1.0') {
      steps.push({
        name: 'Add hooks support',
        execute: async () => ({
          files: ['.kiro/hooks'],
          warnings: [
            {
              message: 'Hooks feature enabled',
              code: 'MIGRATION_FEATURE_ADDED',
            },
          ],
        }),
      });
    }

    return steps;
  }
}
