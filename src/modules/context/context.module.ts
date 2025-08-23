import { Module } from '@nestjs/common';

import { MetadataGeneratorService } from './services/metadata-generator.service';
import { PackageService } from './services/package.service';
import { SanitizationService } from './services/sanitization.service';
import { ValidationService } from './services/validation.service';

@Module({
  providers: [
    SanitizationService,
    MetadataGeneratorService,
    PackageService,
    ValidationService,
  ],
  exports: [
    SanitizationService,
    MetadataGeneratorService,
    PackageService,
    ValidationService,
  ],
})
export class ContextModule {}
