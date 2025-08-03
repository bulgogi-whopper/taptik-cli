import { homedir, platform } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { access, constants } from 'fs-extra';

/**
 * Cross-platform path resolution utility for handling Windows, macOS, and Linux paths
 */
export class PathResolverUtil {
  /**
   * Get the current platform type
   */
  static getPlatform(): 'windows' | 'macos' | 'linux' | 'unknown' {
    const currentPlatform = platform();
    switch (currentPlatform) {
      case 'win32':
        return 'windows';
      case 'darwin':
        return 'macos';
      case 'linux':
        return 'linux';
      default:
        return 'unknown';
    }
  }

  /**
   * Get the user's home directory with platform-specific handling
   */
  static getHomeDirectory(): string {
    try {
      const home = homedir();
      if (!home) {
        throw new Error('Unable to determine home directory');
      }
      return home;
    } catch (error) {
      const platform = this.getPlatform();
      throw new Error(
        `Failed to detect home directory on ${platform}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get platform-specific Kiro configuration directory path
   */
  static getKiroConfigDirectory(): string {
    const home = this.getHomeDirectory();
    const platform = this.getPlatform();

    switch (platform) {
      case 'windows':
        // Windows: %USERPROFILE%\.kiro
        return join(home, '.kiro');
      case 'macos':
        // macOS: ~/.kiro
        return join(home, '.kiro');
      case 'linux':
        // Linux: ~/.kiro
        return join(home, '.kiro');
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  /**
   * Get local Kiro configuration directory path (project-specific)
   */
  static getLocalKiroConfigDirectory(projectPath?: string): string {
    const basePath = projectPath ? resolve(projectPath) : process.cwd();
    return join(basePath, '.kiro');
  }

  /**
   * Get platform-specific Kiro settings file paths
   */
  static getKiroSettingsPaths(): {
    global: {
      userConfig: string;
      globalPrompts: string;
      preferences: string;
    };
    local: {
      contextJson: string;
      userPreferences: string;
      projectSpec: string;
      promptsDir: string;
      hooksDir: string;
    };
  } {
    const globalConfigDir = this.getKiroConfigDirectory();
    const localConfigDir = this.getLocalKiroConfigDirectory();

    return {
      global: {
        userConfig: join(globalConfigDir, 'user-config.json'),
        globalPrompts: join(globalConfigDir, 'prompts'),
        preferences: join(globalConfigDir, 'preferences.json'),
      },
      local: {
        contextJson: join(localConfigDir, 'context.json'),
        userPreferences: join(localConfigDir, 'user-preferences.json'),
        projectSpec: join(localConfigDir, 'project-spec.json'),
        promptsDir: join(localConfigDir, 'prompts'),
        hooksDir: join(localConfigDir, 'hooks'),
      },
    };
  }

  /**
   * Check if a path exists and is accessible
   */
  static async pathExists(path: string): Promise<boolean> {
    try {
      await access(path, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if a path is readable
   */
  static async isReadable(path: string): Promise<boolean> {
    try {
      await access(path, constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if a path is writable
   */
  static async isWritable(path: string): Promise<boolean> {
    try {
      await access(path, constants.W_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Normalize path separators for the current platform
   */
  static normalizePath(path: string): string {
    return path.split(/[/\\]/).join(sep);
  }

  /**
   * Get platform-specific error message for path access issues
   */
  static getPathErrorMessage(path: string, error: Error): string {
    const platform = this.getPlatform();
    const normalizedPath = this.normalizePath(path);

    if (error.message.includes('ENOENT')) {
      return `Path not found: ${normalizedPath}. ${this.getPlatformSpecificNotFoundMessage(platform)}`;
    }

    if (error.message.includes('EACCES') || error.message.includes('EPERM')) {
      return `Permission denied accessing: ${normalizedPath}. ${this.getPlatformSpecificPermissionMessage(platform)}`;
    }

    return `Error accessing path ${normalizedPath} on ${platform}: ${error.message}`;
  }

  /**
   * Get platform-specific message for file not found errors
   */
  private static getPlatformSpecificNotFoundMessage(platform: string): string {
    switch (platform) {
      case 'windows':
        return 'Ensure Kiro is installed and the path exists. Check if the directory was created during Kiro setup.';
      case 'macos':
        return 'Ensure Kiro is installed in your user directory. You may need to run Kiro at least once to create configuration files.';
      case 'linux':
        return 'Ensure Kiro is installed and has created its configuration directory. Check if ~/.kiro exists.';
      default:
        return 'Ensure Kiro is properly installed and configured on your system.';
    }
  }

  /**
   * Get platform-specific message for permission errors
   */
  private static getPlatformSpecificPermissionMessage(platform: string): string {
    switch (platform) {
      case 'windows':
        return 'Try running as Administrator or check file/folder permissions in Windows Explorer.';
      case 'macos':
        return 'Try using sudo or check file permissions with "ls -la". You may need to grant disk access permissions.';
      case 'linux':
        return 'Try using sudo or check file permissions with "ls -la". Ensure your user has access to the directory.';
      default:
        return 'Check file permissions and ensure you have appropriate access rights.';
    }
  }

  /**
   * Validate that Kiro configuration directory exists and is accessible
   */
  static async validateKiroInstallation(): Promise<{
    isValid: boolean;
    globalConfigExists: boolean;
    localConfigExists: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];
    let globalConfigExists = false;
    let localConfigExists = false;

    try {
      // Check global Kiro configuration
      const globalConfigDir = this.getKiroConfigDirectory();
      globalConfigExists = await this.pathExists(globalConfigDir);

      if (!globalConfigExists) {
        errors.push(`Global Kiro configuration directory not found: ${globalConfigDir}`);
      } else if (!(await this.isReadable(globalConfigDir))) {
        errors.push(`Cannot read global Kiro configuration directory: ${globalConfigDir}`);
      }
    } catch (error) {
      errors.push(`Error checking global Kiro configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    try {
      // Check local Kiro configuration
      const localConfigDir = this.getLocalKiroConfigDirectory();
      localConfigExists = await this.pathExists(localConfigDir);

      if (!localConfigExists) {
        errors.push(`Local Kiro configuration directory not found: ${localConfigDir}`);
      } else if (!(await this.isReadable(localConfigDir))) {
        errors.push(`Cannot read local Kiro configuration directory: ${localConfigDir}`);
      }
    } catch (error) {
      errors.push(`Error checking local Kiro configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Consider it valid if at least one config exists and is accessible
    // Only count errors that prevent access to existing configs
    const criticalErrors = errors.filter(error => 
      error.includes('Cannot read') || error.includes('Error checking')
    );

    return {
      isValid: criticalErrors.length === 0 && (globalConfigExists || localConfigExists),
      globalConfigExists,
      localConfigExists,
      errors,
    };
  }
}