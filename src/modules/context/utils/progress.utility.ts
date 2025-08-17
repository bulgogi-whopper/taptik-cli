import { Injectable, Logger } from '@nestjs/common';

import { SingleBar, Presets } from 'cli-progress';

export interface ProgressOptions {
  total: number;
  format?: string;
  hideCursor?: boolean;
}

@Injectable()
export class ProgressUtility {
  private readonly logger = new Logger(ProgressUtility.name);
  private bar: SingleBar | null = null;

  /**
   * Start a progress bar
   */
  start(options: ProgressOptions): void {
    this.bar = new SingleBar(
      {
        format:
          options.format || '{bar} {percentage}% | {value}/{total} | {task}',
        hideCursor: options.hideCursor ?? true,
        clearOnComplete: false,
        stopOnComplete: true,
      },
      Presets.shades_classic,
    );

    this.bar.start(options.total, 0, { task: 'Starting...' });
  }

  /**
   * Update progress
   */
  update(current: number, payload?: { task?: string }): void {
    if (this.bar) {
      this.bar.update(current, payload);
    }
  }

  /**
   * Increment progress
   */
  increment(payload?: { task?: string }): void {
    if (this.bar) {
      this.bar.increment(1, payload);
    }
  }

  /**
   * Stop the progress bar
   */
  stop(): void {
    if (this.bar) {
      this.bar.stop();
      this.bar = null;
    }
  }

  /**
   * Create a simple spinner for indeterminate progress
   */
  spinner(message: string): { stop: () => void } {
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let i = 0;

    const interval = setInterval(() => {
      process.stdout.write(`\r${frames[i]} ${message}`);
      i = (i + 1) % frames.length;
    }, 80);

    return {
      stop: () => {
        clearInterval(interval);
        process.stdout.write(`\r${' '.repeat(message.length + 3)}\r`);
      },
    };
  }

  /**
   * Display a simple progress message
   */
  log(message: string, icon: '✓' | '✗' | 'ℹ' | '⚠' = 'ℹ'): void {
    const icons = {
      '✓': '\x1B[32m✓\x1B[0m', // Green checkmark
      '✗': '\x1B[31m✗\x1B[0m', // Red X
      ℹ: '\x1B[36mℹ\x1B[0m', // Cyan info
      '⚠': '\x1B[33m⚠\x1B[0m', // Yellow warning
    };

    this.logger.log(`${icons[icon]} ${message}`);
  }
}
