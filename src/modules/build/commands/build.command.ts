import { Command, CommandRunner } from 'nest-commander';

import { InteractiveService } from '../services/interactive.service';
import { ErrorHandlerService } from '../services/error-handler.service';

@Command({
  name: 'build',
  description: 'Build taptik-compatible context files from Kiro settings',
})
export class BuildCommand extends CommandRunner {
  constructor(
    private readonly interactiveService: InteractiveService,
    private readonly errorHandler: ErrorHandlerService,
  ) {
    super();
  }

  async run(): Promise<void> {
    try {
      // Check for interruption before starting
      if (this.errorHandler.isProcessInterrupted()) {
        return;
      }

      const platform = await this.interactiveService.selectPlatform();
      
      // Check for interruption after platform selection
      if (this.errorHandler.isProcessInterrupted()) {
        return;
      }

      const categories = await this.interactiveService.selectCategories();
      
      // Check for interruption after category selection
      if (this.errorHandler.isProcessInterrupted()) {
        return;
      }
      
      console.log('\n✅ Configuration complete!');
      console.log(`Platform: ${platform}`);
      console.log(`Categories: ${categories.map(c => c.name).join(', ')}`);
      

      // Display any warnings that occurred during the process
      if (this.errorHandler.hasWarnings()) {
        this.errorHandler.displayErrorSummary();
      }

      // Exit with appropriate code
      this.errorHandler.exitWithAppropriateCode();
    } catch (error) {
      // Handle different types of errors appropriately
      if (error.name === 'TimeoutError') {
        this.errorHandler.handleCriticalErrorAndExit({
          type: 'system',
          message: 'Build process timed out',
          details: error.message,
          suggestedResolution: 'Try running the command again or check your system resources',
          exitCode: 124, // Standard timeout exit code
        });
      } else if (error.code === 'EACCES') {
        this.errorHandler.handleCriticalErrorAndExit({
          type: 'file_system',
          message: 'Permission denied accessing files',
          details: error.message,
          suggestedResolution: 'Check file permissions or run with appropriate privileges',
          exitCode: 126, // Permission denied exit code
        });
      } else if (error.code === 'ENOENT') {
        this.errorHandler.handleCriticalErrorAndExit({
          type: 'file_system',
          message: 'Required file or directory not found',
          details: error.message,
          suggestedResolution: 'Ensure all required files exist and paths are correct',
          exitCode: 2, // File not found exit code
        });
      } else {
        // Generic critical error
        this.errorHandler.handleCriticalErrorAndExit({
          type: 'system',
          message: 'Build process failed with unexpected error',
          details: error.message,
          suggestedResolution: 'Please report this issue with the error details',
          exitCode: 1, // Generic error exit code
        });
      }
    }
  }
}