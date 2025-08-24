import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { Injectable, Logger } from '@nestjs/common';

import { DeploymentError, DeploymentWarning } from '../interfaces/deployment-result.interface';

export interface CursorInstallationInfo {
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
    extensions: boolean;
    workspace: boolean;
  };
}

export interface CursorCompatibilityResult {
  isCompatible: boolean;
  version: {
    current?: string;
    required: string;
    supported: string[];
  };
  issues: CursorCompatibilityIssue[];
  recommendations: string[];
  migrationRequired: boolean;
}

export interface CursorCompatibilityIssue {
  type: 'version' | 'extensions' | 'workspace' | 'configuration';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details?: unknown;
  fixable: boolean;
}

export interface CursorHealthCheckResult {
  healthy: boolean;
  issues: CursorHealthIssue[];
  recommendations: string[];
  fixes: CursorHealthFix[];
}

export interface CursorHealthIssue {
  category: 'installation' | 'configuration' | 'permissions' | 'extensions';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details?: string;
  autoFixable: boolean;
}

export interface CursorHealthFix {
  issue: string;
  action: string;
  automated: boolean;
  riskLevel: 'low' | 'medium' | 'high';
}

@Injectable()
export class CursorInstallationDetectorService {
  private readonly logger = new Logger(CursorInstallationDetectorService.name);

  private readonly SUPPORTED_VERSIONS = ['0.38.0', '0.39.0', '0.40.0', '0.41.0'];
  private readonly MINIMUM_VERSION = '0.38.0';
  private readonly RECOMMENDED_VERSION = '0.41.0';

  async detectCursorInstallation(): Promise<CursorInstallationInfo> {
    this.logger.log('Detecting Cursor IDE installation...');

    const installationInfo: CursorInstallationInfo = {
      isInstalled: false,
      isCompatible: false,
      compatibility: {
        version: false,
        extensions: false,
        workspace: false,
      },
    };

    try {
      // Check for Cursor installation in common locations
      const installationPath = await this.findCursorInstallation();
      
      if (!installationPath) {
        this.logger.warn('Cursor IDE installation not found');
        return installationInfo;
      }

      installationInfo.isInstalled = true;
      installationInfo.installationPath = installationPath;

      // Detect version
      const version = await this.detectCursorVersion(installationPath);
      if (version) {
        installationInfo.version = version;
      }

      // Set configuration paths
      installationInfo.configurationPath = {
        global: path.join(os.homedir(), '.cursor'),
        project: path.join(process.cwd(), '.cursor'),
      };

      // Check compatibility
      const compatibility = await this.checkCompatibility(version);
      installationInfo.isCompatible = compatibility.isCompatible;
      installationInfo.compatibility = {
        version: compatibility.version.current ? this.isVersionSupported(compatibility.version.current) : false,
        extensions: !compatibility.issues.some(issue => issue.type === 'extensions'),
        workspace: !compatibility.issues.some(issue => issue.type === 'workspace'),
      };

      this.logger.log(`Cursor IDE detected: v${version} at ${installationPath}`);
      return installationInfo;

    } catch (error) {
      this.logger.error('Error detecting Cursor installation:', error);
      return installationInfo;
    }
  }

  async checkCompatibility(currentVersion?: string): Promise<CursorCompatibilityResult> {
    const result: CursorCompatibilityResult = {
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
        message: 'Unable to determine Cursor IDE version',
        fixable: false,
      });
      return result;
    }

    if (!this.isVersionSupported(currentVersion)) {
      const severity = this.compareVersions(currentVersion, this.MINIMUM_VERSION) < 0 ? 'critical' : 'medium';
      
      result.issues.push({
        type: 'version',
        severity,
        message: `Cursor IDE version ${currentVersion} is not officially supported`,
        details: {
          current: currentVersion,
          minimum: this.MINIMUM_VERSION,
          recommended: this.RECOMMENDED_VERSION,
        },
        fixable: true,
      });
    }

    // Check for extension compatibility
    const extensionIssues = await this.checkExtensionCompatibility(currentVersion);
    result.issues.push(...extensionIssues);

    // Check workspace compatibility
    const workspaceIssues = await this.checkWorkspaceCompatibility(currentVersion);
    result.issues.push(...workspaceIssues);

    // Determine if migration is required
    result.migrationRequired = this.compareVersions(currentVersion, this.MINIMUM_VERSION) < 0 ||
      result.issues.some(issue => issue.type === 'configuration' && issue.severity === 'high');

    // Generate recommendations
    result.recommendations = this.generateCompatibilityRecommendations(result);

    // Determine overall compatibility
    result.isCompatible = result.issues.length === 0 || 
      !result.issues.some(issue => issue.severity === 'critical');

    return result;
  }

  async performHealthCheck(): Promise<CursorHealthCheckResult> {
    this.logger.log('Performing Cursor IDE health check...');

    const result: CursorHealthCheckResult = {
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

      // Check extensions
      const extensionIssues = await this.checkExtensionHealth();
      result.issues.push(...extensionIssues);

      // Generate fixes
      result.fixes = this.generateHealthFixes(result.issues);

      // Generate recommendations
      result.recommendations = this.generateHealthRecommendations(result.issues);

      // Determine overall health
      result.healthy = result.issues.length === 0 || 
        !result.issues.some(issue => issue.severity === 'critical' || issue.severity === 'high');

      this.logger.log(`Health check completed: ${result.healthy ? 'healthy' : 'issues found'}`);
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

  private async findCursorInstallation(): Promise<string | null> {
    const commonPaths = [
      // macOS
      '/Applications/Cursor.app',
      // Windows
      'C:\\Program Files\\Cursor',
      'C:\\Users\\%USERNAME%\\AppData\\Local\\Programs\\cursor',
      // Linux
      '/opt/cursor',
      '/usr/local/bin/cursor',
      '/snap/cursor/current',
      '~/.local/share/applications/cursor',
    ];

    for (const installPath of commonPaths) {
      try {
        const resolvedPath = installPath.replace('%USERNAME%', os.userInfo().username)
          .replace('~', os.homedir());
        // eslint-disable-next-line no-await-in-loop
        await fs.access(resolvedPath);
        return resolvedPath;
      } catch {
        continue;
      }
    }

    // Check PATH for cursor command
    try {
      const { spawn } = await import('node:child_process');
      const command = os.platform() === 'win32' ? 'where' : 'which';
      const childProcess = spawn(command, ['cursor'], { stdio: 'pipe' });
      
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

  private async detectCursorVersion(installationPath: string): Promise<string | undefined> {
    try {
      // Try to read version from package.json or version file
      const versionFilePaths = [
        path.join(installationPath, 'resources', 'app', 'package.json'),
        path.join(installationPath, 'package.json'),
        path.join(installationPath, 'version.txt'),
        path.join(installationPath, 'Contents', 'Resources', 'app', 'package.json'), // macOS app bundle
      ];

      for (const versionPath of versionFilePaths) {
        try {
          // eslint-disable-next-line no-await-in-loop
          const content = await fs.readFile(versionPath, 'utf8');
          
          if (versionPath.endsWith('.json')) {
            const json = JSON.parse(content);
            return json.version || json.app_version;
          } else {
            // Extract version from text file
            const versionMatch = content.match(/(\d+\.\d+\.\d+)/);
            if (versionMatch) {
              return versionMatch[1];
            }
          }
        } catch {
          continue;
        }
      }

      // Fallback: try to execute cursor --version
      try {
        const { spawn } = await import('node:child_process');
        const cursorExec = os.platform() === 'win32' ? 
          path.join(installationPath, 'cursor.exe') :
          path.join(installationPath, 'cursor');
        
        const process = spawn(cursorExec, ['--version'], { stdio: 'pipe' });
        
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
          }, 3000 as unknown as NodeJS.Timeout);
        });
      } catch {
        return undefined;
      }

    } catch (error) {
      this.logger.error('Error detecting Cursor version:', error);
      return undefined;
    }
  }

  private isVersionSupported(version: string): boolean {
    return this.SUPPORTED_VERSIONS.includes(version) ||
      this.compareVersions(version, this.MINIMUM_VERSION) >= 0;
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

  private async checkExtensionCompatibility(version: string): Promise<CursorCompatibilityIssue[]> {
    const issues: CursorCompatibilityIssue[] = [];

    // Check if current version supports required extensions API
    if (this.compareVersions(version, '0.39.0') < 0) {
      issues.push({
        type: 'extensions',
        severity: 'medium',
        message: 'Some extension features may not be fully supported',
        details: { currentVersion: version, requiredVersion: '0.39.0' },
        fixable: true,
      });
    }

    return issues;
  }

  private async checkWorkspaceCompatibility(version: string): Promise<CursorCompatibilityIssue[]> {
    const issues: CursorCompatibilityIssue[] = [];

    // Check workspace trust features
    if (this.compareVersions(version, '0.38.0') < 0) {
      issues.push({
        type: 'workspace',
        severity: 'low',
        message: 'Workspace trust features may be limited in this version',
        details: { currentVersion: version, featureVersion: '0.38.0' },
        fixable: false,
      });
    }

    return issues;
  }

  private async checkInstallationHealth(): Promise<CursorHealthIssue[]> {
    const issues: CursorHealthIssue[] = [];

    try {
      const installationInfo = await this.detectCursorInstallation();
      
      if (!installationInfo.isInstalled) {
        issues.push({
          category: 'installation',
          severity: 'critical',
          message: 'Cursor IDE is not installed or not found in expected locations',
          autoFixable: false,
        });
      }

    } catch (error) {
      issues.push({
        category: 'installation',
        severity: 'high',
        message: 'Unable to verify Cursor IDE installation',
        details: (error as Error).message,
        autoFixable: false,
      });
    }

    return issues;
  }

  private async checkConfigurationHealth(): Promise<CursorHealthIssue[]> {
    const issues: CursorHealthIssue[] = [];

    const configPaths = [
      path.join(os.homedir(), '.cursor', 'settings.json'),
      path.join(process.cwd(), '.cursor', 'settings.json'),
    ];

    for (const configPath of configPaths) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await fs.access(configPath);
        
        // Try to parse configuration file
        // eslint-disable-next-line no-await-in-loop
        const content = await fs.readFile(configPath, 'utf8');
        JSON.parse(content);
        
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          issues.push({
            category: 'configuration',
            severity: 'medium',
            message: `Configuration file is corrupted or invalid: ${configPath}`,
            details: (error as Error).message,
            autoFixable: true,
          });
        }
      }
    }

    return issues;
  }

  private async checkPermissions(): Promise<CursorHealthIssue[]> {
    const issues: CursorHealthIssue[] = [];

    const pathsToCheck = [
      os.homedir(),
      path.join(os.homedir(), '.cursor'),
      process.cwd(),
      path.join(process.cwd(), '.cursor'),
    ];

    for (const checkPath of pathsToCheck) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await fs.access(checkPath, fs.constants.R_OK | fs.constants.W_OK);
      } catch {
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

  private async checkExtensionHealth(): Promise<CursorHealthIssue[]> {
    const issues: CursorHealthIssue[] = [];

    // Check if extensions directory exists
    const extensionsPath = path.join(os.homedir(), '.cursor', 'extensions');
    
    try {
      await fs.access(extensionsPath);
    } catch {
      issues.push({
        category: 'extensions',
        severity: 'low',
        message: 'Extensions directory not found - extensions may not be properly configured',
        autoFixable: true,
      });
    }

    return issues;
  }

  private generateCompatibilityRecommendations(result: CursorCompatibilityResult): string[] {
    const recommendations: string[] = [];

    if (result.version.current && this.compareVersions(result.version.current, this.RECOMMENDED_VERSION) < 0) {
      recommendations.push(`Consider upgrading to Cursor IDE v${this.RECOMMENDED_VERSION} for best compatibility`);
    }

    if (result.migrationRequired) {
      recommendations.push('Configuration migration is recommended before deployment');
    }

    if (result.issues.some(issue => issue.type === 'extensions')) {
      recommendations.push('Some extension features may not be available in your current Cursor IDE version');
    }

    return recommendations;
  }

  private generateHealthRecommendations(issues: CursorHealthIssue[]): string[] {
    const recommendations: string[] = [];

    const criticalIssues = issues.filter(issue => issue.severity === 'critical');
    if (criticalIssues.length > 0) {
      recommendations.push('Address critical issues before attempting deployment');
    }

    const permissionIssues = issues.filter(issue => issue.category === 'permissions');
    if (permissionIssues.length > 0) {
      recommendations.push('Ensure proper file system permissions for Cursor configuration directories');
    }

    const configIssues = issues.filter(issue => issue.category === 'configuration');
    if (configIssues.length > 0) {
      recommendations.push('Backup and repair corrupted configuration files');
    }

    return recommendations;
  }

  private generateHealthFixes(issues: CursorHealthIssue[]): CursorHealthFix[] {
    const fixes: CursorHealthFix[] = [];

    for (const issue of issues.filter(issue => issue.autoFixable)) {
      if (issue.category === 'configuration') {
        fixes.push({
          issue: issue.message,
          action: 'Recreate configuration file with default settings',
          automated: true,
          riskLevel: 'low',
        });
      }
      
      if (issue.category === 'extensions') {
        fixes.push({
          issue: issue.message,
          action: 'Create extensions directory structure',
          automated: true,
          riskLevel: 'low',
        });
      }
    }

    return fixes;
  }
}