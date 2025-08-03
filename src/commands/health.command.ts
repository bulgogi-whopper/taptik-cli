import { Command, CommandRunner, Option } from 'nest-commander';

interface HealthCommandOptions {
  verbose?: boolean;
  format?: string;
}

@Command({
  name: 'health',
  description: 'Check application health status',
})
export class HealthCommand extends CommandRunner {
  async run(
    passedParameter: string[],
    options?: HealthCommandOptions,
  ): Promise<void> {
    if (options?.verbose) {
      console.log('Running health check in verbose mode...');
    }

    const healthStatus = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };

    if (options?.format === 'json') {
      console.log(JSON.stringify(healthStatus, null, 2));
    } else {
      console.log('🟢 Application is healthy');
      console.log(`Uptime: ${Math.floor(healthStatus.uptime)}s`);
      console.log(
        `Memory: ${Math.round(healthStatus.memory.heapUsed / 1024 / 1024)}MB`,
      );
    }
  }

  @Option({
    flags: '-v, --verbose',
    description: 'Enable verbose output',
  })
  parseVerbose(): boolean {
    return true;
  }

  @Option({
    flags: '-f, --format <format>',
    description: 'Output format (json|text)',
    defaultValue: 'text',
  })
  parseFormat(value: string): string {
    if (!['json', 'text'].includes(value)) {
      throw new Error('Format must be either "json" or "text"');
    }
    return value;
  }
}
