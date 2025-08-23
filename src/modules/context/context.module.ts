import { Module } from '@nestjs/common';

import { ConfigLoaderService } from './services/config-loader.service';
import { ConfigPromptService } from './services/config-prompt.service';
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
    ConfigLoaderService,
    ConfigPromptService,
  ],
  exports: [
    SanitizationService,
    MetadataGeneratorService,
    PackageService,
    ValidationService,
    ConfigLoaderService,
    ConfigPromptService,
  ],
})
export class ContextModule {}
