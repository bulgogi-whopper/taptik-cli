import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Service responsible for generating output files and directory structure
 * Creates timestamped directories and writes transformed data to JSON files
 */
@Injectable()
export class OutputService {
  private readonly logger = new Logger(OutputService.name);

  /**
   * Create timestamped output directory with conflict resolution
   * @param basePath Base path for directory creation (default: current working directory)
   * @returns Path to the created directory
   */
  async createOutputDirectory(basePath?: string): Promise<string> {
    try {
      const workingDir = basePath || process.cwd();
      const timestamp = this.generateTimestamp();
      let outputPath = join(workingDir, `taptik-build-${timestamp}`);
      let counter = 1;

      // Handle directory conflicts with incremental numbering
      while (await this.directoryExists(outputPath)) {
        outputPath = join(workingDir, `taptik-build-${timestamp}-${counter}`);
        counter++;

        // Prevent infinite loops
        if (counter > 1000) {
          throw new Error('Unable to create unique directory after 1000 attempts');
        }
      }

      await fs.mkdir(outputPath, { recursive: true });
      this.logger.log(`Created output directory: ${outputPath}`);

      return resolve(outputPath);
    } catch (error) {
      this.logger.error('Failed to create output directory', error.stack);
      throw new Error(`Output directory creation failed: ${error.message}`);
    }
  }

  /**
   * Generate timestamp in YYYYMMDD-HHMMSS format
   */
  private generateTimestamp(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    return `${year}${month}${day}-${hours}${minutes}${seconds}`;
  }

  /**
   * Check if directory exists
   */
  private async directoryExists(path: string): Promise<boolean> {
    try {
      const stats = await fs.stat(path);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }
}