import { Command, CommandRunner, Option } from 'nest-commander';

import { DisplayConfiguration, ConfigurationListResult } from '../../../models/config-bundle.model';
import { AuthService } from '../../auth/auth.service';
import { ListService } from '../services/list.service';

/**
 * CLI options interface for the list command
 */
interface ListCommandOptions {
  filter?: string;
  sort?: 'date' | 'name';
  limit?: number;
}

/**
 * List Command for CLI interface
 * Handles listing of public and liked configurations
 * Implements Requirements: 1.1, 1.2, 1.3, 2.1, 2.3, 3.1, 3.3, 4.1, 4.3, 4.4, 5.1, 5.3, 6.4
 */
@Command({
  name: 'list',
  description: 'List available configuration packages',
  arguments: '[subcommand]',
})
export class ListCommand extends CommandRunner {
  constructor(
    private readonly listService: ListService,
    private readonly authService: AuthService,
  ) {
    super();
  }

  /**
   * Main command execution
   * Handles both public listing and subcommand routing
   */
  async run(
    passedParams: string[] = [],
    options: ListCommandOptions = {},
  ): Promise<void> {
    try {
      // Check if this is a subcommand
      const subcommand = passedParams[0];

      if (subcommand === 'liked') {
        await this.handleLikedSubcommand(options);
      } else if (subcommand && subcommand !== 'liked') {
        // Invalid subcommand
        console.error(`❌ Invalid subcommand '${subcommand}'`);
        console.error('💡 Valid subcommands: liked');
        console.error('💡 Use "taptik list --help" for more information');
        process.exit(1);
      } else {
        // Default: list public configurations
        await this.handlePublicList(options);
      }
    } catch (error) {
      await this.handleError(error);
    }
  }

  /**
   * Handle listing public configurations
   * Implements Requirements: 1.1, 1.2, 1.3, 2.1, 2.3, 3.1, 3.3, 4.1, 4.3, 4.4
   */
  private async handlePublicList(options: ListCommandOptions): Promise<void> {
    // Validate and process options
    const processedOptions = this.processOptions(options);

    // Get configurations from service
    const result = await this.listService.listConfigurations(processedOptions);

    // Display results
    if (result.configurations.length === 0) {
      console.log(this.getEmptyStateMessage(processedOptions.filter));
      return;
    }

    // Display table
    this.displayConfigurationTable(result.configurations);

    // Display pagination info if needed
    this.displayPaginationInfo(result, 'configurations');
  }

  /**
   * Handle listing liked configurations subcommand
   * Implements Requirements: 5.1, 5.3
   */
  private async handleLikedSubcommand(
    options: ListCommandOptions,
  ): Promise<void> {
    // Check authentication
    const user = await this.authService.getCurrentUser();
    if (!user) {
      console.error(`❌ ${this.getAuthenticationRequiredMessage()}`);
      process.exit(1);
    }

    // Validate and process options
    const processedOptions = this.processOptions(options);

    // Get liked configurations from service
    const result = await this.listService.listLikedConfigurations(
      user.id,
      processedOptions,
    );

    // Display results
    if (result.configurations.length === 0) {
      console.log(this.getNoLikedConfigurationsMessage());
      return;
    }

    // Display table
    this.displayConfigurationTable(result.configurations);

    // Display pagination info if needed
    this.displayPaginationInfo(result, 'liked configurations');
  }

  /**
   * Process and validate command options
   * Implements Requirements: 3.3, 4.3, 4.4
   */
  private processOptions(options: ListCommandOptions = {}): ListCommandOptions {
    const processed: ListCommandOptions = {};

    // Process filter option
    if (options?.filter !== undefined) {
      if (typeof options.filter !== 'string') {
        throw new Error('Filter must be a string');
      }
      processed.filter = options.filter.trim();
    }

    // Process sort option
    if (options?.sort !== undefined) {
      if (!['date', 'name'].includes(options.sort)) {
        throw new Error(
          `Invalid sort option '${options.sort}'. Valid options: date, name`,
        );
      }
      processed.sort = options.sort;
    } else {
      processed.sort = 'date'; // Default sort
    }

    // Process limit option
    if (options?.limit !== undefined) {
      const limit = Number(options.limit);
      if (isNaN(limit) || limit <= 0) {
        throw new Error('Limit must be greater than 0');
      }
      if (limit > 100) {
        throw new Error('Limit cannot exceed 100');
      }
      processed.limit = limit;
    } else {
      processed.limit = 20; // Default limit
    }

    return processed;
  }

  /**
   * Display configurations in table format
   * Implements Requirements: 1.2, 1.3, 2.3, 4.5, 5.3
   */
  private displayConfigurationTable(
    configurations: DisplayConfiguration[],
  ): void {
    if (configurations.length === 0) {
      return;
    }

    // Display table with proper formatting
    const tableOutput = this.formatConfigurationTable(configurations);
    console.log(tableOutput);
  }

  /**
   * Format configurations into a table string
   * Creates a properly formatted table with headers and aligned columns
   */
  private formatConfigurationTable(
    configurations: DisplayConfiguration[],
  ): string {
    if (configurations.length === 0) {
      return this.getEmptyStateMessage();
    }

    const header = this.getTableHeader();
    const separator = this.getTableSeparator();
    const rows = configurations.map((config) => this.formatTableRow(config));

    return [header, separator, ...rows].join('\n');
  }

  /**
   * Get table header with proper column alignment
   */
  private getTableHeader(): string {
    return 'ID       Title                    Created      Size     Access';
  }

  /**
   * Get table separator line
   */
  private getTableSeparator(): string {
    return '─'.repeat(70);
  }

  /**
   * Format a single configuration row for table display
   */
  private formatTableRow(config: DisplayConfiguration): string {
    const id = this.formatId(config.id);
    const title = this.formatTitle(config.title);
    const created = this.formatDate(config.createdAt);
    const size = this.formatSize(config.size);
    const access = this.formatAccessLevel(config.accessLevel);

    return `${id} ${title} ${created} ${size} ${access}`;
  }

  /**
   * Format ID column (8 characters)
   */
  private formatId(id: string): string {
    return id.substring(0, 8).padEnd(8);
  }

  /**
   * Format title column (24 characters with truncation)
   */
  private formatTitle(title: string): string {
    return this.truncateString(title, 24);
  }

  /**
   * Format size column (8 characters, right-aligned)
   */
  private formatSize(size: string): string {
    return size.padStart(8);
  }

  /**
   * Format access level column
   */
  private formatAccessLevel(accessLevel: string): string {
    return accessLevel;
  }

  /**
   * Get empty state message for different scenarios
   * Implements Requirements: 1.3, 2.3
   */
  private getEmptyStateMessage(filter?: string): string {
    if (filter && filter.trim()) {
      return 'No configurations found matching your filter';
    }
    return 'No configurations are available';
  }

  /**
   * Get message for no liked configurations
   * Implements Requirement: 5.3
   */
  private getNoLikedConfigurationsMessage(): string {
    return "You haven't liked any configurations yet";
  }

  /**
   * Get authentication required message
   * Implements Requirement: 6.2
   */
  private getAuthenticationRequiredMessage(): string {
    return "Authentication failed. Please run 'taptik login' first.";
  }

  /**
   * Get network error message
   * Implements Requirement: 6.1
   */
  private getNetworkErrorMessage(): string {
    return 'Unable to connect to Taptik cloud. Please check your internet connection.';
  }

  /**
   * Get server error message
   * Implements Requirement: 6.3
   */
  private getServerErrorMessage(): string {
    return 'Taptik cloud is temporarily unavailable. Please try again later.';
  }

  /**
   * Display pagination information
   * Implements Requirement: 4.5
   */
  private displayPaginationInfo(
    result: ConfigurationListResult,
    itemType: string,
  ): void {
    if (result.hasMore) {
      console.log(
        `\n💡 Showing ${result.configurations.length} of ${result.totalCount} ${itemType}`,
      );
      console.log('💡 Use --limit to see more results (max: 100)');
    } else if (result.configurations.length > 0 && result.totalCount > result.configurations.length) {
      console.log(
        `\n💡 Showing all ${result.configurations.length} ${itemType}`,
      );
    }
  }

  /**
   * Format date for table display (12 characters, consistent width)
   */
  private formatDate(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    let dateStr: string;

    if (diffDays === 0) {
      dateStr = 'Today';
    } else if (diffDays === 1) {
      dateStr = 'Yesterday';
    } else if (diffDays < 7) {
      dateStr = `${diffDays} days ago`;
    } else if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      dateStr = `${weeks} week${weeks > 1 ? 's' : ''} ago`;
    } else if (diffDays < 365) {
      dateStr = date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    } else {
      dateStr = date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: '2-digit',
      });
    }

    // Ensure consistent width of 12 characters
    return dateStr.padEnd(12);
  }

  /**
   * Truncate string to specified length with ellipsis
   */
  private truncateString(str: string, maxLength: number): string {
    if (str.length <= maxLength) {
      return str.padEnd(maxLength);
    }
    return `${str.substring(0, maxLength - 3)}...`;
  }

  /**
   * Pad string to specified length
   */
  private padString(str: string, length: number): string {
    return str.padEnd(length);
  }

  /**
   * Handle errors with specific error messages
   * Implements Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
   */
  private async handleError(error: unknown): Promise<void> {
    if (error instanceof Error) {
      // Check for specific error types and provide appropriate messages
      if (
        error.message.includes('network') ||
        error.message.includes('connect')
      ) {
        console.error(`❌ ${this.getNetworkErrorMessage()}`);
      } else if (
        error.message.includes('authentication') ||
        error.message.includes('unauthorized')
      ) {
        console.error(`❌ ${this.getAuthenticationRequiredMessage()}`);
      } else if (
        error.message.includes('server') ||
        error.message.includes('500')
      ) {
        console.error(`❌ ${this.getServerErrorMessage()}`);
      } else if (error.message.includes('Invalid')) {
        // Validation errors
        console.error(`❌ ${error.message}`);
        console.error('💡 Use "taptik list --help" for valid options');
      } else {
        // Generic error
        console.error(`❌ ${error.message}`);
      }
    } else {
      console.error('❌ An unknown error occurred');
    }

    process.exit(1);
  }

  @Option({
    flags: '--filter <query>',
    description: 'Filter configurations by title',
  })
  parseFilter(value: string): string {
    return value;
  }

  @Option({
    flags: '--sort <field>',
    description: 'Sort by date or name (default: date)',
  })
  parseSort(value: string): 'date' | 'name' {
    if (!['date', 'name'].includes(value)) {
      throw new Error(
        `Invalid sort option '${value}'. Valid options: date, name`,
      );
    }
    return value as 'date' | 'name';
  }

  @Option({
    flags: '--limit <n>',
    description: 'Limit results (default: 20, max: 100)',
  })
  parseLimit(value: string): number {
    const limit = parseInt(value, 10);
    if (isNaN(limit) || limit <= 0) {
      throw new Error('Limit must be greater than 0');
    }
    if (limit > 100) {
      throw new Error('Limit cannot exceed 100');
    }
    return limit;
  }
}
