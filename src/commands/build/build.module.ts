import { Module } from '@nestjs/common';

import { BuildCommand } from './build.command';
import {
  CategorySelectorService,
  SettingsCollectorService,
  FormatConverterService,
  OutputGeneratorService,
  LoggerService,
  SupportedPlatform,
  BuildCategory,
  CollectedSettings,
  ConvertedOutput,
  BuildResult,
  BuildMetadata
} from './interfaces';
import { PlatformSelectorServiceImpl, CategorySelectorServiceImpl } from './services';

// Placeholder implementations for dependency injection setup
// These will be replaced with actual implementations in subsequent tasks





class PlaceholderSettingsCollectorService implements SettingsCollectorService {
  async collectSettings(_platform: SupportedPlatform, _categories: BuildCategory[]): Promise<CollectedSettings> {
    throw new Error('SettingsCollectorService not implemented yet');
  }
}

class PlaceholderFormatConverterService implements FormatConverterService {
  async convertToTaptikFormat(_settings: CollectedSettings, _categories: BuildCategory[]): Promise<ConvertedOutput> {
    throw new Error('FormatConverterService not implemented yet');
  }
}

class PlaceholderOutputGeneratorService implements OutputGeneratorService {
  async generateOutput(_convertedData: ConvertedOutput, _metadata: BuildMetadata): Promise<BuildResult> {
    throw new Error('OutputGeneratorService not implemented yet');
  }
}

class PlaceholderLoggerService implements LoggerService {
  log(message: string): void {
    // eslint-disable-next-line no-console
    console.log(`[LOG] ${message}`);
  }
  
  warn(message: string): void {
    // eslint-disable-next-line no-console
    console.warn(`[WARN] ${message}`);
  }
  
  error(message: string): void {
    // eslint-disable-next-line no-console
    console.error(`[ERROR] ${message}`);
  }
  
  debug(message: string): void {
    // eslint-disable-next-line no-console
    console.debug(`[DEBUG] ${message}`);
  }
  
  info(message: string): void {
    // eslint-disable-next-line no-console
    console.info(`[INFO] ${message}`);
  }
}

@Module({
  providers: [
    BuildCommand,
    {
      provide: 'PlatformSelectorService',
      useClass: PlatformSelectorServiceImpl,
    },
    {
      provide: 'CategorySelectorService',
      useClass: CategorySelectorServiceImpl,
    },
    {
      provide: 'SettingsCollectorService',
      useClass: PlaceholderSettingsCollectorService,
    },
    {
      provide: 'FormatConverterService',
      useClass: PlaceholderFormatConverterService,
    },
    {
      provide: 'OutputGeneratorService',
      useClass: PlaceholderOutputGeneratorService,
    },
    {
      provide: 'LoggerService',
      useClass: PlaceholderLoggerService,
    },
  ],
  exports: [BuildCommand],
})
export class BuildModule {}