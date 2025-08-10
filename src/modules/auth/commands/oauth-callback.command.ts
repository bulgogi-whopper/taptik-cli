import { Injectable } from '@nestjs/common';

import { input } from '@inquirer/prompts';
import { Command, CommandRunner, Option } from 'nest-commander';

import { AuthService } from '../auth.service';

interface OAuthCallbackOptions {
  url?: string;
}

@Injectable()
@Command({
  name: 'oauth-callback',
  description: 'Process OAuth callback URL after authentication',
})
export class OAuthCallbackCommand extends CommandRunner {
  constructor(private readonly authService: AuthService) {
    super();
  }

  async run(
    _passedParameters: string[],
    options?: OAuthCallbackOptions,
  ): Promise<void> {
    console.log('🔗 OAuth Callback Processor');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      // Get callback URL either from flag or prompt
      let callbackUrl: string;
      const { url: optionUrl } = options || {};

      if (optionUrl) {
        callbackUrl = optionUrl;
        console.log('\n✅ Using provided callback URL');
      } else {
        console.log('\n📋 Please paste the callback URL from your browser:');
        console.log(
          '💡 After completing OAuth authentication, copy the URL from your browser',
        );
        console.log('   Example: http://localhost:3000/#access_token=...');

        callbackUrl = await input({
          message: 'Callback URL:',
          validate: (input: string) => {
            if (!input.trim()) {
              return 'Please provide a valid callback URL';
            }
            if (!input.includes('access_token=')) {
              return 'URL must contain access_token parameter';
            }
            return true;
          },
        });
      }

      // Process the callback URL
      console.log('\n🔄 Processing OAuth callback...');
      const result =
        await this.authService.processOAuthCallbackUrl(callbackUrl);

      if (!result.success || !result.session) {
        console.error('\n❌ OAuth callback processing failed!');
        console.error(`Error: ${result.error?.message || 'Unknown error'}`);
        if (result.error?.suggestions) {
          console.log('\n💡 Suggestions:');
          result.error.suggestions.forEach(suggestion => {
            console.log(`  • ${suggestion}`);
          });
        }
        process.exit(1);
      }

      const {session} = result;
      // Success
      console.log('\n🎉 OAuth authentication completed successfully!');
      console.log(`👤 Logged in as: ${session.user.email}`);
      console.log(`🆔 User ID: ${session.user.id}`);

      if (session.user.fullName) {
        console.log(`👋 Welcome, ${session.user.fullName}!`);
      }

      console.log(
        `\n🔑 Session expires at: ${session.expiresAt.toLocaleString()}`,
      );
      console.log('\n💡 Tip: Use "taptik logout" to sign out when done');
    } catch (error) {
      console.error('\n❌ OAuth callback processing failed:');
      if (error instanceof Error) {
        console.error(error.message);

        // Provide helpful error messages
        if (error.message.includes('access_token')) {
          console.error(
            '\n💡 Make sure the URL contains the access_token parameter from OAuth redirect',
          );
        } else if (error.message.includes('session')) {
          console.error('\n💡 The callback URL might be expired or invalid');
        }
      } else {
        console.error('An unknown error occurred');
      }

      throw new Error('OAuth callback processing failed');
    }
  }

  @Option({
    flags: '-u, --url <url>',
    description: 'OAuth callback URL with access token',
  })
  parseUrl(value: string): string {
    return value;
  }
}
