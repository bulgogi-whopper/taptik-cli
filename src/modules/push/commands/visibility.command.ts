import { Logger } from '@nestjs/common';

import chalk from 'chalk';
import inquirer from 'inquirer';
import { Command, CommandRunner, Option } from 'nest-commander';

import { AuthService } from '../../auth/auth.service';
import { PackageRegistryService } from '../services/package-registry.service';

interface VisibilityCommandOptions {
  public?: boolean;
  private?: boolean;
  yes?: boolean;
}

@Command({
  name: 'visibility',
  arguments: '<config-id>',
  description: 'Change the visibility of an uploaded package',
})
export class VisibilityCommand extends CommandRunner {
  private readonly logger = new Logger(VisibilityCommand.name);

  constructor(
    private readonly authService: AuthService,
    private readonly packageRegistry: PackageRegistryService,
  ) {
    super();
  }

  @Option({
    flags: '--public',
    description: 'Make the package publicly accessible',
  })
  parsePublic(): boolean {
    return true;
  }

  @Option({
    flags: '--private',
    description: 'Make the package private',
  })
  parsePrivate(): boolean {
    return true;
  }

  @Option({
    flags: '-y, --yes',
    description: 'Skip confirmation prompt',
  })
  parseYes(): boolean {
    return true;
  }

  async run(
    inputs: string[],
    options: VisibilityCommandOptions,
  ): Promise<void> {
    try {
      const configId = inputs[0];
      
      if (!configId) {
        this.logger.error('Please provide a configuration ID');
        console.log(chalk.gray('\nUsage: taptik visibility <config-id> [--public|--private]'));
        process.exit(1);
      }

      // Check that only one visibility option is set
      if (options.public && options.private) {
        this.logger.error('Please specify either --public or --private, not both');
        process.exit(1);
      }

      if (!options.public && !options.private) {
        this.logger.error('Please specify either --public or --private');
        console.log(chalk.gray('\nUsage: taptik visibility <config-id> [--public|--private]'));
        process.exit(1);
      }

      // Check authentication
      const session = await this.authService.getSession();
      if (!session?.user) {
        this.logger.error('Authentication required. Please run "taptik auth login" first.');
        process.exit(1);
      }

      // Fetch package
      const packageData = await this.packageRegistry.getPackageByConfigId(configId);
      
      if (!packageData) {
        this.logger.error(`Package with ID ${configId} not found`);
        process.exit(1);
      }

      // Check ownership
      if (packageData.userId !== session.user.id) {
        this.logger.error('You do not have permission to modify this package');
        process.exit(1);
      }

      const makePublic = options.public === true;
      const currentVisibility = packageData.isPublic ? 'public' : 'private';
      const newVisibility = makePublic ? 'public' : 'private';

      // Check if already has desired visibility
      if (packageData.isPublic === makePublic) {
        console.log(chalk.yellow(`Package is already ${newVisibility}`));
        return;
      }

      // Show package information
      console.log(chalk.cyan('\nPackage information:'));
      console.log(`  Title: ${chalk.bold(packageData.title || packageData.name)}`);
      console.log(`  ID: ${chalk.gray(packageData.configId)}`);
      console.log(`  Current visibility: ${packageData.isPublic ? chalk.green('public') : chalk.yellow('private')}`);
      console.log(`  New visibility: ${makePublic ? chalk.green('public') : chalk.yellow('private')}`);

      // Show warnings
      if (makePublic) {
        console.log(chalk.yellow('\n⚠️  Making this package public will:'));
        console.log(chalk.yellow('  • Allow anyone to download and use it'));
        console.log(chalk.yellow('  • Make it searchable in the public registry'));
        console.log(chalk.yellow('  • Generate a public share URL'));
      } else {
        console.log(chalk.yellow('\n⚠️  Making this package private will:'));
        console.log(chalk.yellow('  • Restrict access to only you'));
        console.log(chalk.yellow('  • Remove it from public search results'));
        console.log(chalk.yellow('  • Invalidate any shared URLs'));
        
        if (packageData.isPublic) {
          console.log(chalk.red('  • Break any existing integrations using this package'));
        }
      }

      // Confirm change
      if (!options.yes) {
        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: `Change visibility from ${currentVisibility} to ${newVisibility}?`,
            default: true,
          },
        ]);

        if (!confirm) {
          console.log(chalk.gray('Visibility change cancelled'));
          return;
        }
      }

      // Update visibility
      console.log(chalk.gray('\nUpdating visibility...'));
      const updatedPackage = await this.packageRegistry.updatePackageVisibility(
        configId,
        makePublic,
      );

      console.log(chalk.green('✅ Visibility updated successfully!'));
      console.log(`\nPackage is now ${makePublic ? chalk.green('public') : chalk.yellow('private')}`);
      
      if (makePublic) {
        console.log(chalk.gray(`\nShare URL: https://taptik.com/packages/${updatedPackage.configId}`));
        console.log(chalk.gray('Anyone with this URL can download your package'));
      } else {
        console.log(chalk.gray('\nThis package is now private and only accessible to you'));
      }
    } catch (error) {
      this.logger.error(`Failed to update visibility: ${error.message}`);
      
      if (error.message.includes('not found')) {
        console.log(chalk.gray('\nTip: Use "taptik list --cloud" to see your packages'));
      }
      
      process.exit(1);
    }
  }
}