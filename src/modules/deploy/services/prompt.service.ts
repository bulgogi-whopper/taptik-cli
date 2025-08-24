import { stdin as input, stdout as output } from 'node:process';
import * as readline from 'node:readline/promises';

import { Injectable, OnModuleDestroy } from '@nestjs/common';

import { ConflictResult } from '../interfaces/deployment-result.interface';

interface DeploymentSummary {
  platform: string;
  components: string[];
  fileCount: number;
  mode: 'normal' | 'force' | 'dry-run';
}

interface DeploymentResults {
  deployed: string[];
  skipped: string[];
  failed: string[];
  backupCreated: boolean;
  duration: number;
}

type ConflictResolution = 'overwrite' | 'skip' | 'merge' | 'backup';

@Injectable()
export class PromptService implements OnModuleDestroy {
  private rl: readline.Interface;

  constructor() {
    this.rl = readline.createInterface({ input, output });
  }

  async confirmDeployment(summary: DeploymentSummary): Promise<boolean> {
    // Skip confirmation in force mode
    if (summary.mode === 'force') {
      return true;
    }

    // Display deployment summary
    this.write('\n=== Deployment Summary ===\n');
    this.write(`Platform: ${summary.platform}\n`);
    this.write(`Components: ${summary.components.join(', ')}\n`);
    this.write(`Files to deploy: ${summary.fileCount}\n`);

    if (summary.mode === 'dry-run') {
      this.write('\n⚠️  DRY RUN MODE - No files will be modified\n');
    }

    this.write('\n');

    // Get user confirmation
    const answer = await this.rl.question('Proceed with deployment? (y/n): ');
    return answer.toLowerCase() === 'y';
  }

  async selectConflictResolution(
    conflict: ConflictResult,
  ): Promise<ConflictResolution> {
    this.write('\n=== Conflict detected ===\n');
    this.write(`File: ${conflict.filePath}\n`);

    if (conflict.message) {
      this.write(`Reason: ${conflict.message}\n`);
    }

    this.write('\nOptions:\n');
    this.write('  [o] Overwrite existing file\n');
    this.write('  [s] Skip this file\n');
    this.write('  [m] Merge configurations\n');
    this.write('  [b] Backup and overwrite\n');
    this.write('  [d] Show diff\n');
    this.write('\n');

    let validChoice = false;
    let choice: ConflictResolution | 'diff' = 'skip';

    while (!validChoice) {
      const answer = await this.rl.question('Choose action: '); // eslint-disable-line no-await-in-loop
      const lowerAnswer = answer.toLowerCase();

      switch (lowerAnswer) {
        case 'o':
          choice = 'overwrite';
          validChoice = true;
          break;
        case 's':
          choice = 'skip';
          validChoice = true;
          break;
        case 'm':
          choice = 'merge';
          validChoice = true;
          break;
        case 'b':
          choice = 'backup';
          validChoice = true;
          break;
        case 'd':
          // Show diff and continue loop
          this.showDiff(conflict);
          break;
        default:
          this.write('Invalid option. Please choose o, s, m, b, or d.\n');
      }
    }

    return choice;
  }

  showProgress(message: string, current: number, total: number): void {
    const percentage = Math.round((current / total) * 100);
    const barLength = 40;
    const filledLength = Math.round((barLength * current) / total);
    const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);

    this.write(`\r${message}: [${bar}] ${percentage}%`);

    if (current === total) {
      this.write('\n');
    }
  }

  showDeploymentSummary(results: DeploymentResults): void {
    this.write('\n=== Deployment Complete ===\n\n');

    if (results.deployed.length > 0) {
      this.write(`✅ ${results.deployed.length} files deployed\n`);
    }

    if (results.skipped.length > 0) {
      this.write(
        `⏭️  ${results.skipped.length} file${results.skipped.length > 1 ? 's' : ''} skipped\n`,
      );
    }

    if (results.failed.length > 0) {
      this.write(
        `❌ ${results.failed.length} file${results.failed.length > 1 ? 's' : ''} failed\n`,
      );
    }

    if (results.backupCreated) {
      this.write('💾 Backup created\n');
    }

    const durationInSeconds = (results.duration / 1000).toFixed(2);
    this.write(`⏱️  Duration: ${durationInSeconds}s\n`);
  }

  async askForRetry(message: string): Promise<boolean> {
    this.write(`\n⚠️  ${message}\n`);
    const answer = await this.rl.question('Retry? (y/n): ');
    return answer.toLowerCase() === 'y';
  }

  async selectComponents(available: string[]): Promise<string[]> {
    this.write('\nSelect components to deploy:\n');

    available.forEach((component, index) => {
      this.write(`  [${index + 1}] ${component}\n`);
    });

    this.write(
      '\nEnter selection (comma-separated numbers, "all", or "none"): ',
    );
    const answer = await this.rl.question('');

    if (answer.toLowerCase() === 'all') {
      return available;
    }

    if (answer.toLowerCase() === 'none') {
      return [];
    }

    // Parse comma-separated numbers
    const indices = answer
      .split(',')
      .map((s) => Number.parseInt(s.trim(), 10) - 1)
      .filter((i) => i >= 0 && i < available.length);

    return indices.map((i) => available[i]);
  }

  cleanup(): void {
    if (this.rl) {
      this.rl.close();
    }
  }

  onModuleDestroy(): void {
    this.cleanup();
  }

  private write(text: string): void {
    output.write(text);
  }

  private showDiff(conflict: ConflictResult): void {
    if (!conflict.originalContent || !conflict.newContent) {
      this.write('No diff available\n');
      return;
    }

    this.write('\n--- Original ---\n');
    this.write(conflict.originalContent);
    this.write('\n+++ New +++\n');
    this.write(conflict.newContent);
    this.write('\n');
  }
}
