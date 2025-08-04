import { Module } from '@nestjs/common';

import { BuildCommand } from './commands/build.command';
import { InteractiveService } from './services/interactive.service';

@Module({
  providers: [BuildCommand, InteractiveService],
  exports: [BuildCommand, InteractiveService],
})
export class BuildModule {}