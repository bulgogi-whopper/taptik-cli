import { Command, CommandRunner } from 'nest-commander';

import { InfoService } from '../services/info.service';

@Command({
  name: 'info',
  description: 'Info',
})
export class InfoCommand extends CommandRunner {
  constructor(private readonly infoService: InfoService) {
    super();
  }

  // FIXME: 
  async run(): Promise<void> {
    try {
      const accountInfo = await this.infoService.getAccountInfo();
      const message = `Your Account Info:
email: ${accountInfo.email}
loggedInAt: ${accountInfo.loggedInAt}
      `;
      console.log(message);
    } catch (error) {
      console.error('\n❌ Info Error:', error.message);
      // eslint-disable-next-line unicorn/no-process-exit
      process.exit(1);
    }
  }
}