import { Logger } from '@nestjs/common';

import chalk from 'chalk';
import inquirer from 'inquirer';
import { Command, CommandRunner, Option } from 'nest-commander';

import { AuthService } from '../../auth/auth.service';
import { PackageRegistryService } from '../services/package-registry.service';

interface UpdateCommandOptions {
  title?: string;
  description?: string;
  tags?: string;
  yes?: boolean;
}

@Command({
  name: 'update',
  arguments: '<config-id>',
  description: 'Update metadata for an uploaded package',
})
export class UpdateCommand extends CommandRunner {
  private readonly logger = new Logger(UpdateCommand.name);

  constructor(
    private readonly authService: AuthService,
    private readonly packageRegistry: PackageRegistryService,
  ) {
    super();
  }

  @Option({
    flags: '--title <title>',
    description: 'New title for the package',
  })
  parseTitle(value: string): string {
    return value;
  }

  @Option({
    flags: '--description <description>',
    description: 'New description for the package',
  })
  parseDescription(value: string): string {
    return value;
  }

  @Option({
    flags: '--tags <tags>',
    description: 'New tags (comma-separated)',
  })
  parseTags(value: string): string {
    return value;
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
    options: UpdateCommandOptions,
  ): Promise<void> {
    try {
      const configId = inputs[0];
      
      if (!configId) {
        this.logger.error('Please provide a configuration ID');
        console.log(chalk.gray('\nUsage: taptik update <config-id> [options]'));
        process.exit(1);
      }

      // Check authentication
      const session = await this.authService.getSession();
      if (!session?.user) {
        this.logger.error('Authentication required. Please run "taptik auth login" first.');
        process.exit(1);
      }

      // Fetch existing package
      const existingPackage = await this.packageRegistry.getPackageByConfigId(configId);
      
      if (!existingPackage) {
        this.logger.error(`Package with ID ${configId} not found`);
        process.exit(1);
      }

      // Check ownership
      if (existingPackage.userId !== session.user.id) {
        this.logger.error('You do not have permission to update this package');
        process.exit(1);
      }

      // Prepare updates
      const updates: { title?: string; description?: string; userTags?: string[]; } = {};
      let hasUpdates = false;

      if (options.title && options.title !== existingPackage.title) {
        updates.title = options.title;
        hasUpdates = true;
      }

      if (options.description && options.description !== existingPackage.description) {
        updates.description = options.description;
        hasUpdates = true;
      }

      if (options.tags) {
        const newTags = options.tags.split(',').map(t => t.trim()).filter(Boolean);
        if (JSON.stringify(newTags) !== JSON.stringify(existingPackage.userTags)) {
          updates.userTags = newTags;
          hasUpdates = true;
        }
      }

      if (!hasUpdates) {
        // Interactive mode if no options provided
        const answers = await this.promptForUpdates(existingPackage);
        
        if (answers.title && answers.title !== existingPackage.title) {
          updates.title = answers.title;
          hasUpdates = true;
        }
        
        if (answers.description && answers.description !== existingPackage.description) {
          updates.description = answers.description;
          hasUpdates = true;
        }
        
        if (answers.tags) {
          const newTags = answers.tags.split(',').map(t => t.trim()).filter(Boolean);
          if (JSON.stringify(newTags) !== JSON.stringify(existingPackage.userTags)) {
            updates.userTags = newTags;
            hasUpdates = true;
          }
        }
      }

      if (!hasUpdates) {
        console.log(chalk.yellow('No changes to apply'));
        return;
      }

      // Show changes
      console.log(chalk.cyan('\nChanges to apply:'));
      if (updates.title) {
        console.log(`  Title: ${chalk.gray(existingPackage.title)} → ${chalk.green(updates.title)}`);
      }
      if (updates.description) {
        console.log(`  Description: ${chalk.gray(existingPackage.description || '(none)')} → ${chalk.green(updates.description)}`);
      }
      if (updates.userTags) {
        console.log(`  Tags: ${chalk.gray(existingPackage.userTags?.join(', ') || '(none)')} → ${chalk.green(updates.userTags.join(', '))}`);
      }

      // Confirm updates
      if (!options.yes) {
        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: 'Apply these changes?',
            default: true,
          },
        ]);

        if (!confirm) {
          console.log(chalk.gray('Update cancelled'));
          return;
        }
      }

      // Apply updates
      console.log(chalk.gray('\nUpdating package...'));
      const updatedPackage = await this.packageRegistry.updatePackage(configId, updates);

      console.log(chalk.green('✅ Package updated successfully!'));
      console.log(chalk.gray(`\nConfiguration ID: ${updatedPackage.configId}`));
      
      if (updatedPackage.isPublic) {
        console.log(chalk.gray(`Share URL: https://taptik.com/packages/${updatedPackage.configId}`));
      }
    } catch (error) {
      this.logger.error(`Failed to update package: ${error.message}`);
      
      if (error.message.includes('not found')) {
        console.log(chalk.gray('\nTip: Use "taptik list --cloud" to see your packages'));
      }
      
      process.exit(1);
    }
  }

  private async promptForUpdates(existingPackage: { title: string; description?: string; userTags?: string[]; }): Promise<{ title?: string; description?: string; tags?: string; }> {
    console.log(chalk.cyan('\nCurrent package information:'));
    console.log(`  Title: ${chalk.gray(existingPackage.title)}`);
    console.log(`  Description: ${chalk.gray(existingPackage.description || '(none)')}`);
    console.log(`  Tags: ${chalk.gray(existingPackage.userTags?.join(', ') || '(none)')}`);
    console.log();

    return inquirer.prompt([
      {
        type: 'input',
        name: 'title',
        message: 'New title (leave blank to keep current):',
        default: existingPackage.title,
      },
      {
        type: 'input',
        name: 'description',
        message: 'New description (leave blank to keep current):',
        default: existingPackage.description || '',
      },
      {
        type: 'input',
        name: 'tags',
        message: 'New tags (comma-separated, leave blank to keep current):',
        default: existingPackage.userTags?.join(', ') || '',
      },
    ]);
  }
}