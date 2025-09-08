import { Module, forwardRef } from '@nestjs/common';

import { SupabaseModule } from '../../supabase/supabase.module';
import { DeployKiroModule } from '../kiro/deploy-kiro.module';
import { BackupService } from '../services/backup.service';
import { CursorComponentHandlerService } from '../services/cursor-component-handler.service';
import { CursorConflictResolverService } from '../services/cursor-conflict-resolver.service';
import { CursorTransformerService } from '../services/cursor-transformer.service';
import { CursorValidatorService } from '../services/cursor-validator.service';
import { DeploymentLoggerService } from '../services/deployment-logger.service';
import { DeploymentService } from '../services/deployment.service';
import { DiffService } from '../services/diff.service';
import { ErrorHandlerService } from '../services/error-handler.service';
import { ErrorRecoveryService } from '../services/error-recovery.service';
import { ImportService } from '../services/import.service';
import { KiroComponentHandlerService } from '../services/kiro-component-handler.service';
import { KiroInstallationDetectorService } from '../services/kiro-installation-detector.service';
import { KiroTransformerService } from '../services/kiro-transformer.service';
import { LargeFileStreamerService } from '../services/large-file-streamer.service';
import { PerformanceMonitorService } from '../services/performance-monitor.service';
import { PlatformValidatorService } from '../services/platform-validator.service';
import { SecurityScannerService } from '../services/security-scanner.service';
import { DeployUtilsModule } from '../utils/deploy-utils.module';

@Module({
  imports: [
    SupabaseModule,
    forwardRef(() => DeployUtilsModule),
    forwardRef(() => DeployKiroModule),
  ],
  providers: [
    DeploymentService,
    DeploymentLoggerService,
    ImportService,
    BackupService,
    ErrorRecoveryService,
    ErrorHandlerService,
    PerformanceMonitorService,
    DiffService,
    SecurityScannerService,
    PlatformValidatorService,
    LargeFileStreamerService,
    KiroTransformerService,
    KiroComponentHandlerService,
    KiroInstallationDetectorService,
    CursorTransformerService,
    CursorValidatorService,
    CursorComponentHandlerService,
    CursorConflictResolverService,
  ],
  exports: [
    DeploymentService,
    DeploymentLoggerService,
    ImportService,
    BackupService,
    ErrorRecoveryService,
    ErrorHandlerService,
    PerformanceMonitorService,
    DiffService,
    SecurityScannerService,
    PlatformValidatorService,
    LargeFileStreamerService,
    KiroTransformerService,
    KiroComponentHandlerService,
    KiroInstallationDetectorService,
    CursorTransformerService,
    CursorValidatorService,
    CursorComponentHandlerService,
    CursorConflictResolverService,
  ],
})
export class DeployCoreModule {}
