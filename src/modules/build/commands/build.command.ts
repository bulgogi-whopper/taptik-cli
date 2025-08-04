import { Command, CommandRunner } from 'nest-commander';

@Command({
  name: 'build',
  description: 'Build taptik-compatible context files from Kiro settings',
})
export class BuildCommand extends CommandRunner {
  async run(): Promise<void> {
    console.log('Build command executed - implementation coming soon...');
  }
}