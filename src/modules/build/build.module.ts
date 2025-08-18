import { Module } from '@nestjs/common';

import { BuildCommand } from './commands/build.command';
import { CollectionService } from './services/collection/collection.service';
import { ErrorHandlerService } from './services/error-handler/error-handler.service';
import { InteractiveService } from './services/interactive/interactive.service';
import { OutputService } from './services/output/output.service';
import { ProgressService } from './services/progress/progress.service';
import { TransformationService } from './services/transformation/transformation.service';

@Module({
  providers: [BuildCommand, InteractiveService, CollectionService, TransformationService, OutputService, ProgressService, ErrorHandlerService],
  exports: [BuildCommand, InteractiveService, CollectionService, TransformationService, OutputService, ProgressService, ErrorHandlerService],
})
export class BuildModule {}