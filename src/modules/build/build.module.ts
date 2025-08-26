import { Module } from '@nestjs/common';

import { ContextModule } from '../context/context.module';
import { PushModule } from '../push/push.module';

import { BuildCommand } from './commands/build.command';
import { CollectionService } from './services/collection/collection.service';
import { CursorCollectionService } from './services/cursor-collection.service';
import { CursorSecurityService } from './services/cursor-security.service';
import { CursorTransformationService } from './services/cursor-transformation.service';
import { CursorValidationService } from './services/cursor-validation.service';
import { ErrorHandlerService } from './services/error-handler/error-handler.service';
import { InteractiveService } from './services/interactive/interactive.service';
import { OutputService } from './services/output/output.service';
import { ProgressService } from './services/progress/progress.service';
import { TransformationService } from './services/transformation/transformation.service';

@Module({
  imports: [ContextModule, PushModule],
  providers: [
    BuildCommand,
    InteractiveService,
    CollectionService,
    CursorCollectionService,
    CursorSecurityService,
    CursorTransformationService,
    CursorValidationService,
    TransformationService,
    OutputService,
    ProgressService,
    ErrorHandlerService,
  ],
  exports: [
    BuildCommand,
    InteractiveService,
    CollectionService,
    CursorCollectionService,
    CursorSecurityService,
    CursorTransformationService,
    CursorValidationService,
    TransformationService,
    OutputService,
    ProgressService,
    ErrorHandlerService,
  ],
})
export class BuildModule {}
