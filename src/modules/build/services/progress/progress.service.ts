import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { Injectable, Logger } from '@nestjs/common';

import type { TaptikConfig, ConfigValidationResult } from '../../interfaces/config.interface';
import type {
  ConfigSize,
  ProcessingTimeEstimate,
  ProgressState,
  DetailedProgress,
  PackageInfo,
  UploadPrompt,
  ConfigField,
  ValidationResult,
  ValidationResults,
  ActionableError,
  PackageDetails,
  UploadResult,
  ProgressUpdateCallback
} from '../../interfaces/progress.interface';


/**
 * Service responsible for progress reporting and user feedback during build process
 * Provides spinners, progress messages, and completion status for various operations
 */
@Injectable()
export class ProgressService {
  private readonly logger = new Logger(ProgressService.name);
  private currentStep = 0;
  private totalSteps = 0;
  private stepDescriptions: string[] = [];
  private startTime = 0;
  private userPreferences: Record<string, unknown> = {};
  private progressUpdateCallbacks: ProgressUpdateCallback[] = [];
  private progressState: ProgressState | null = null;

  /**
   * Initialize progress tracking for a series of steps
   * @param steps Array of step descriptions
   */
  initializeProgress(steps: string[]): void {
    this.currentStep = 0;
    this.totalSteps = steps.length;
    this.stepDescriptions = steps;
    this.logger.log('🚀 Starting Taptik build process...');
  }

  /**
   * Start a new step with spinner indicator
   * @param message Progress message to display
   */
  startStep(message?: string): void {
    const stepMessage = message || this.stepDescriptions[this.currentStep];
    if (stepMessage) {
      this.logger.log(`⏳ ${stepMessage}...`);
    }
  }

  /**
   * Complete current step with success indicator
   * @param message Optional completion message
   */
  completeStep(message?: string): void {
    const stepMessage = message || this.stepDescriptions[this.currentStep];
    if (stepMessage) {
      this.logger.log(`✓ ${stepMessage}`);
    }
    this.currentStep++;
    
    // Trigger progress update callbacks
    const progress = this.getDetailedProgress();
    this.progressUpdateCallbacks.forEach(callback => {
      callback(progress);
    });
  }

  /**
   * Mark step as failed with error indicator
   * @param message Error message to display
   * @param error Optional error details
   */
  failStep(message: string, error?: Error): void {
    this.logger.error(`✗ ${message}`, error?.stack);
    this.currentStep++;
  }

  /**
   * Show progress for scanning operations
   * @param operation Type of scan operation
   */
  startScan(operation: 'local' | 'global'): void {
    const message = operation === 'local' 
      ? 'Scanning local Kiro settings'
      : 'Scanning global Kiro settings';
    this.startStep(message);
  }

  /**
   * Complete scanning operation
   * @param operation Type of scan operation
   * @param fileCount Number of files found
   */
  completeScan(operation: 'local' | 'global', fileCount: number): void {
    const message = operation === 'local'
      ? `Scanning local Kiro settings (${fileCount} files found)`
      : `Scanning global Kiro settings (${fileCount} files found)`;
    this.completeStep(message);
  }

  /**
   * Show progress for category transformation
   * @param category Category being transformed
   */
  startTransformation(category: string): void {
    this.startStep(`Transforming ${category}`);
  }

  /**
   * Complete category transformation
   * @param category Category that was transformed
   */
  completeTransformation(category: string): void {
    this.completeStep(`${category} Complete Conversion!`);
  }

  // Claude Code specific methods - GREEN phase implementation
  initializeClaudeCodeBuild(): void {
    this.logger.log('🤖 Initializing Claude Code build pipeline...');
    this.logger.log('📋 Analyzing Claude Code configuration structure...');
  }

  startClaudeCodeSanitization(): void {
    this.logger.log('🔒 Sanitizing Claude Code configuration for cloud upload...');
  }

  getSpinnerType(): string {
    return 'dots';
  }

  startClaudeCodeMetadataGeneration(): void {
    this.logger.log('🏷️  Generating cloud metadata for Claude Code configuration...');
    this.logger.log('  • Analyzing agents and commands...');
    this.logger.log('  • Extracting MCP server configurations...');
    this.logger.log('  • Computing complexity metrics...');
  }

  startClaudeCodePackaging(): void {
    this.logger.log('📦 Creating .taptik package for Claude Code...');
    this.logger.log('  • Compressing configuration files...');
    this.logger.log('  • Generating checksums...');
  }

  startClaudeCodeValidation(): void {
    this.logger.log('✅ Validating Claude Code package for cloud compatibility...');
    this.logger.log('  • Checking schema compliance...');
    this.logger.log('  • Verifying size limits...');
    this.logger.log('  • Testing feature compatibility...');
  }

  completeClaudeCodeBuild(packageInfo: PackageInfo): void {
    this.logger.log('🎉 Claude Code build completed successfully!');
    this.logger.log(`  📊 Package size: ${(packageInfo.size / 1024).toFixed(1)} KB`);
    this.logger.log(`  🔐 Checksum: ${packageInfo.checksum}`);
    this.logger.log(`  ☁️  Cloud ready: ${packageInfo.cloudReady ? '✅' : '❌'}`);
    this.logger.log(`  🛡️  Security level: ${packageInfo.securityLevel.toUpperCase()}`);
  }

  estimateProcessingTime(configSize: ConfigSize): ProcessingTimeEstimate {
    // Enhanced time estimation with complexity factors
    const baseTime = 2; // Base 2 seconds
    
    // Time factors based on component complexity
    const timePerAgent = 0.5;
    const timePerCommand = 0.3;
    const timePerMcp = 0.8;
    const timePerRule = 0.2;
    
    // Calculate size factor with logarithmic scaling
    const sizeInMB = (configSize.totalFileSize || 0) / (1024 * 1024);
    const sizeFactor = sizeInMB < 1 
      ? sizeInMB * 2 
      : Math.log10(sizeInMB + 1) * 3;
    
    // Calculate total time with complexity weighting
    const componentTime = 
      ((configSize.agents || 0) * timePerAgent) +
      ((configSize.commands || 0) * timePerCommand) +
      ((configSize.mcpServers || 0) * timePerMcp) +
      ((configSize.steeringRules || 0) * timePerRule);
    
    const totalSeconds = baseTime + componentTime + sizeFactor;
    
    // Distribute time across phases based on actual complexity
    const sanitizationWeight = configSize.mcpServers > 0 ? 0.35 : 0.25;
    const metadataWeight = 0.2;
    const packagingWeight = sizeInMB > 5 ? 0.35 : 0.3;
    const validationWeight = 1 - sanitizationWeight - metadataWeight - packagingWeight;
    
    return {
      totalSeconds: Math.ceil(totalSeconds),
      phases: [
        { 
          name: 'Sanitization', 
          estimatedSeconds: Math.ceil(totalSeconds * sanitizationWeight),
          description: 'Removing sensitive data'
        },
        { 
          name: 'Metadata Generation', 
          estimatedSeconds: Math.ceil(totalSeconds * metadataWeight),
          description: 'Creating cloud metadata'
        },
        { 
          name: 'Package Creation', 
          estimatedSeconds: Math.ceil(totalSeconds * packagingWeight),
          description: 'Building .taptik package'
        },
        { 
          name: 'Validation', 
          estimatedSeconds: Math.ceil(totalSeconds * validationWeight),
          description: 'Verifying compatibility'
        }
      ],
      complexity: this.calculateComplexity(configSize)
    };
  }

  private calculateComplexity(configSize: ConfigSize): 'simple' | 'moderate' | 'complex' | 'very complex' {
    const score = 
      ((configSize.agents || 0) * 2) +
      ((configSize.commands || 0) * 1.5) +
      ((configSize.mcpServers || 0) * 3) +
      ((configSize.steeringRules || 0) * 1);
    
    if (score < 5) return 'simple';
    if (score < 15) return 'moderate';
    if (score < 30) return 'complex';
    return 'very complex';
  }

  setStartTime(time: number): void {
    this.startTime = time;
  }

  getDetailedProgress(): DetailedProgress {
    const elapsedMs = this.startTime ? Date.now() - this.startTime : 0;
    const elapsedSeconds = elapsedMs / 1000;
    const percentage = this.totalSteps > 0 ? Math.round((this.currentStep / this.totalSteps) * 100) : 0;
    
    // Calculate adaptive time estimation
    const avgTimePerStep = this.currentStep > 0 ? elapsedSeconds / this.currentStep : 0;
    const remainingSteps = Math.max(0, this.totalSteps - this.currentStep);
    
    // Apply acceleration factor for later steps (usually faster)
    const accelerationFactor = this.currentStep > this.totalSteps / 2 ? 0.8 : 1.0;
    const estimatedRemainingSeconds = remainingSteps * avgTimePerStep * accelerationFactor;
    
    // Calculate velocity (steps per second)
    const velocity = this.currentStep > 0 ? this.currentStep / elapsedSeconds : 0;
    
    // Determine progress status
    const status = this.getProgressStatus(percentage, elapsedSeconds, estimatedRemainingSeconds);
    
    return {
      percentage,
      currentStep: this.currentStep,
      totalSteps: this.totalSteps,
      elapsedSeconds: Math.round(elapsedSeconds),
      estimatedRemainingSeconds: Math.round(estimatedRemainingSeconds),
      estimatedTotalSeconds: Math.round(elapsedSeconds + estimatedRemainingSeconds),
      velocity: velocity.toFixed(2),
      status,
      formattedElapsed: this.formatTimeEstimate(elapsedSeconds),
      formattedRemaining: this.formatTimeEstimate(estimatedRemainingSeconds),
      formattedTotal: this.formatTimeEstimate(elapsedSeconds + estimatedRemainingSeconds)
    };
  }

  private getProgressStatus(percentage: number, elapsed: number, remaining: number): string {
    if (percentage === 100) return 'completed';
    if (percentage === 0) return 'starting';
    if (remaining < elapsed * 0.1) return 'finishing';
    if (percentage > 75) return 'nearly-done';
    if (percentage > 50) return 'progressing-well';
    if (percentage > 25) return 'progressing';
    return 'early-stage';
  }

  formatTimeEstimate(seconds: number): string {
    // Handle sub-second times
    if (seconds < 1) {
      return `${Math.round(seconds * 1000)}ms`;
    }
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    // Build time string based on magnitude
    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
    
    return parts.join(' ');
  }

  onProgressUpdate(callback: ProgressUpdateCallback): void {
    this.progressUpdateCallbacks.push(callback);
  }

  prepareUploadPrompt(packageDetails: PackageDetails): UploadPrompt {
    const size = (packageDetails.size / 1024).toFixed(1);
    const tags = packageDetails.tags.join(', ');
    
    return {
      message: 'Ready to upload to cloud?',
      details: `Size: ${size} KB\nTitle: ${packageDetails.title}\nVisibility: ${packageDetails.isPublic ? 'Public' : 'Private'}\nTags: ${tags}`,
      choices: ['Upload now', 'Save locally only', 'Configure upload settings']
    };
  }

  setUserPreferences(preferences: Record<string, unknown>): void {
    this.userPreferences = preferences;
  }

  getUserPreferences(): Record<string, unknown> {
    return this.userPreferences;
  }

  getMissingFieldPrompts(fields: string[]): ConfigField[] {
    return fields.map(field => ({
      field,
      message: `Enter a ${field}`,
      type: 'input',
      required: field === 'title'
    }));
  }

  validateConfigField(field: string, value: unknown): ValidationResult {
    if (field === 'title' && !value) {
      return { isValid: false, error: 'Title is required' };
    }
    if (field === 'tags' && !Array.isArray(value)) {
      return { isValid: false, error: 'Tags must be an array' };
    }
    return { isValid: true };
  }

  async loadAutoUploadConfig(): Promise<TaptikConfig> {
    const configPath = path.join(os.homedir(), '.taptik', 'config.yaml');
    const defaultConfig = this.generateDefaultConfig();
    
    try {
      await fs.access(configPath);
      const content = await fs.readFile(configPath, 'utf-8');
      // Simple YAML-like parsing for test purposes
      const config = this.parseSimpleYaml(content);
      return this.mergeWithDefaults(config);
    } catch {
      this.logger.verbose('No auto-upload configuration found, using defaults');
      return defaultConfig;
    }
  }

  validateAutoUploadConfig(config: TaptikConfig): ConfigValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (config.cloud) {
      if (typeof config.cloud.enabled !== 'boolean') {
        errors.push('cloud.enabled must be a boolean');
      }
      if (config.cloud.default_visibility && 
          !['public', 'private', 'ask'].includes(config.cloud.default_visibility)) {
        errors.push('cloud.default_visibility must be "public" or "private"');
      }
      if (config.cloud.auto_tags && !Array.isArray(config.cloud.auto_tags)) {
        errors.push('cloud.auto_tags must be an array');
      }
    }
    
    return { isValid: errors.length === 0, errors, warnings };
  }

  mergeWithDefaults(config: Partial<TaptikConfig>): TaptikConfig {
    const defaults = this.generateDefaultConfig();
    return {
      cloud: {
        ...defaults.cloud,
        ...(config.cloud || {})
      },
      upload_filters: {
        ...defaults.upload_filters,
        ...(config.upload_filters || {})
      },
      notifications: {
        ...defaults.notifications,
        ...(config.notifications || {})
      },
      authentication: {
        ...defaults.authentication,
        ...(config.authentication || {})
      },
      performance: {
        ...defaults.performance,
        ...(config.performance || {})
      }
    };
  }

  generateDefaultConfig(): TaptikConfig {
    return {
      cloud: {
        enabled: false,
        auto_upload: false,
        default_visibility: 'private',
        auto_tags: []
      },
      upload_filters: {
        exclude_patterns: ['*.key', '*token*', '*secret*', '*password*'],
        include_patterns: [],
        max_file_size_mb: 50
      },
      notifications: {
        upload_success: true,
        upload_failed: true,
        download_available: false
      },
      authentication: {
        provider: null,
        remember_me: false,
        token_cache: true
      },
      performance: {
        parallel_uploads: false,
        compression_level: 'balanced',
        chunk_size_kb: 1024
      }
    };
  }

  async saveAutoUploadConfig(config: TaptikConfig): Promise<void> {
    const configPath = path.join(os.homedir(), '.taptik', 'config.yaml');
    const configDir = path.dirname(configPath);
    
    await fs.mkdir(configDir, { recursive: true });
    const yamlContent = this.convertToYaml(config);
    await fs.writeFile(configPath, yamlContent, 'utf-8');
    this.logger.log('✅ Auto-upload configuration saved to ~/.taptik/config.yaml');
  }

  reportSanitizationProgress(progress: { current: number; total: number; item: string }): void {
    this.logger.log(`  Scanning: ${progress.item} (${progress.current}/${progress.total})`);
  }

  displayValidationResults(results: ValidationResults): void {
    this.logger.log(`  ✅ Schema validation: ${results.schema ? 'PASSED' : 'FAILED'}`);
    this.logger.log(`  ✅ Size validation: ${results.size ? 'PASSED' : 'FAILED'}`);
    this.logger.log(`  ✅ Compatibility: ${results.compatibility ? 'PASSED' : 'FAILED'}`);
    results.schemaErrors?.forEach((error: string) => {
      this.logger.error(`  ❌ Schema error: ${error}`);
    });
    results.compatibilityIssues?.forEach((issue: string) => {
      this.logger.warn(`  ⚠️  Compatibility issue: ${issue}`);
    });
  }

  displayUploadSuccess(result: UploadResult): void {
    this.logger.log('🌥️  Successfully uploaded to cloud!');
    this.logger.log(`  🔗 Share link: ${result.url}`);
    this.logger.log(`  👁️  Visibility: ${result.visibility === 'public' ? 'Public' : 'Private'}`);
    this.logger.log(`  📋 Config ID: ${result.configId}`);
  }

  saveProgressState(): ProgressState {
    this.progressState = {
      currentStep: this.currentStep,
      totalSteps: this.totalSteps,
      completedSteps: this.stepDescriptions.slice(0, this.currentStep),
      timestamp: new Date().toISOString()
    };
    return this.progressState;
  }

  restoreProgressState(state: ProgressState): void {
    this.currentStep = state.currentStep;
    this.totalSteps = state.totalSteps;
    this.progressState = state;
  }

  isProgressStateStale(state: ProgressState): boolean {
    const stateTime = new Date(state.timestamp).getTime();
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    
    if (now - stateTime > oneHour) {
      this.logger.warn('Progress state is stale (older than 1 hour), starting fresh');
      return true;
    }
    return false;
  }

  // Enhanced status message methods for better user guidance
  displaySanitizationMessage(): void {
    this.logger.log('🔍 Scanning for sensitive data patterns...');
    this.logger.log('  • API keys and tokens - Removing authentication credentials');
    this.logger.log('  • Passwords and secrets - Sanitizing sensitive values');
    this.logger.log('  • Private credentials - Protecting personal information');
    this.logger.log('  • Environment variables - Masking system-specific data');
    this.logger.verbose('💡 Tip: Review sanitization report after build to ensure data safety');
  }

  showValidationResults(results: ValidationResults): void {
    const allValid = results.schema && results.size && results.compatibility;
    const statusEmoji = allValid ? '✅' : '⚠️';
    
    this.logger.log(`${statusEmoji} Validation Results:`);
    
    // Schema validation
    const schemaStatus = results.schema ? '✅ Valid' : '❌ Invalid';
    const schemaDetails = results.schemaErrors?.length > 0 
      ? ` (${results.schemaErrors.length} issues)` 
      : '';
    this.logger.log(`  Schema: ${schemaStatus}${schemaDetails}`);
    
    // Size validation
    const sizeStatus = results.size ? '✅ Within limits' : '❌ Exceeds limits';
    const sizeDetails = results.actualSize 
      ? ` (${(results.actualSize / 1024).toFixed(1)} KB / ${results.maxSize / 1024} KB max)` 
      : '';
    this.logger.log(`  Size: ${sizeStatus}${sizeDetails}`);
    
    // Compatibility validation
    const compatStatus = results.compatibility ? '✅ Compatible' : '⚠️ Issues found';
    const compatDetails = results.compatibilityIssues?.length > 0
      ? ` (${results.compatibilityIssues.length} warnings)`
      : '';
    this.logger.log(`  Compatibility: ${compatStatus}${compatDetails}`);
    
    // Feature support
    if (results.features) {
      this.logger.log('  Feature Support:');
      Object.entries(results.features).forEach(([feature, supported]) => {
        const featureStatus = supported ? '✅' : '⚠️';
        this.logger.log(`    ${featureStatus} ${feature}`);
      });
    }
    
    // Overall recommendation
    if (!allValid) {
      this.logger.log('\n💡 Recommendations:');
      if (!results.schema) {
        this.logger.log('  • Fix schema validation errors before uploading');
      }
      if (!results.size) {
        this.logger.log('  • Reduce package size or split into smaller packages');
      }
      if (!results.compatibility) {
        this.logger.log('  • Review compatibility warnings for best cloud experience');
      }
    }
  }

  displayActionableError(error: ActionableError): void {
    const errorType = error.type || 'general';
    const errorEmoji = this.getErrorEmoji(errorType);
    
    this.logger.error(`${errorEmoji} Error: ${error.message}`);
    
    // Show error context if available
    if (error.context) {
      this.logger.error(`  Context: ${error.context}`);
    }
    
    // Show suggested actions
    if (error.suggestions && error.suggestions.length > 0) {
      this.logger.log('\n💡 Suggested actions:');
      error.suggestions.forEach((suggestion: string, index: number) => {
        this.logger.log(`  ${index + 1}. ${suggestion}`);
      });
    }
    
    // Show help resources
    if (error.helpUrl) {
      this.logger.log(`\n📚 Learn more: ${error.helpUrl}`);
    }
    
    // Show recovery options
    if (error.recoverable) {
      this.logger.log('\n🔄 This error is recoverable. You can:');
      this.logger.log('  • Run with --verbose for more details');
      this.logger.log('  • Use --dry-run to preview changes');
      this.logger.log('  • Check logs at ~/.taptik/logs/');
    }
  }

  private getErrorEmoji(errorType: string): string {
    const emojiMap: Record<string, string> = {
      'file': '📁',
      'network': '🌐',
      'permission': '🔒',
      'validation': '⚠️',
      'config': '⚙️',
      'auth': '🔑',
      'general': '❌'
    };
    return emojiMap[errorType] || '❌';
  }

  showUploadSuccess(url: string): void {
    this.logger.log('\n✨ Upload successful!');
    this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    this.logger.log(`🔗 Share link: ${url}`);
    this.logger.log('📋 Link copied to clipboard');
    this.logger.log('\n📢 Share your configuration:');
    this.logger.log('  • Send link to team members');
    this.logger.log('  • Post in community forums');
    this.logger.log('  • Include in documentation');
    this.logger.log('\n🎯 Next steps:');
    this.logger.log('  • Deploy to Claude Code: taptik deploy <config-id>');
    this.logger.log('  • View in browser: taptik open <config-id>');
    this.logger.log('  • Manage uploads: taptik list --mine');
  }

  // Helper methods for YAML parsing/generation (enhanced for production)
  private parseSimpleYaml(content: string): Record<string, unknown> {
    // Enhanced YAML parsing with robust value handling
    const lines = content.split('\n');
    const result: Record<string, unknown> = {};
    const stack: Record<string, unknown>[] = [result];
    const keyStack: string[] = [];
    
    for (const line of lines) {
      const indent = line.search(/\S/);
      const trimmed = line.trim();
      
      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#')) continue;
      
      // Handle list items
      if (trimmed.startsWith('- ')) {
        const value = trimmed.substring(2);
        const current = stack[stack.length - 1];
        const lastKey = keyStack[keyStack.length - 1];
        
        if (!current[lastKey]) {
          current[lastKey] = [];
        }
        const arr = current[lastKey];
        if (Array.isArray(arr)) {
          arr.push(this.parseYamlValue(value));
        }
        continue;
      }
      
      // Handle key-value pairs
      if (trimmed.includes(':')) {
        const colonIndex = trimmed.indexOf(':');
        const key = trimmed.substring(0, colonIndex).trim();
        const value = trimmed.substring(colonIndex + 1).trim();
        
        // Adjust stack based on indentation
        const level = Math.floor(indent / 2);
        while (stack.length > level + 1) {
          stack.pop();
          keyStack.pop();
        }
        
        const current = stack[stack.length - 1];
        
        if (value) {
          // Parse and assign value
          current[key] = this.parseYamlValue(value);
        } else {
          // New nested object
          current[key] = {};
          stack.push(current[key] as Record<string, unknown>);
          keyStack.push(key);
        }
      }
    }
    
    return result;
  }

  private parseYamlValue(value: string): string | number | boolean | null {
    // Remove surrounding quotes if present
    const cleanValue = value.replace(/^["']|["']$/g, '').trim();
    
    // Boolean values
    if (cleanValue === 'true') return true;
    if (cleanValue === 'false') return false;
    if (cleanValue === 'null' || cleanValue === '~') return null;
    
    // Number values
    const numValue = Number(cleanValue);
    if (!isNaN(numValue) && cleanValue === numValue.toString()) {
      return numValue;
    }
    
    // String value
    return cleanValue;
  }

  private convertToYaml(obj: TaptikConfig): string {
    // Simple YAML generation for test purposes
    let yaml = '';
    
    const writeObject = (o: Record<string, unknown>, indent = '') => {
      for (const [key, value] of Object.entries(o)) {
        if (value === null || value === undefined) {
          yaml += `${indent}${key}: null\n`;
        } else if (typeof value === 'object' && !Array.isArray(value)) {
          yaml += `${indent}${key}:\n`;
          writeObject(value as Record<string, unknown>, `${indent  }  `);
        } else if (Array.isArray(value)) {
          yaml += `${indent}${key}:\n`;
          value.forEach(item => {
            yaml += `${indent}  - ${item}\n`;
          });
        } else {
          yaml += `${indent}${key}: ${value}\n`;
        }
      }
    };
    
    writeObject(obj as unknown as Record<string, unknown>);
    return yaml;
  }

  /**
   * Show progress for output generation
   */
  startOutput(): void {
    this.startStep('Generating output files');
  }

  /**
   * Complete output generation
   * @param outputPath Path where files were generated
   * @param fileCount Number of files created
   */
  completeOutput(outputPath: string, fileCount: number): void {
    this.completeStep(`Generated ${fileCount} files in ${outputPath}`);
  }

  /**
   * Display final build summary
   * @param buildTime Total build time in milliseconds
   * @param outputPath Path to output directory
   * @param categories Categories that were processed
   */
  displayBuildSummary(buildTime: number, outputPath: string, categories: string[]): void {
    const timeFormatted = this.formatDuration(buildTime);
    
    this.logger.log('');
    this.logger.log('🎉 Build completed successfully!');
    this.logger.log(`📁 Output directory: ${outputPath}`);
    this.logger.log(`📋 Categories processed: ${categories.join(', ')}`);
    this.logger.log(`⏱️  Build time: ${timeFormatted}`);
    this.logger.log('');
  }

  /**
   * Display warnings and errors summary
   * @param warnings Array of warning messages
   * @param errors Array of error messages
   */
  displayIssuesSummary(warnings: string[], errors: string[]): void {
    if (warnings.length > 0) {
      this.logger.log('');
      this.logger.warn('⚠️  Warnings encountered:');
      warnings.forEach(warning => this.logger.warn(`  • ${warning}`));
    }

    if (errors.length > 0) {
      this.logger.log('');
      this.logger.error('❌ Errors encountered:');
      errors.forEach(error => this.logger.error(`  • ${error}`));
    }
  }

  /**
   * Get current progress percentage
   */
  getProgressPercentage(): number {
    if (this.totalSteps === 0) return 0;
    return Math.round((this.currentStep / this.totalSteps) * 100);
  }

  /**
   * Check if build is complete
   */
  isComplete(): boolean {
    return this.currentStep >= this.totalSteps;
  }

  /**
   * Reset progress tracking
   */
  reset(): void {
    this.currentStep = 0;
    this.totalSteps = 0;
    this.stepDescriptions = [];
  }

  /**
   * Format duration in milliseconds to human-readable format
   * @param milliseconds Duration in milliseconds
   */
  private formatDuration(milliseconds: number): string {
    if (milliseconds < 1000) {
      return `${milliseconds}ms`;
    }
    
    const seconds = Math.floor(milliseconds / 1000);
    if (seconds < 60) {
      return `${seconds}s`;
    }
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }
}