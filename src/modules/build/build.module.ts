import { Module } from '@nestjs/common';

import { BuildCommand } from './commands/build.command';
import { InteractiveService } from './services/interactive.service';
import { CollectionService } from './services/collection.service';
import { TransformationService } from './services/transformation.service';

@Module({
  providers: [BuildCommand, InteractiveService, CollectionService, TransformationService],
  exports: [BuildCommand, InteractiveService, CollectionService, TransformationService],
})
export class BuildModule {}