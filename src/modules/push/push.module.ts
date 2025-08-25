import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { DeployCoreModule } from '../deploy/core/deploy-core.module';
import { ErrorHandlerService } from '../deploy/services/error-handler.service';
import { SupabaseModule } from '../supabase/supabase.module';

import { PushCommand } from './commands/push.command';
import { AnalyticsService } from './services/analytics.service';
import { CloudUploadService } from './services/cloud-upload.service';
import { LocalQueueService } from './services/local-queue.service';
import { PackageRegistryService } from './services/package-registry.service';
import { PackageValidatorService } from './services/package-validator.service';
import { PushService } from './services/push.service';
import { RateLimiterService } from './services/rate-limiter.service';
import { SanitizationService } from './services/sanitization.service';
import { SignedUrlService } from './services/signed-url.service';

@Module({
  imports: [SupabaseModule, AuthModule, DeployCoreModule],
  providers: [
    PushCommand,
    PushService,
    CloudUploadService,
    PackageRegistryService,
    SanitizationService,
    AnalyticsService,
    RateLimiterService,
    SignedUrlService,
    PackageValidatorService,
    LocalQueueService,
    ErrorHandlerService,
  ],
  exports: [PushService, PackageRegistryService],
})
export class PushModule {}
