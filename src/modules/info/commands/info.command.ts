import { Command, CommandRunner } from 'nest-commander';

import { InfoService } from '../services/info.service';

@Command({
  name: 'info',
  description:
    'Display current authentication status and configuration information',
})
export class InfoCommand extends CommandRunner {
  constructor(private readonly infoService: InfoService) {
    super();
  }

  async run(): Promise<void> {
    console.log('📊 Taptik CLI Information');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      // Get all information
      const [accountInfo, toolInfo, sessionInfo, syncInfo] = await Promise.all([
        this.infoService.getAccountInfo(),
        this.infoService.getToolInfo(),
        this.infoService.getSessionInfo(),
        this.infoService.getSyncInfo(),
      ]);

      // Display account information
      console.log('\n👤 Account Information:');
      console.log(`   📧 Email: ${accountInfo.user.email}`);
      console.log(`   🆔 User ID: ${accountInfo.user.id}`);

      if (accountInfo.user.fullName) {
        console.log(`   👋 Name: ${accountInfo.user.fullName}`);
      }

      if (accountInfo.user.username) {
        console.log(`   🏷️  Username: ${accountInfo.user.username}`);
      }

      if (accountInfo.user.lastSignInAt) {
        console.log(
          `   🕐 Last Sign In: ${accountInfo.user.lastSignInAt.toLocaleString()}`,
        );
      }

      // Display tool information
      console.log('\n🛠️  Tool Information:');
      console.log(`   🔧 CLI Version: ${toolInfo.cliVersion}`);
      console.log(`   🟢 Node.js Version: ${toolInfo.nodeVersion}`);
      console.log(`   💻 Platform: ${toolInfo.platform}`);

      // Display session information
      if (sessionInfo) {
        console.log('\n🔐 Session Status:');
        console.log(
          `   ✅ Status: ${sessionInfo.isExpired ? '❌ Expired' : '🟢 Active'}`,
        );
        console.log(
          `   ⏰ Expires At: ${sessionInfo.expiresAt.toLocaleString()}`,
        );

        if (!sessionInfo.isExpired) {
          const hoursLeft = Math.floor(
            sessionInfo.timeUntilExpiry / (1000 * 60 * 60),
          );
          const minutesLeft = Math.floor(
            (sessionInfo.timeUntilExpiry % (1000 * 60 * 60)) / (1000 * 60),
          );
          console.log(`   ⏳ Time Left: ${hoursLeft}h ${minutesLeft}m`);
        }
      }

      // Display sync information
      console.log('\n🔄 Synchronization:');
      if (syncInfo.lastSyncTime) {
        console.log(
          `   📅 Last Sync: ${syncInfo.lastSyncTime.toLocaleString()}`,
        );
      } else {
        console.log('   📅 Last Sync: Never');
      }
      console.log(`   📁 Saved Configurations: ${syncInfo.configCount}`);

      console.log(
        '\n💡 Tip: Use "taptik list" to see available configurations',
      );
    } catch (error) {
      console.error('\n❌ Failed to retrieve information:');
      if (error instanceof Error) {
        console.error(`   ${error.message}`);

        if (error.message.includes('not authenticated')) {
          console.error('\n💡 Please log in first using "taptik login"');
        }
      } else {
        console.error('   Unknown error occurred');
      }

      process.exit(1);
    }
  }
}
