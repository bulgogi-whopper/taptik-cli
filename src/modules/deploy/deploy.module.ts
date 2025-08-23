import { Module } from '@nestjs/common';

import { SupabaseModule } from '../supabase/supabase.module';

import { DeployCommand } from './commands/deploy.command';
import { BackupService } from './services/backup.service';
import { DeploymentLoggerService } from './services/deployment-logger.service';
import { DeploymentService } from './services/deployment.service';
import { DiffService } from './services/diff.service';
import { ErrorHandlerService } from './services/error-handler.service';
import { ErrorRecoveryService } from './services/error-recovery.service';
import { ImportService } from './services/import.service';
import { KiroTransformerService } from './services/kiro-transformer.service';
import { LargeFileStreamerService } from './services/large-file-streamer.service';
import { LockingService } from './services/locking.service';
import { PerformanceMonitorService } from './services/performance-monitor.service';
import { PlatformValidatorService } from './services/platform-validator.service';
import { PromptService } from './services/prompt.service';
import { SchemaMigrationService } from './services/schema-migration.service';
import { SecretManagementService } from './services/secret-management.service';
import { SecurityScannerService } from './services/security-scanner.service';
import { PathResolver } from './utils/path-resolver.utility';
import { PerformanceOptimizer } from './utils/performance-optimizer.utility';

@Module({
  imports: [SupabaseModule],
  providers: [
    // Services
    BackupService,
    DeploymentService,
    DeploymentLoggerService,
    DiffService,
    ErrorHandlerService,
    ErrorRecoveryService,
    ImportService,
    KiroTransformerService,
    LargeFileStreamerService,
    LockingService,
    PerformanceMonitorService,
    PlatformValidatorService,
    PromptService,
    SchemaMigrationService,
    SecretManagementService,
    SecurityScannerService,

    // Utilities
    PathResolver,
    PerformanceOptimizer,

    // Commands
    DeployCommand,
  ],
  exports: [
    DeploymentService,
    ImportService,
    BackupService,
    ErrorRecoveryService,
    ErrorHandlerService,
    DeploymentLoggerService,
    PerformanceMonitorService,
  ],
})
export class DeployModule {}
