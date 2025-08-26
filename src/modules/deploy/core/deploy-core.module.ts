import { Module, forwardRef } from '@nestjs/common';

import { SupabaseModule } from '../../supabase/supabase.module';
import { DeployKiroModule } from '../kiro/deploy-kiro.module';
import { BackupService } from '../services/backup.service';
import { DeploymentLoggerService } from '../services/deployment-logger.service';
import { DeploymentService } from '../services/deployment.service';
import { ErrorHandlerService } from '../services/error-handler.service';
import { ErrorRecoveryService } from '../services/error-recovery.service';
import { ImportService } from '../services/import.service';
import { PerformanceMonitorService } from '../services/performance-monitor.service';
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
