import { Module } from '@nestjs/common';

import { KiroComponentHandlerService } from '../services/kiro-component-handler.service';
import { KiroConflictResolverService } from '../services/kiro-conflict-resolver.service';
import { KiroInstallationDetectorService } from '../services/kiro-installation-detector.service';
import { KiroTransformerService } from '../services/kiro-transformer.service';
import { KiroValidatorService } from '../services/kiro-validator.service';

@Module({
  providers: [
    KiroComponentHandlerService,
    KiroConflictResolverService,
    KiroInstallationDetectorService,
    KiroTransformerService,
    KiroValidatorService,
  ],
  exports: [
    KiroComponentHandlerService,
    KiroConflictResolverService,
    KiroInstallationDetectorService,
    KiroTransformerService,
    KiroValidatorService,
  ],
})
export class DeployKiroModule {}
