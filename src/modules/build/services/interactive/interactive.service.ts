import { Injectable } from '@nestjs/common';

import { select, checkbox } from '@inquirer/prompts';

import { BuildCategory, BuildPlatform, BuildCategoryName } from '../../interfaces/build-config.interface';

/**
 * Service for handling interactive user input during the build process
 */
@Injectable()
export class InteractiveService {
  private readonly TIMEOUT_MS = 30_000; // 30 seconds

  /**
   * Prompts user to select a platform for the build
   * @returns Promise resolving to the selected platform
   * @throws Error if timeout occurs or invalid selection
   */
  async selectPlatform(): Promise<BuildPlatform> {
    const platform = await select<BuildPlatform>({
      message: '🚀 Select a platform for your Taptik build:',
      choices: [
        {
          name: 'Kiro (Ready)',
          value: BuildPlatform.KIRO,
          description: 'Build from Kiro settings - fully supported'
        },
        {
          name: 'Cursor (Coming soon)',
          value: BuildPlatform.CURSOR,
          description: 'Cursor integration is in development',
          disabled: '(Coming soon)'
        },
        {
          name: 'Claude Code (Coming soon)',
          value: BuildPlatform.CLAUDE_CODE, 
          description: 'Claude Code integration is in development',
          disabled: '(Coming soon)'
        }
      ],
      default: BuildPlatform.KIRO
    });

    return platform;
  }

  /**
   * Prompts user to select categories to include in the build
   * Uses multi-select interface with spacebar toggle and 'a' key for toggle all
   * @returns Promise resolving to array of selected categories
   * @throws Error if timeout occurs or no categories selected
   */
  async selectCategories(): Promise<BuildCategory[]> {
    const selectedCategoryNames = await checkbox<BuildCategoryName>({
      message: '📁 Select categories to include in your build:',
      instructions: 'Use spacebar to select, arrow keys to navigate, \'a\' to toggle all, enter to confirm',
      choices: [
        {
          name: 'Personal Context',
          value: BuildCategoryName.PERSONAL_CONTEXT,
          description: 'User preferences, work style, and communication settings'
        },
        {
          name: 'Project Context', 
          value: BuildCategoryName.PROJECT_CONTEXT,
          description: 'Project information, technical stack, and development guidelines'
        },
        {
          name: 'Prompt Templates',
          value: BuildCategoryName.PROMPT_TEMPLATES,
          description: 'Reusable prompt templates for AI interactions'
        }
      ],
      required: true,
      validate: (choices) => {
        if (choices.length === 0) {
          return 'At least one category must be selected.';
        }
        return true;
      }
    });

    return selectedCategoryNames.map(name => ({
      name,
      enabled: true
    }));
  }

}