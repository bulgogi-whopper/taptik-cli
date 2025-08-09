import { Module } from '@nestjs/common';

import { BuildCommand } from './commands/build.command';
import { InteractiveService } from './services/interactive.service';
import { CollectionService } from './services/collection.service';

@Module({
  providers: [BuildCommand, InteractiveService, CollectionService],
  exports: [BuildCommand, InteractiveService, CollectionService],
})
export class BuildModule {}