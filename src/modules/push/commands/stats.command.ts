import { Logger } from '@nestjs/common';

import chalk from 'chalk';
import Table from 'cli-table3';
import { Command, CommandRunner, Option } from 'nest-commander';

import { AuthService } from '../../auth/auth.service';
import { AnalyticsService } from '../services/analytics.service';
import { PackageRegistryService } from '../services/package-registry.service';

interface StatsCommandOptions {
  format?: 'table' | 'json' | 'simple';
  detailed?: boolean;
}

@Command({
  name: 'stats',
  arguments: '<config-id>',
  description: 'View download and usage statistics for a package',
})
export class StatsCommand extends CommandRunner {
  private readonly logger = new Logger(StatsCommand.name);

  constructor(
    private readonly authService: AuthService,
    private readonly packageRegistry: PackageRegistryService,
    private readonly analyticsService: AnalyticsService,
  ) {
    super();
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

  @Option({
    flags: '--detailed',
    description: 'Show detailed analytics including trends',
  })
  parseDetailed(): boolean {
    return true;
  }

  async run(inputs: string[], options: StatsCommandOptions): Promise<void> {
    try {
      const configId = inputs[0];

      if (!configId) {
        this.logger.error('Please provide a configuration ID');
        console.log(chalk.gray('\nUsage: taptik stats <config-id> [options]'));
        process.exit(1);
      }

      // Check authentication
      const session = await this.authService.getSession();
      if (!session?.user) {
        this.logger.error(
          'Authentication required. Please run "taptik auth login" first.',
        );
        process.exit(1);
      }

      // Fetch package
      const packageData =
        await this.packageRegistry.getPackageByConfigId(configId);

      if (!packageData) {
        this.logger.error(`Package with ID ${configId} not found`);
        process.exit(1);
      }

      // Check ownership or public access
      if (packageData.userId !== session.user.id && !packageData.isPublic) {
        this.logger.error(
          'You do not have permission to view stats for this package',
        );
        process.exit(1);
      }

      // Fetch statistics
      const stats = await this.packageRegistry.getPackageStats(configId);

      // Fetch detailed analytics if requested
      let analytics = null;
      if (options.detailed) {
        analytics = await this.analyticsService.getPackageAnalytics(configId);
      }

      // Prepare data
      const statsData = {
        package: {
          title: packageData.title || packageData.name,
          configId: packageData.configId,
          platform: packageData.platform,
          version: packageData.version,
          visibility: packageData.isPublic ? 'public' : 'private',
          created: packageData.createdAt,
          updated: packageData.updatedAt,
        },
        statistics: {
          downloads: stats.downloadCount,
          likes: stats.likeCount,
          views: stats.viewCount,
          lastDownloaded: stats.lastDownloaded,
        },
        analytics: analytics || undefined,
      };

      // Display based on format
      switch (options.format) {
        case 'json':
          console.log(JSON.stringify(statsData, null, 2));
          break;

        case 'simple':
          this.displaySimpleFormat(statsData);
          break;

        case 'table':
        default:
          this.displayTableFormat(statsData, options.detailed);
          break;
      }

      // Show insights
      if (options.format !== 'json') {
        this.displayInsights(statsData);
      }
    } catch (error) {
      this.logger.error(`Failed to fetch statistics: ${error.message}`);

      if (error.message.includes('not found')) {
        console.log(
          chalk.gray('\nTip: Use "taptik list --cloud" to see your packages'),
        );
      }

      process.exit(1);
    }
  }

  private displayTableFormat(
    data: {
      package: {
        title: string;
        configId: string;
        platform: string;
        version: string;
        visibility: string;
        created: Date | string;
      };
      statistics: {
        downloads: number;
        views: number;
        likes: number;
        lastDownloaded?: Date | string;
      };
      analytics?: {
        downloads?: { total: number; dailyAverage: number; trend: number };
        views?: { total: number; dailyAverage: number; trend: number };
        geographic?: Array<{
          country: string;
          count: number;
          percentage: number;
        }>;
      };
    },
    detailed: boolean,
  ): void {
    // Package info table
    console.log(chalk.cyan('\n📦 Package Information'));
    const infoTable = new Table({
      style: { head: [], border: [] },
    });

    infoTable.push(
      ['Title', chalk.bold(data.package.title)],
      ['ID', chalk.gray(data.package.configId)],
      ['Platform', chalk.gray(data.package.platform)],
      ['Version', chalk.gray(data.package.version)],
      [
        'Visibility',
        data.package.visibility === 'public'
          ? chalk.green('public')
          : chalk.yellow('private'),
      ],
      ['Created', chalk.gray(this.formatDate(data.package.created))],
    );

    console.log(infoTable.toString());

    // Statistics table
    console.log(chalk.cyan('\n📊 Statistics'));
    const statsTable = new Table({
      style: { head: [], border: [] },
    });

    statsTable.push(
      ['Downloads', chalk.bold(data.statistics.downloads.toString())],
      ['Views', chalk.bold(data.statistics.views.toString())],
      ['Likes', chalk.bold(data.statistics.likes.toString())],
      [
        'Last Downloaded',
        data.statistics.lastDownloaded
          ? chalk.gray(this.formatDate(data.statistics.lastDownloaded))
          : chalk.gray('Never'),
      ],
    );

    console.log(statsTable.toString());

    // Detailed analytics
    if (detailed && data.analytics) {
      console.log(chalk.cyan('\n📈 Analytics (Last 30 Days)'));
      const analyticsTable = new Table({
        head: [
          chalk.cyan('Metric'),
          chalk.cyan('Total'),
          chalk.cyan('Daily Avg'),
          chalk.cyan('Trend'),
        ],
        style: { head: [], border: [] },
      });

      if (data.analytics.downloads) {
        analyticsTable.push([
          'Downloads',
          data.analytics.downloads.total,
          data.analytics.downloads.dailyAverage.toFixed(1),
          this.formatTrend(data.analytics.downloads.trend),
        ]);
      }

      if (data.analytics.views) {
        analyticsTable.push([
          'Views',
          data.analytics.views.total,
          data.analytics.views.dailyAverage.toFixed(1),
          this.formatTrend(data.analytics.views.trend),
        ]);
      }

      console.log(analyticsTable.toString());

      // Geographic distribution
      if (data.analytics.geographic && data.analytics.geographic.length > 0) {
        console.log(chalk.cyan('\n🌍 Geographic Distribution'));
        const geoTable = new Table({
          head: [
            chalk.cyan('Country'),
            chalk.cyan('Downloads'),
            chalk.cyan('Percentage'),
          ],
          style: { head: [], border: [] },
        });

        data.analytics.geographic.slice(0, 5).forEach((geo) => {
          geoTable.push([
            geo.country,
            geo.count.toString(),
            `${geo.percentage.toFixed(1)}%`,
          ]);
        });

        console.log(geoTable.toString());
      }
    }
  }

  private displaySimpleFormat(data: {
    package: { title: string; configId: string };
    statistics: {
      downloads: number;
      views: number;
      likes: number;
      lastDownloaded?: Date | string;
    };
  }): void {
    console.log(chalk.cyan(`\n📦 ${chalk.bold(data.package.title)}`));
    console.log(chalk.gray(`   ${data.package.configId}`));
    console.log();
    console.log(`   Downloads: ${chalk.bold(data.statistics.downloads)}`);
    console.log(`   Views: ${chalk.bold(data.statistics.views)}`);
    console.log(`   Likes: ${chalk.bold(data.statistics.likes)}`);

    if (data.statistics.lastDownloaded) {
      console.log(
        `   Last download: ${chalk.gray(this.formatRelativeTime(data.statistics.lastDownloaded))}`,
      );
    }
  }

  private displayInsights(data: {
    statistics: {
      downloads: number;
      views: number;
      likes: number;
      lastDownloaded?: Date | string;
    };
    package: { visibility: string };
  }): void {
    console.log(chalk.cyan('\n💡 Insights'));

    // Engagement rate
    if (data.statistics.views > 0) {
      const conversionRate = (
        (data.statistics.downloads / data.statistics.views) *
        100
      ).toFixed(1);
      console.log(
        `  • Conversion rate: ${chalk.bold(`${conversionRate}%`)} (downloads/views)`,
      );
    }

    // Like rate
    if (data.statistics.downloads > 0) {
      const likeRate = (
        (data.statistics.likes / data.statistics.downloads) *
        100
      ).toFixed(1);
      console.log(
        `  • Like rate: ${chalk.bold(`${likeRate}%`)} (likes/downloads)`,
      );
    }

    // Activity status
    if (data.statistics.lastDownloaded) {
      const daysSinceLastDownload = Math.floor(
        (Date.now() - new Date(data.statistics.lastDownloaded).getTime()) /
          (1000 * 60 * 60 * 24),
      );

      if (daysSinceLastDownload === 0) {
        console.log(`  • Status: ${chalk.green('Active')} (downloaded today)`);
      } else if (daysSinceLastDownload < 7) {
        console.log(
          `  • Status: ${chalk.green('Active')} (downloaded this week)`,
        );
      } else if (daysSinceLastDownload < 30) {
        console.log(
          `  • Status: ${chalk.yellow('Moderate')} (downloaded this month)`,
        );
      } else {
        console.log(
          `  • Status: ${chalk.red('Inactive')} (${daysSinceLastDownload} days since last download)`,
        );
      }
    } else {
      console.log(`  • Status: ${chalk.gray('No downloads yet')}`);
    }

    // Recommendations
    if (
      data.statistics.downloads === 0 &&
      data.package.visibility === 'private'
    ) {
      console.log(
        chalk.gray(
          '\n💡 Tip: Consider making your package public to increase visibility',
        ),
      );
    }

    if (data.statistics.likes === 0 && data.statistics.downloads > 10) {
      console.log(
        chalk.gray(
          '\n💡 Tip: Encourage users to like your package if they find it useful',
        ),
      );
    }
  }

  private formatDate(date: Date | string): string {
    const d = new Date(date);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
  }

  private formatRelativeTime(date: Date | string): string {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      if (diffHours === 0) {
        const diffMins = Math.floor(diffMs / (1000 * 60));
        return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
      }
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else if (diffDays === 1) {
      return 'yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return `${weeks} week${weeks !== 1 ? 's' : ''} ago`;
    } else {
      return d.toLocaleDateString();
    }
  }

  private formatTrend(trend: number): string {
    if (trend > 0) {
      return chalk.green(`↑ ${trend.toFixed(1)}%`);
    } else if (trend < 0) {
      return chalk.red(`↓ ${Math.abs(trend).toFixed(1)}%`);
    } else {
      return chalk.gray('→ 0%');
    }
  }
}
