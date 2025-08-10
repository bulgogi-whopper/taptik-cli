import { Injectable, Logger } from '@nestjs/common';

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