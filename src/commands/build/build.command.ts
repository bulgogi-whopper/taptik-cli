import { Injectable, Inject } from '@nestjs/common';

import { Command, CommandRunner, Option } from 'nest-commander';

import {
  BuildCommandOptions,
  PlatformSelectorService,
  CategorySelectorService,
  SettingsCollectorService,
  FormatConverterService,
  OutputGeneratorService,
  LoggerService,
  BuildResult,
  SupportedPlatform,
  BuildCategory
} from './interfaces';

@Injectable()
@Command({
  name: 'build',
  description: 'Build configuration bundle from AI IDE settings'
})
export class BuildCommand extends CommandRunner {
  constructor(
    @Inject('PlatformSelectorService') private readonly platformSelector: PlatformSelectorService,
    @Inject('CategorySelectorService') private readonly categorySelector: CategorySelectorService,
    @Inject('SettingsCollectorService') private readonly settingsCollector: SettingsCollectorService,
    @Inject('FormatConverterService') private readonly formatConverter: FormatConverterService,
    @Inject('OutputGeneratorService') private readonly outputGenerator: OutputGeneratorService,
    @Inject('LoggerService') private readonly logger: LoggerService
  ) {
    super();
  }

  async run(_passedParameters: string[], options?: BuildCommandOptions): Promise<void> {
    try {
      // Set verbose logging if requested
      if (options?.verbose) {
        this.logger.info('Verbose logging enabled');
      }

      this.logger.info('Starting taptik build process...');

      // Step 1: Platform selection (use option if provided)
      let platform: SupportedPlatform;
      if (options?.source) {
        platform = this.validatePlatform(options.source);
        this.logger.info(`Using specified platform: ${platform}`);
      } else {
        platform = await this.platformSelector.selectPlatform();
        this.logger.info(`Selected platform: ${platform}`);
      }

      // Step 2: Category selection (use options if provided)
      let categories: BuildCategory[];
      if (options?.include) {
        categories = this.parseCategories(options.include);
        this.logger.info(`Using specified categories: ${categories.join(', ')}`);
      } else {
        categories = await this.categorySelector.selectCategories();
        this.logger.info(`Selected categories: ${categories.join(', ')}`);
      }

      // Apply exclusions if specified
      if (options?.exclude) {
        const excludeCategories = this.parseCategories(options.exclude);
        categories = categories.filter(cat => !excludeCategories.includes(cat));
        this.logger.info(`Categories after exclusions: ${categories.join(', ')}`);
      }

      // Validate that we have categories to process
      if (categories.length === 0) {
        throw new Error('No categories selected for processing');
      }

      // Step 3: Settings collection
      this.logger.info('Collecting settings...');
      const collectedSettings = await this.settingsCollector.collectSettings(platform, categories);

      // Step 4: Format conversion
      this.logger.info('Converting to taptik format...');
      const convertedOutput = await this.formatConverter.convertToTaptikFormat(
        collectedSettings,
        categories
      );

      // Step 5: Output generation
      this.logger.info('Generating output files...');
      const buildResult: BuildResult = await this.outputGenerator.generateOutput(
        convertedOutput,
        {
          buildId: this.generateBuildId(),
          platform,
          categories: categories.map(cat => cat.toString()),
          timestamp: new Date(),
          version: '1.0.0'
        }
      );

      // Step 6: Display results
      this.displayBuildResults(buildResult);
      this.logger.info('Build completed successfully!');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Build failed: ${errorMessage}`);
      
      if (options?.verbose && error instanceof Error) {
        this.logger.debug(`Stack trace: ${error.stack}`);
      }
      
      throw error;
    }
  }

  @Option({
    flags: '-s, --source <platform>',
    description: 'Source platform (kiro, cursor, claude_code)',
  })
  parseSource(value: string): string {
    return value;
  }

  @Option({
    flags: '-o, --output <path>',
    description: 'Output directory path',
  })
  parseOutput(value: string): string {
    return value;
  }

  @Option({
    flags: '-i, --include <categories>',
    description: 'Categories to include (comma-separated: personal,project,prompts)',
  })
  parseInclude(value: string): string {
    return value;
  }

  @Option({
    flags: '-e, --exclude <categories>',
    description: 'Categories to exclude (comma-separated)',
  })
  parseExclude(value: string): string {
    return value;
  }

  @Option({
    flags: '-f, --force',
    description: 'Force overwrite existing output directory',
  })
  parseForce(): boolean {
    return true;
  }

  @Option({
    flags: '-v, --verbose',
    description: 'Enable verbose logging',
  })
  parseVerbose(): boolean {
    return true;
  }

  private validatePlatform(platform: string): SupportedPlatform {
    const validPlatforms = Object.values(SupportedPlatform);
    const normalizedPlatform = platform.toLowerCase() as SupportedPlatform;
    
    if (!validPlatforms.includes(normalizedPlatform)) {
      throw new Error(`Invalid platform: ${platform}. Supported platforms: ${validPlatforms.join(', ')}`);
    }
    
    return normalizedPlatform;
  }

  private parseCategories(categoriesString: string): BuildCategory[] {
    const categoryNames = categoriesString.split(',').map(cat => cat.trim().toLowerCase());
    const validCategories = Object.values(BuildCategory);
    const categories: BuildCategory[] = [];

    for (const categoryName of categoryNames) {
      const category = categoryName as BuildCategory;
      if (!validCategories.includes(category)) {
        throw new Error(`Invalid category: ${categoryName}. Supported categories: ${validCategories.join(', ')}`);
      }
      categories.push(category);
    }

    return categories;
  }

  private generateBuildId(): string {
    const timestamp = new Date().toISOString().replace(/[.:]/g, '-');
    const random = Math.random().toString(36).slice(2, 8);
    return `build-${timestamp}-${random}`;
  }

  private displayBuildResults(result: BuildResult): void {
    this.logger.info('\n=== Build Results ===');
    this.logger.info(`Output Directory: ${result.outputDirectory}`);
    this.logger.info(`Total Files: ${result.files.length}`);
    this.logger.info(`Total Size: ${this.formatBytes(result.summary.totalSize)}`);
    this.logger.info(`Categories: ${result.summary.categories.join(', ')}`);
    
    if (result.summary.warnings.length > 0) {
      this.logger.warn(`Warnings: ${result.summary.warnings.length}`);
      result.summary.warnings.forEach(warning => this.logger.warn(`  - ${warning}`));
    }

    if (result.summary.errors.length > 0) {
      this.logger.error(`Errors: ${result.summary.errors.length}`);
      result.summary.errors.forEach(error => this.logger.error(`  - ${error}`));
    }

    this.logger.info('\nGenerated Files:');
    result.files.forEach(file => {
      this.logger.info(`  - ${file.filename} (${this.formatBytes(file.size)})`);
    });
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2))  } ${  sizes[i]}`;
  }
}