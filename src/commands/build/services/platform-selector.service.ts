import { Injectable } from '@nestjs/common';

import { select } from '@inquirer/prompts';
import chalk from 'chalk';

import { PlatformSelectorService, SupportedPlatform } from '../interfaces';

@Injectable()
export class PlatformSelectorServiceImpl implements PlatformSelectorService {
  async selectPlatform(): Promise<SupportedPlatform> {
    console.log(chalk.blue('\n🔧 Platform Selection'));
    console.log(chalk.gray('Select the AI IDE platform you want to build from:\n'));

    const platform = await select({
      message: 'Choose your source platform:',
      choices: [
        {
          name: '🎯 Kiro - AI IDE (Supported)',
          value: SupportedPlatform.KIRO,
          description: 'Build from Kiro AI IDE settings'
        },
        {
          name: '🚧 Cursor - AI Code Editor (Coming Soon)',
          value: SupportedPlatform.CURSOR,
          description: 'Support for Cursor will be available in a future release'
        },
        {
          name: '🚧 Claude Code - AI Development Environment (Coming Soon)',
          value: SupportedPlatform.CLAUDE_CODE,
          description: 'Support for Claude Code will be available in a future release'
        }
      ]
    });

    // Handle unsupported platforms
    if (platform === SupportedPlatform.CURSOR) {
      console.log(chalk.yellow('\n🚧 Coming Soon!'));
      console.log(chalk.gray('Cursor support is currently under development.'));
      console.log(chalk.gray('We\'re working hard to bring you this feature in an upcoming release.'));
      console.log(chalk.gray('\nFor now, please use Kiro as your source platform.'));
      throw new Error('Cursor platform is not yet supported');
    }

    if (platform === SupportedPlatform.CLAUDE_CODE) {
      console.log(chalk.yellow('\n🚧 Coming Soon!'));
      console.log(chalk.gray('Claude Code support is currently under development.'));
      console.log(chalk.gray('We\'re working hard to bring you this feature in an upcoming release.'));
      console.log(chalk.gray('\nFor now, please use Kiro as your source platform.'));
      throw new Error('Claude Code platform is not yet supported');
    }

    console.log(chalk.green(`\n✅ Selected platform: ${platform}`));
    return platform;
  }
}