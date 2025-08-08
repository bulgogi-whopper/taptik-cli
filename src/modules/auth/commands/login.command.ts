import { Injectable } from '@nestjs/common';

import { select } from '@inquirer/prompts';
import { Command, CommandRunner, Option } from 'nest-commander';

import { AuthService } from '../auth.service';

interface LoginOptions {
  provider?: 'google' | 'github';
}

@Injectable()
@Command({
  name: 'login',
  description: 'Login to Taptik using OAuth (Google or GitHub)',
})
export class LoginCommand extends CommandRunner {
  constructor(private readonly authService: AuthService) {
    super();
  }

  async run(
    _passedParameters: string[],
    options?: LoginOptions,
  ): Promise<void> {
    console.log('🔐 Welcome to Taptik CLI OAuth Login');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      // Check if already logged in
      const currentUser = await this.authService.getCurrentUser();
      if (currentUser) {
        console.log(`\n✅ You are already logged in as: ${currentUser.email}`);
        const shouldContinue = await select({
          message: 'Do you want to login with a different account?',
          choices: [
            { name: 'Yes, login with different account', value: true },
            { name: 'No, keep current session', value: false },
          ],
        });

        if (!shouldContinue) {
          console.log('👋 Keeping current session');
          return;
        }

        // Logout current user
        console.log('🔄 Logging out current user...');
        await this.authService.logout();
      }

      // Get OAuth provider - either from flag or prompt
      let provider: 'google' | 'github';
      const { provider: optionProvider } = options || {};

      if (optionProvider) {
        provider = optionProvider;
        console.log(`\n🔗 Using provider: ${provider}`);
      } else {
        provider = await select({
          message: 'Choose your OAuth provider:',
          choices: [
            {
              name: 'Google',
              value: 'google' as const,
              description: 'Login with your Google account',
            },
            {
              name: 'GitHub',
              value: 'github' as const,
              description: 'Login with your GitHub account',
            },
          ],
        });
      }

      // Call the OAuth login method (this will open browser and handle callback automatically)
      const session = await this.authService.loginWithProvider(provider);

      console.log('\n✅ OAuth login successful!');
      console.log(`👤 Logged in as: ${session.user.email}`);
      console.log(`🆔 User ID: ${session.user.id}`);
      console.log(`🔗 Provider: ${provider}`);

      if (session.user.fullName) {
        console.log(`👋 Welcome back, ${session.user.fullName}!`);
      }

      console.log(
        `\n🔑 Session expires at: ${session.expiresAt.toLocaleString()}`,
      );
      console.log('\n💡 Tip: Use "taptik logout" to sign out when done');

      // Force process exit to ensure CLI terminates properly
      process.exit(0);
    } catch (error) {
      console.error('\n❌ OAuth login failed:');
      if (error instanceof Error) {
        console.error(error.message);

        // Provide helpful error messages for OAuth
        if (error.message.includes('Provider not supported')) {
          console.error(
            '\n💡 Please use --provider google or --provider github',
          );
        } else if (error.message.includes('OAuth configuration')) {
          console.error('\n💡 Please check your OAuth environment variables');
        } else if (error.message.includes('network')) {
          console.error(
            '\n💡 Please check your internet connection and try again',
          );
        }
      } else {
        console.error('An unknown error occurred');
      }

      throw new Error('OAuth login failed');
    }
  }

  @Option({
    flags: '-p, --provider <provider>',
    description: 'OAuth provider to use (google or github)',
  })
  parseProvider(value: string): 'google' | 'github' {
    if (value !== 'google' && value !== 'github') {
      throw new Error('Provider must be either "google" or "github"');
    }
    return value;
  }
}
