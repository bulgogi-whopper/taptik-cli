import { Module } from '@nestjs/common';

import { SupabaseModule } from '../../supabase/supabase.module';
import { BackupService } from '../services/backup.service';
import { DeploymentLoggerService } from '../services/deployment-logger.service';
import { DeploymentService } from '../services/deployment.service';
import { ErrorHandlerService } from '../services/error-handler.service';
import { ErrorRecoveryService } from '../services/error-recovery.service';
import { ImportService } from '../services/import.service';
import { PerformanceMonitorService } from '../services/performance-monitor.service';

@Module({
  imports: [SupabaseModule],
  providers: [
    DeploymentService,
    DeploymentLoggerService,
    ImportService,
    BackupService,
    ErrorRecoveryService,
    ErrorHandlerService,
    PerformanceMonitorService,
  ],
  exports: [
    DeploymentService,
    DeploymentLoggerService,
    ImportService,
    BackupService,
    ErrorRecoveryService,
    ErrorHandlerService,
    PerformanceMonitorService,
  ],
})
export class DeployCoreModule {}
