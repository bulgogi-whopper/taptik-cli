import { promises as fs } from 'node:fs';

import { Injectable, Logger } from '@nestjs/common';

export interface ErrorSummary {
  criticalErrors: CriticalError[];
  warnings: Warning[];
  partialFiles: string[];
}

export interface CriticalError {
  type: 'file_system' | 'conversion' | 'validation' | 'system' | 'security';
  message: string;
  details?: string;
  suggestedResolution?: string;
  exitCode: number;
}

export interface Warning {
  type:
    | 'missing_file'
    | 'permission_denied'
    | 'partial_conversion'
    | 'validation_warning'
    | 'package'
    | 'security'
    | 'validation'
    | 'push';
  message: string;
  details?: string;
}

@Injectable()
export class ErrorHandlerService {
  private readonly logger = new Logger(ErrorHandlerService.name);
  private errorSummary: ErrorSummary = {
    criticalErrors: [],
    warnings: [],
    partialFiles: [],
  };
  private isInterrupted = false;
  private cleanupHandlers: (() => Promise<void>)[] = [];

  constructor() {
    this.setupInterruptHandlers();
  }

  /**
   * Set up Ctrl+C and other interrupt signal handlers
   */
  private setupInterruptHandlers(): void {
    // Handle Ctrl+C (SIGINT)
    process.on('SIGINT', async () => {
      if (this.isInterrupted) {
        // Force exit if already interrupted once
        this.logger.warn(
          '\n⚠️  Force exit requested. Terminating immediately...',
        );
        process.exit(130); // Standard exit code for SIGINT
      }

      this.isInterrupted = true;
      this.logger.warn('\n⚠️  Build process interrupted by user (Ctrl+C)');
      this.logger.log('🧹 Cleaning up partial files...');

      try {
        await this.performCleanup();
        this.logger.log('✅ Cleanup completed successfully');
        process.exit(130); // Standard exit code for SIGINT
      } catch (error) {
        this.logger.error('❌ Error during cleanup:', error.message);
        process.exit(1);
      }
    });

    // Handle SIGTERM (termination signal)
    process.on('SIGTERM', async () => {
      this.logger.warn('\n⚠️  Build process terminated');
      this.logger.log('🧹 Cleaning up partial files...');

      try {
        await this.performCleanup();
        process.exit(143); // Standard exit code for SIGTERM
      } catch (error) {
        this.logger.error('❌ Error during cleanup:', error.message);
        process.exit(1);
      }
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
      this.addCriticalError({
        type: 'system',
        message: 'Uncaught exception occurred',
        details: error.message,
        suggestedResolution: 'Please report this issue with the error details',
        exitCode: 1,
      });

      this.logger.error('\n💥 Critical system error occurred:');
      this.logger.error(error.message);

      await this.performCleanup();
      this.displayErrorSummary();
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', async (reason) => {
      this.addCriticalError({
        type: 'system',
        message: 'Unhandled promise rejection',
        details: reason instanceof Error ? reason.message : String(reason),
        suggestedResolution: 'Please report this issue with the error details',
        exitCode: 1,
      });

      this.logger.error('\n💥 Unhandled promise rejection:');
      this.logger.error(reason);

      await this.performCleanup();
      this.displayErrorSummary();
      process.exit(1);
    });
  }

  /**
   * Add a critical error that should cause the build to fail
   */
  addCriticalError(error: CriticalError): void {
    this.errorSummary.criticalErrors.push(error);
    this.logger.error(`Critical error: ${error.message}`, error.details);
  }

  /**
   * Add a warning that doesn't prevent the build from continuing
   */
  addWarning(warning: Warning): void {
    this.errorSummary.warnings.push(warning);
    this.logger.warn(`Warning: ${warning.message}`, warning.details);
  }

  /**
   * Register a partial file that should be cleaned up on interruption
   */
  registerPartialFile(filePath: string): void {
    if (!this.errorSummary.partialFiles.includes(filePath)) {
      this.errorSummary.partialFiles.push(filePath);
    }
  }

  /**
   * Remove a file from the partial files list (when successfully completed)
   */
  unregisterPartialFile(filePath: string): void {
    const index = this.errorSummary.partialFiles.indexOf(filePath);
    if (index > -1) {
      this.errorSummary.partialFiles.splice(index, 1);
    }
  }

  /**
   * Register a cleanup handler to be called on interruption
   */
  registerCleanupHandler(handler: () => Promise<void>): void {
    this.cleanupHandlers.push(handler);
  }

  /**
   * Check if there are any critical errors
   */
  hasCriticalErrors(): boolean {
    return this.errorSummary.criticalErrors.length > 0;
  }

  /**
   * Check if there are any warnings
   */
  hasWarnings(): boolean {
    return this.errorSummary.warnings.length > 0;
  }

  /**
   * Check if the process has been interrupted
   */
  isProcessInterrupted(): boolean {
    return this.isInterrupted;
  }

  /**
   * Get the current error summary
   */
  getErrorSummary(): ErrorSummary {
    return { ...this.errorSummary };
  }

  /**
   * Perform cleanup of partial files and run cleanup handlers
   */
  private async performCleanup(): Promise<void> {
    const cleanupPromises: Promise<void>[] = [];

    // Clean up partial files
    for (const filePath of this.errorSummary.partialFiles) {
      cleanupPromises.push(this.cleanupPartialFile(filePath));
    }

    // Run custom cleanup handlers
    for (const handler of this.cleanupHandlers) {
      cleanupPromises.push(
        handler().catch((error) => {
          this.logger.error('Error in cleanup handler:', error.message);
        }),
      );
    }

    await Promise.allSettled(cleanupPromises);
  }

  /**
   * Clean up a single partial file
   */
  private async cleanupPartialFile(filePath: string): Promise<void> {
    try {
      await fs.access(filePath);
      await fs.unlink(filePath);
      this.logger.debug(`Cleaned up partial file: ${filePath}`);
    } catch (error) {
      // File might not exist or already be cleaned up
      this.logger.debug(
        `Could not clean up file ${filePath}: ${error.message}`,
      );
    }
  }

  /**
   * Display error summary to the user
   */
  displayErrorSummary(): void {
    if (this.hasCriticalErrors() || this.hasWarnings()) {
      this.logger.log('\n📋 Build Summary:');
      this.logger.log('═'.repeat(50));
    }

    // Display critical errors
    if (this.hasCriticalErrors()) {
      this.logger.error('\n❌ Critical Errors:');
      for (const error of this.errorSummary.criticalErrors) {
        this.logger.error(`  • ${error.message}`);
        if (error.details) {
          this.logger.error(`    Details: ${error.details}`);
        }
        if (error.suggestedResolution) {
          this.logger.log(`    💡 Suggestion: ${error.suggestedResolution}`);
        }
      }
    }

    // Display warnings
    if (this.hasWarnings()) {
      this.logger.warn('\n⚠️  Warnings:');
      for (const warning of this.errorSummary.warnings) {
        this.logger.warn(`  • ${warning.message}`);
        if (warning.details) {
          this.logger.warn(`    Details: ${warning.details}`);
        }
      }
    }

    if (this.hasCriticalErrors() || this.hasWarnings()) {
      this.logger.log('═'.repeat(50));
    }
  }

  /**
   * Handle critical error and exit with appropriate code
   */
  handleCriticalErrorAndExit(error: CriticalError): never {
    this.addCriticalError(error);
    this.displayErrorSummary();
    process.exit(error.exitCode);
  }

  /**
   * Exit with appropriate code based on error state
   */
  exitWithAppropriateCode(): never {
    if (this.hasCriticalErrors()) {
      const highestExitCode = Math.max(
        ...this.errorSummary.criticalErrors.map((error) => error.exitCode),
        1,
      );
      process.exit(highestExitCode);
    }

    if (this.hasWarnings()) {
      console.log('\n✅ Build completed with warnings');
       
      process.exit(0);
    }

    console.log('\n✅ Build completed successfully');
     
    process.exit(0);
  }

  /**
   * Reset error state (useful for testing)
   */
  reset(): void {
    this.errorSummary = {
      criticalErrors: [],
      warnings: [],
      partialFiles: [],
    };
    this.isInterrupted = false;
    this.cleanupHandlers = [];
  }
}
