import { Injectable } from '@nestjs/common';

import { checkbox } from '@inquirer/prompts';
import chalk from 'chalk';

import { CategorySelectorService, BuildCategory } from '../interfaces';

@Injectable()
export class CategorySelectorServiceImpl implements CategorySelectorService {
  async selectCategories(): Promise<BuildCategory[]> {
    console.log(chalk.blue('\n📂 Category Selection'));
    console.log(chalk.gray('Select the configuration categories you want to include in your build:\n'));

    const categories = await checkbox({
      message: 'Choose categories to include:',
      choices: [
        {
          name: '👤 Personal Context - User preferences and profile settings',
          value: BuildCategory.PERSONAL_CONTEXT,
          checked: false
        },
        {
          name: '🏗️ Project Context - Project-specific settings and configurations',
          value: BuildCategory.PROJECT_CONTEXT,
          checked: false
        },
        {
          name: '💬 Prompt Templates - AI prompt templates and snippets',
          value: BuildCategory.PROMPT_TEMPLATES,
          checked: false
        }
      ],
      validate: (choices: readonly { value: BuildCategory }[]) => {
        if (choices.length === 0) {
          return 'Please select at least one category to continue.';
        }
        return true;
      }
    });

    // Handle empty selection (this shouldn't happen due to validation, but adding as safety)
    if (categories.length === 0) {
      console.log(chalk.yellow('\n⚠️  No Categories Selected'));
      console.log(chalk.gray('You must select at least one category to build your configuration bundle.'));
      console.log(chalk.gray('\nAvailable categories:'));
      console.log(chalk.gray('  • Personal Context - Your user preferences and profile settings'));
      console.log(chalk.gray('  • Project Context - Project-specific settings and configurations'));
      console.log(chalk.gray('  • Prompt Templates - AI prompt templates and code snippets'));
      console.log(chalk.gray('\nPlease run the command again and select at least one category.'));
      throw new Error('No categories selected. At least one category is required to proceed.');
    }

    console.log(chalk.green(`\n✅ Selected categories: ${categories.join(', ')}`));
    return categories;
  }
}