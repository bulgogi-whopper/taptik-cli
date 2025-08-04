import { Command, CommandRunner } from 'nest-commander';

import { InteractiveService } from '../services/interactive.service';

@Command({
  name: 'build',
  description: 'Build taptik-compatible context files from Kiro settings',
})
export class BuildCommand extends CommandRunner {
  constructor(private readonly interactiveService: InteractiveService) {
    super();
  }

  async run(): Promise<void> {
    try {
      const platform = await this.interactiveService.selectPlatform();
      const categories = await this.interactiveService.selectCategories();
      
      console.log('\n✅ Configuration complete!');
      console.log(`Platform: ${platform}`);
      console.log(`Categories: ${categories.map(c => c.name).join(', ')}`);
      console.log('\n🚧 Build implementation coming soon...');
    } catch (error) {
      console.error('\n❌ Build process interrupted:', error.message);
      // eslint-disable-next-line unicorn/no-process-exit
      process.exit(1);
    }
  }
}