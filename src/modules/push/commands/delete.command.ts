import { Logger } from '@nestjs/common';

import chalk from 'chalk';
import inquirer from 'inquirer';
import { Command, CommandRunner, Option } from 'nest-commander';

import { AuthService } from '../../auth/auth.service';
import { PackageRegistryService } from '../services/package-registry.service';

interface DeleteCommandOptions {
  yes?: boolean;
  force?: boolean;
}

@Command({
  name: 'delete',
  arguments: '<config-id>',
  description: 'Delete an uploaded package from the cloud',
})
export class DeleteCommand extends CommandRunner {
  private readonly logger = new Logger(DeleteCommand.name);

  constructor(
    private readonly authService: AuthService,
    private readonly packageRegistry: PackageRegistryService,
  ) {
    super();
  }

  @Option({
    flags: '-y, --yes',
    description: 'Skip confirmation prompt',
  })
  parseYes(): boolean {
    return true;
  }

  @Option({
    flags: '-f, --force',
    description: 'Force delete without any prompts',
  })
  parseForce(): boolean {
    return true;
  }

  async run(inputs: string[], options: DeleteCommandOptions): Promise<void> {
    try {
      const configId = inputs[0];

      if (!configId) {
        this.logger.error('Please provide a configuration ID');
        console.log(chalk.gray('\nUsage: taptik delete <config-id> [options]'));
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

      // Fetch package to delete
      const packageToDelete =
        await this.packageRegistry.getPackageByConfigId(configId);

      if (!packageToDelete) {
        this.logger.error(`Package with ID ${configId} not found`);
        process.exit(1);
      }

      // Check ownership
      if (packageToDelete.userId !== session.user.id) {
        this.logger.error('You do not have permission to delete this package');
        process.exit(1);
      }

      // Show package information
      if (!options.force) {
        console.log(chalk.cyan('\nPackage to delete:'));
        console.log(
          `  Title: ${chalk.bold(packageToDelete.title || packageToDelete.name)}`,
        );
        console.log(`  ID: ${chalk.gray(packageToDelete.configId)}`);
        console.log(`  Platform: ${chalk.gray(packageToDelete.platform)}`);
        console.log(`  Version: ${chalk.gray(packageToDelete.version)}`);
        console.log(
          `  Visibility: ${packageToDelete.isPublic ? chalk.green('public') : chalk.yellow('private')}`,
        );
        console.log(
          `  Created: ${chalk.gray(this.formatDate(packageToDelete.createdAt))}`,
        );

        if (packageToDelete.isPublic) {
          console.log(
            chalk.yellow(
              '\n⚠️  This is a public package that may be used by others',
            ),
          );
        }
      }

      // Confirm deletion
      if (!options.yes && !options.force) {
        const { confirmText } = await inquirer.prompt([
          {
            type: 'input',
            name: 'confirmText',
            message: `Type "${chalk.red('DELETE')}" to confirm deletion:`,
            validate: (input) => {
              if (input !== 'DELETE') {
                return 'Please type DELETE to confirm';
              }
              return true;
            },
          },
        ]);

        if (confirmText !== 'DELETE') {
          console.log(chalk.gray('Deletion cancelled'));
          return;
        }
      } else if (options.yes && !options.force) {
        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: 'Are you sure you want to delete this package?',
            default: false,
          },
        ]);

        if (!confirm) {
          console.log(chalk.gray('Deletion cancelled'));
          return;
        }
      }

      // Delete package
      console.log(chalk.gray('\nDeleting package...'));
      await this.packageRegistry.deletePackage(configId);

      console.log(chalk.green('✅ Package deleted successfully!'));
      console.log(
        chalk.gray(`\nPackage ${configId} has been permanently removed`),
      );

      // Suggest next action
      console.log(
        chalk.gray(
          '\nTip: Use "taptik list --cloud" to see your remaining packages',
        ),
      );
    } catch (error) {
      this.logger.error(`Failed to delete package: ${error.message}`);

      if (error.message.includes('not found')) {
        console.log(
          chalk.gray('\nTip: Use "taptik list --cloud" to see your packages'),
        );
      }

      process.exit(1);
    }
  }

  private formatDate(date: Date | string): string {
    const d = new Date(date);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
  }
}
