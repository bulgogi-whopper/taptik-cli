/* eslint-disable import-x/max-dependencies */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

// import { SupabaseModule } from '@/supabase/supabase.module';
import { ContextApplyCommand } from './commands/apply.command';
import { ContextBuildCommand } from './commands/build.command';
import { ContextConvertCommand } from './commands/convert.command';
import { ContextListCommand } from './commands/list.command';
import { ContextPullCommand } from './commands/pull.command';
import { ContextPushCommand } from './commands/push.command';
import { ContextValidateCommand } from './commands/validate.command';
import { BuilderStrategyFactory } from './factories/builder-strategy.factory';
import { ConverterStrategyFactory } from './factories/converter-strategy.factory';
// import { DeployerStrategyFactory } from './factories/deployer-strategy.factory';
import { BackupManagerService } from './services/backup-manager.service';
import { BidirectionalConverterService } from './services/bidirectional-converter.service';
import { CacheManagerService } from './services/cache-manager.service';
import { ConflictResolverService } from './services/conflict-resolver.service';
import { ContextBuilderService } from './services/context-builder.service';
import { ContextConverterService } from './services/context-converter.service';
import { ContextDeployerService } from './services/context-deployer.service';
import { ContextStorageService } from './services/context-storage.service';
import { ContextValidatorService } from './services/context-validator.service';
import { ConversionReporterService } from './services/conversion-reporter.service';
// import { ContextDeployerService } from './services/context-deployer.service';
import { FeatureMappingService } from './services/feature-mapping.service';
import { PlatformDetectorService } from './services/platform-detector.service';
import { ReverseMappingService } from './services/reverse-mapping.service';
import { ClaudeCodeBuilderStrategy } from './strategies/claude-code-builder.strategy';
import { ClaudeCodeDeployerStrategy } from './strategies/claude-code-deployer.strategy';
import { ClaudeToKiroConverterStrategy } from './strategies/claude-to-kiro-converter.strategy';
import { KiroBuilderStrategy } from './strategies/kiro-builder.strategy';
import { KiroDeployerStrategy } from './strategies/kiro-deployer.strategy';
import { KiroToClaudeConverterStrategy } from './strategies/kiro-to-claude-converter.strategy';
// Factories
// Commands
// Utils
import { CompressionUtility } from './utils/compression.utility';
import { EncryptionUtility } from './utils/encryption.utility';
import { FileSystemUtility } from './utils/file-system.utility';
import { ProgressUtility } from './utils/progress.utility';

// Import new services

// External modules

const strategies = [
  // Builder strategies
  KiroBuilderStrategy,
  ClaudeCodeBuilderStrategy,
  // Converter strategies
  KiroToClaudeConverterStrategy,
  ClaudeToKiroConverterStrategy,
  // Deployer strategies
  KiroDeployerStrategy,
  ClaudeCodeDeployerStrategy,
];

const services = [
  BackupManagerService,
  BidirectionalConverterService,
  CacheManagerService,
  ConflictResolverService,
  ConversionReporterService,
  ContextBuilderService,
  ContextStorageService,
  ContextConverterService,
  ContextDeployerService,
  ContextValidatorService,
  FeatureMappingService,
  PlatformDetectorService,
  ReverseMappingService,
];

const factories = [
  BuilderStrategyFactory,
  ConverterStrategyFactory,
  // DeployerStrategyFactory,
];

const commands = [
  ContextBuildCommand,
  ContextPushCommand,
  ContextPullCommand,
  ContextListCommand,
  ContextConvertCommand,
  ContextApplyCommand,
  ContextValidateCommand,
];

const utilities = [
  FileSystemUtility,
  EncryptionUtility,
  CompressionUtility,
  ProgressUtility,
];

@Module({
  imports: [ConfigModule], // SupabaseModule],
  providers: [
    ...services,
    ...utilities,
    ...commands,
    ...strategies,
    ...factories,
  ],
  exports: [
    BackupManagerService,
    BidirectionalConverterService,
    ConflictResolverService,
    ContextBuilderService,
    ContextStorageService,
    ContextConverterService,
    ContextDeployerService,
    ContextValidatorService,
  ],
})
export class ContextModule {}
