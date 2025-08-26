import { Logger } from '@nestjs/common';

import chalk from 'chalk';
import Table from 'cli-table3';
import { Command, CommandRunner, Option } from 'nest-commander';

import { AuthService } from '../../auth/auth.service';
import { PackageMetadata } from '../interfaces';
import {
  PackageRegistryService,
  PackageFilters,
} from '../services/package-registry.service';

interface ListCommandOptions {
  cloud?: boolean;
  platform?: string;
  visibility?: 'public' | 'private' | 'all';
  limit?: number;
  sortBy?: 'created' | 'updated' | 'downloads' | 'name';
  format?: 'table' | 'json' | 'simple';
}

@Command({
  name: 'list',
  description: 'List your uploaded packages from the cloud',
})
export class ListCommand extends CommandRunner {
  private readonly logger = new Logger(ListCommand.name);

  constructor(
    private readonly authService: AuthService,
    private readonly packageRegistry: PackageRegistryService,
  ) {
    super();
  }

  @Option({
    flags: '--cloud',
    description: 'List packages from cloud storage',
    defaultValue: true,
  })
  parseCloud(): boolean {
    return true;
  }

  @Option({
    flags: '--platform <platform>',
    description: 'Filter by platform (claude-code, kiro, cursor)',
  })
  parsePlatform(value: string): string {
    return value;
  }

  @Option({
    flags: '--visibility <visibility>',
    description: 'Filter by visibility (public, private, all)',
    defaultValue: 'all',
  })
  parseVisibility(value: string): 'public' | 'private' | 'all' {
    if (!['public', 'private', 'all'].includes(value)) {
      throw new Error('Visibility must be public, private, or all');
    }
    return value as 'public' | 'private' | 'all';
  }

  @Option({
    flags: '--limit <limit>',
    description: 'Maximum number of packages to display',
    defaultValue: '20',
  })
  parseLimit(value: string): number {
    const limit = parseInt(value, 10);
    if (isNaN(limit) || limit < 1) {
      throw new Error('Limit must be a positive number');
    }
    return limit;
  }

  @Option({
    flags: '--sort-by <field>',
    description: 'Sort packages by field (created, updated, downloads, name)',
    defaultValue: 'created',
  })
  parseSortBy(value: string): 'created' | 'updated' | 'downloads' | 'name' {
    if (!['created', 'updated', 'downloads', 'name'].includes(value)) {
      throw new Error(
        'Sort field must be created, updated, downloads, or name',
      );
    }
    return value as 'created' | 'updated' | 'downloads' | 'name';
  }

  @Option({
    flags: '--format <format>',
    description: 'Output format (table, json, simple)',
    defaultValue: 'table',
  })
  parseFormat(value: string): 'table' | 'json' | 'simple' {
    if (!['table', 'json', 'simple'].includes(value)) {
      throw new Error('Format must be table, json, or simple');
    }
    return value as 'table' | 'json' | 'simple';
  }

  async run(_inputs: string[], options: ListCommandOptions): Promise<void> {
    try {
      // Check authentication
      const session = await this.authService.getSession();
      if (!session?.user) {
        this.logger.error(
          'Authentication required. Please run "taptik auth login" first.',
        );
        process.exit(1);
      }

      // Build filters
      const filters: PackageFilters = {};

      if (options.platform) {
        filters.platform = options.platform;
      }

      if (options.visibility && options.visibility !== 'all') {
        filters.isPublic = options.visibility === 'public';
      }

      // Fetch packages
      const packages = await this.packageRegistry.listUserPackages(
        session.user.id,
        filters,
      );

      // Sort packages
      const sortedPackages = this.sortPackages(
        packages,
        options.sortBy || 'created',
      );

      // Apply limit
      const limitedPackages = sortedPackages.slice(0, options.limit || 20);

      // Display results
      if (limitedPackages.length === 0) {
        console.log(chalk.yellow('No packages found.'));

        if (!options.platform && !options.visibility) {
          console.log(
            chalk.gray(
              '\nTip: Use "taptik push" to upload your first package.',
            ),
          );
        }
        return;
      }

      // Format and display
      switch (options.format) {
        case 'json':
          console.log(JSON.stringify(limitedPackages, null, 2));
          break;

        case 'simple':
          this.displaySimpleFormat(limitedPackages);
          break;

        case 'table':
        default:
          this.displayTableFormat(limitedPackages);
          break;
      }

      // Show summary
      if (options.format !== 'json') {
        console.log(
          chalk.gray(
            `\nShowing ${limitedPackages.length} of ${packages.length} packages`,
          ),
        );

        if (packages.length > limitedPackages.length) {
          console.log(
            chalk.gray(`Use --limit ${packages.length} to see all packages`),
          );
        }
      }
    } catch (error) {
      this.logger.error(`Failed to list packages: ${error.message}`);
      process.exit(1);
    }
  }

  private sortPackages(
    packages: PackageMetadata[],
    sortBy: 'created' | 'updated' | 'downloads' | 'name',
  ): PackageMetadata[] {
    const sorted = [...packages];

    switch (sortBy) {
      case 'created':
        return sorted.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );

      case 'updated':
        return sorted.sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        );

      case 'downloads':
        // Sort by download count (would need to fetch stats)
        return sorted;

      case 'name':
        return sorted.sort((a, b) =>
          (a.title || a.name).localeCompare(b.title || b.name),
        );

      default:
        return sorted;
    }
  }

  private displayTableFormat(packages: PackageMetadata[]): void {
    const table = new Table({
      head: [
        chalk.cyan('ID'),
        chalk.cyan('Title'),
        chalk.cyan('Platform'),
        chalk.cyan('Version'),
        chalk.cyan('Visibility'),
        chalk.cyan('Created'),
      ],
      style: {
        head: [],
        border: [],
      },
    });

    packages.forEach((pkg) => {
      table.push([
        chalk.white(pkg.configId.substring(0, 8)),
        chalk.bold(pkg.title || pkg.name),
        chalk.gray(pkg.platform),
        chalk.gray(pkg.version),
        pkg.isPublic ? chalk.green('public') : chalk.yellow('private'),
        chalk.gray(this.formatDate(pkg.createdAt)),
      ]);
    });

    console.log(table.toString());
  }

  private displaySimpleFormat(packages: PackageMetadata[]): void {
    packages.forEach((pkg) => {
      const visibility = pkg.isPublic ? '📢' : '🔒';
      console.log(
        `${visibility} ${chalk.bold(pkg.title || pkg.name)} ` +
          `${chalk.gray(`(${pkg.configId.substring(0, 8)})`)} ` +
          `- ${chalk.gray(pkg.platform)} v${pkg.version}`,
      );
    });
  }

  private formatDate(date: Date | string): string {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      if (diffHours === 0) {
        const diffMins = Math.floor(diffMs / (1000 * 60));
        return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
      }
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    } else if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return `${weeks} week${weeks !== 1 ? 's' : ''} ago`;
    } else {
      return d.toLocaleDateString();
    }
  }
}
