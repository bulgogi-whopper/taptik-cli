import { Injectable } from '@nestjs/common';

import { Command, CommandRunner } from 'nest-commander';

import { AuthService } from '../auth.service';

@Injectable()
@Command({
  name: 'logout',
  description: 'Logout from Taptik CLI',
})
export class LogoutCommand extends CommandRunner {
  constructor(private readonly authService: AuthService) {
    super();
  }

  async run(): Promise<void> {
    console.log('🔐 Taptik CLI Logout');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      // Check if logged in
      const currentUser = await this.authService.getCurrentUser();

      if (!currentUser) {
        console.log('\n❌ You are not currently logged in');
        return;
      }

      console.log(`\n👤 Current user: ${currentUser.email}`);
      console.log('🔄 Logging out...');

      // Perform logout
      await this.authService.logout();

      console.log('\n✅ Successfully logged out!');
      console.log('👋 Goodbye!');
    } catch (error) {
      console.error('\n❌ Logout failed:');
      if (error instanceof Error) {
        console.error(error.message);
      } else {
        console.error('An unknown error occurred');
      }

      throw new Error('Logout failed');
    }
  }
}
