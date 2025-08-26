import { Module, forwardRef } from '@nestjs/common';

import { DeployCoreModule } from '../core/deploy-core.module';
import { KiroComponentHandlerService } from '../services/kiro-component-handler.service';
import { KiroConflictResolverService } from '../services/kiro-conflict-resolver.service';
import { KiroInstallationDetectorService } from '../services/kiro-installation-detector.service';
import { KiroTransformerService } from '../services/kiro-transformer.service';
import { KiroValidatorService } from '../services/kiro-validator.service';

@Module({
  imports: [forwardRef(() => DeployCoreModule)],
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
