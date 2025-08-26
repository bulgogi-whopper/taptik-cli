import { Module } from '@nestjs/common';

import { SupabaseModule } from '../supabase/supabase.module';

import { DeployCommand } from './commands/deploy.command';
import { BackupService } from './services/backup.service';
import { CursorAuditLoggerService } from './services/cursor-audit-logger.service';
import { CursorBackupService } from './services/cursor-backup.service';
import { CursorComprehensiveMonitor } from './services/cursor-comprehensive-monitor.service';
import { CursorConflictResolverService } from './services/cursor-conflict-resolver.service';
import { CursorContentValidatorService } from './services/cursor-content-validator.service';
import { CursorDeploymentStateService } from './services/cursor-deployment-state.service';
import { CursorDeploymentService } from './services/cursor-deployment.service';
import { CursorExtensionValidatorService } from './services/cursor-extension-validator.service';
import { CursorFileWriterService } from './services/cursor-file-writer.service';
import { CursorInstallationDetectorService } from './services/cursor-installation-detector.service';
import { CursorSchemaValidatorService } from './services/cursor-schema-validator.service';
import { CursorSecurityEnforcer } from './services/cursor-security-enforcer.service';
import { CursorSecurityReporter } from './services/cursor-security-reporter.service';
import { CursorTransformerService } from './services/cursor-transformer.service';
import { CursorValidatorService } from './services/cursor-validator.service';
import { DeploymentLoggerService } from './services/deployment-logger.service';
import { DeploymentReporterService } from './services/deployment-reporter.service';
import { DeploymentService } from './services/deployment.service';
import { DiffService } from './services/diff.service';
import { ErrorHandlerService } from './services/error-handler.service';
import { ErrorMessageHelperService } from './services/error-message-helper.service';
import { ErrorRecoveryService } from './services/error-recovery.service';
import { HelpDocumentationService } from './services/help-documentation.service';
import { ImportService } from './services/import.service';
import { KiroComponentHandlerService } from './services/kiro-component-handler.service';
import { KiroConflictResolverService } from './services/kiro-conflict-resolver.service';
import { KiroInstallationDetectorService } from './services/kiro-installation-detector.service';
import { KiroTransformerService } from './services/kiro-transformer.service';
import { KiroValidatorService } from './services/kiro-validator.service';
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
    KiroComponentHandlerService,
    KiroConflictResolverService,
    KiroInstallationDetectorService,
    KiroTransformerService,
    KiroValidatorService,
    LargeFileStreamerService,
    LockingService,
    PerformanceMonitorService,
    PlatformValidatorService,
    PromptService,
    SchemaMigrationService,
    SecretManagementService,
    SecurityScannerService,

    // Cursor Services
    CursorAuditLoggerService,
    CursorBackupService,
    CursorComprehensiveMonitor,
    CursorConflictResolverService,
    CursorContentValidatorService,
    CursorDeploymentService,
    CursorDeploymentStateService,
    CursorExtensionValidatorService,
    CursorFileWriterService,
    CursorInstallationDetectorService,
    CursorSchemaValidatorService,
    CursorSecurityEnforcer,
    CursorSecurityReporter,
    CursorTransformerService,
    CursorValidatorService,

    // Task 12.1: Help and documentation services
    HelpDocumentationService,
    ErrorMessageHelperService,
    // Task 12.2: Reporting services
    DeploymentReporterService,

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
    CursorDeploymentService,
    CursorComprehensiveMonitor,
    CursorSecurityReporter,
    CursorTransformerService,
    CursorValidatorService,
    // Task 12.1: Help and documentation services
    HelpDocumentationService,
    ErrorMessageHelperService,
    // Task 12.2: Reporting services
    DeploymentReporterService,
  ],
})
export class DeployModule {}
