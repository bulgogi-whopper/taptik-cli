import { Module } from '@nestjs/common';

import { MetadataGeneratorService } from './services/metadata-generator.service';
import { PackageService } from './services/package.service';
import { SanitizationService } from './services/sanitization.service';

@Module({
  providers: [
    SanitizationService,
    MetadataGeneratorService,
    PackageService,
  ],
  exports: [
    SanitizationService,
    MetadataGeneratorService,
    PackageService,
  ],
})
export class ContextModule {}
