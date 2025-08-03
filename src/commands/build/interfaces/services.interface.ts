import { BuildCategory, SupportedPlatform } from './build-options.interface';
import { BuildResult, BuildMetadata } from './build-result.interface';
import { CollectedSettings } from './collected-settings.interface';
import { ConvertedOutput } from './converted-output.interface';

export interface PlatformSelectorService {
  selectPlatform(): Promise<SupportedPlatform>;
}

export interface CategorySelectorService {
  selectCategories(): Promise<BuildCategory[]>;
}

export interface SettingsCollectorService {
  collectSettings(platform: SupportedPlatform, categories: BuildCategory[]): Promise<CollectedSettings>;
}

export interface FormatConverterService {
  convertToTaptikFormat(
    settings: CollectedSettings,
    categories: BuildCategory[]
  ): Promise<ConvertedOutput>;
}

export interface OutputGeneratorService {
  generateOutput(
    convertedData: ConvertedOutput,
    metadata: BuildMetadata
  ): Promise<BuildResult>;
}

export interface LoggerService {
  log(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  debug(message: string): void;
  info(message: string): void;
}