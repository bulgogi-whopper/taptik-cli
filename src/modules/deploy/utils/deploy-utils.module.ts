import { Module, forwardRef } from '@nestjs/common';

import { DeployKiroModule } from '../kiro/deploy-kiro.module';
import { DiffService } from '../services/diff.service';
import { LargeFileStreamerService } from '../services/large-file-streamer.service';
import { LockingService } from '../services/locking.service';
import { PlatformValidatorService } from '../services/platform-validator.service';
import { PromptService } from '../services/prompt.service';
import { SchemaMigrationService } from '../services/schema-migration.service';
import { SecretManagementService } from '../services/secret-management.service';
import { SecurityScannerService } from '../services/security-scanner.service';

import { PathResolver } from './path-resolver.utility';
import { PerformanceOptimizer } from './performance-optimizer.utility';

@Module({
  imports: [forwardRef(() => DeployKiroModule)],
  providers: [
    DiffService,
    LargeFileStreamerService,
    LockingService,
    PlatformValidatorService,
    PromptService,
    SchemaMigrationService,
    SecretManagementService,
    SecurityScannerService,
    PathResolver,
    PerformanceOptimizer,
  ],
  exports: [
    DiffService,
    LargeFileStreamerService,
    LockingService,
    PlatformValidatorService,
    PromptService,
    SchemaMigrationService,
    SecretManagementService,
    SecurityScannerService,
    PathResolver,
    PerformanceOptimizer,
  ],
})
export class DeployUtilsModule {}
