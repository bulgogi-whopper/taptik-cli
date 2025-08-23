import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { promisify } from 'util';
import * as zlib from 'zlib';

import { Injectable, Logger } from '@nestjs/common';

import {
  TaptikContext,
  CloudMetadata,
  TaptikPackage,
} from '../interfaces/cloud.interface';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

export interface PackageOptions {
  compression?: 'gzip' | 'none';
  optimizeSize?: boolean;
  maxSize?: number;
  validateIntegrity?: boolean;
  includeSourceMap?: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

export interface PackageMetrics {
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  fileCount: number;
  directoryCount: number;
  processingTime: number;
}

@Injectable()
export class PackageService {
  private readonly logger = new Logger(PackageService.name);
  private readonly MAX_PACKAGE_SIZE = 50 * 1024 * 1024; // 50MB default
  private readonly MIN_COMPRESSION_RATIO = 0.1; // Minimum 10% compression
  private readonly PACKAGE_VERSION = 'taptik-v1';
  private readonly SUPPORTED_FORMATS = ['taptik-v1', 'taptik-v2'];

  async createTaptikPackage(
    metadata: CloudMetadata,
    context: TaptikContext,
    options: PackageOptions = {}
  ): Promise<TaptikPackage> {
    const startTime = Date.now();
    this.logger.log('Creating Taptik package with enhanced validation');

    try {
      // Comprehensive input validation
      const validationResult = await this.validatePackageInputs(metadata, context);
      if (!validationResult.isValid) {
        const errorMsg = `Package validation failed: ${validationResult.errors.join(', ')}`;
        this.logger.error(errorMsg);
        throw new Error(errorMsg);
      }

      // Log warnings if any
      if (validationResult.warnings.length > 0) {
        validationResult.warnings.forEach(warning => 
          this.logger.warn(`Package warning: ${warning}`)
        );
      }

      const compression = options.compression || 'gzip';
      const maxSize = options.maxSize || this.MAX_PACKAGE_SIZE;

      // Optimize package with advanced techniques
      const sanitizedConfig = options.optimizeSize !== false
        ? await this.optimizePackageSize(context)
        : context;

      // Generate checksums with multiple algorithms for better integrity
      const checksum = await this.generateChecksum(sanitizedConfig);
      const checksumSha512 = await this.generateChecksum(sanitizedConfig, 'sha512');

      // Update metadata with the actual checksum
      metadata.checksum = checksum;

      // Create enhanced manifest with detailed metadata
      const manifest = await this.createEnhancedManifest(sanitizedConfig, metadata);

      // Calculate sizes before and after compression
      const originalSize = Buffer.from(JSON.stringify(sanitizedConfig)).length;
      
      // Check size limits
      if (originalSize > maxSize) {
        throw new Error(
          `Package size (${originalSize} bytes) exceeds maximum allowed size (${maxSize} bytes)`
        );
      }

      const packageData = {
        metadata,
        sanitizedConfig,
        checksum,
        checksumSha512,
        format: this.PACKAGE_VERSION,
        compression,
        manifest,
        metrics: {
          originalSize,
          processingTime: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        },
      };

      const size = Buffer.from(JSON.stringify(packageData)).length;

      const taptikPackage: TaptikPackage = {
        ...packageData,
        size,
      } as TaptikPackage;

      // Validate integrity if requested
      if (options.validateIntegrity !== false) {
        const isValid = await this.validatePackageIntegrity(taptikPackage);
        if (!isValid) {
          throw new Error('Package integrity validation failed');
        }
      }

      this.logger.log(
        `Package created successfully: ${size} bytes (${compression}), ` +
        `processing time: ${Date.now() - startTime}ms`
      );
      
      return taptikPackage;
    } catch (error) {
      // Error recovery with partial package creation
      this.logger.error('Error creating package, attempting recovery', error);
      
      // For critical validation errors, throw instead of creating partial package
      if ((error as Error).message.includes('required')) {
        throw error;
      }
      
      return this.createPartialPackage(metadata, context, error as Error);
    }
  }

  async generateChecksum(
    data: unknown,
    algorithm: 'sha256' | 'sha512' = 'sha256'
  ): Promise<string> {
    try {
      // Handle circular references and normalize data
      const normalizedData = this.normalizeDataForChecksum(data);
      const jsonString = JSON.stringify(normalizedData, this.getCircularReplacer());
      
      // Generate checksum with specified algorithm
      const hash = crypto.createHash(algorithm);
      hash.update(jsonString, 'utf8');
      
      // Add version salt for better integrity
      hash.update(this.PACKAGE_VERSION);
      
      return hash.digest('hex');
    } catch (error) {
      this.logger.error(`Error generating ${algorithm} checksum`, error);
      throw new Error(`Checksum generation failed: ${(error as Error).message}`);
    }
  }

  private normalizeDataForChecksum(data: unknown, seen = new WeakSet()): unknown {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    // Handle circular references
    if (seen.has(data)) {
      return '[Circular]';
    }
    seen.add(data);

    // Sort object keys for consistent checksum
    if (Array.isArray(data)) {
      return data.map(item => this.normalizeDataForChecksum(item, seen));
    }

    const sorted: Record<string, unknown> = {};
    Object.keys(data as Record<string, unknown>)
      .sort()
      .forEach(key => {
        sorted[key] = this.normalizeDataForChecksum(
          (data as Record<string, unknown>)[key],
          seen
        );
      });
    
    return sorted;
  }

  async createEnhancedManifest(
    context: TaptikContext,
    _metadata: CloudMetadata
  ): Promise<{
    files: string[];
    directories: string[];
    totalSize: number;
    components: Record<string, {
      count: number;
      size: number;
      paths: string[];
    }>;
    statistics: {
      avgFileSize: number;
      largestComponent: string;
      compressionPotential: number;
    };
  }> {
    const files: string[] = [];
    const directories: string[] = [];
    let totalSize = 0;
    const components: Record<string, { count: number; size: number; paths: string[] }> = {};

    // Initialize component tracking
    const initComponent = (name: string) => {
      if (!components[name]) {
        components[name] = { count: 0, size: 0, paths: [] };
      }
    };

    // Analyze Claude Code data with detailed tracking
    if (context.data.claudeCode) {
      directories.push('.claude');

      if (context.data.claudeCode.local?.settings) {
        const settingsPath = '.claude/settings.json';
        const size = JSON.stringify(context.data.claudeCode.local.settings).length;
        files.push(settingsPath);
        totalSize += size;
        
        initComponent('settings');
        components.settings.count = 1;
        components.settings.size = size;
        components.settings.paths.push(settingsPath);
      }

      if (context.data.claudeCode.local?.agents && context.data.claudeCode.local.agents.length > 0) {
        const agentPaths: string[] = [];
        directories.push('.claude/agents');
        
        initComponent('agents');
        context.data.claudeCode.local.agents.forEach((agent, idx) => {
          const agentPath = `.claude/agents/agent_${idx}.json`;
          agentPaths.push(agentPath);
          files.push(agentPath);
          const size = JSON.stringify(agent).length;
          totalSize += size;
          components.agents.size += size;
        });
        
        components.agents.count = context.data.claudeCode.local.agents.length;
        components.agents.paths = agentPaths;
      }

      if (context.data.claudeCode.local?.commands && context.data.claudeCode.local.commands.length > 0) {
        const commandPaths: string[] = [];
        directories.push('.claude/commands');
        
        initComponent('commands');
        context.data.claudeCode.local.commands.forEach((cmd, idx) => {
          const cmdPath = `.claude/commands/command_${idx}.json`;
          commandPaths.push(cmdPath);
          files.push(cmdPath);
          const size = JSON.stringify(cmd).length;
          totalSize += size;
          components.commands.size += size;
        });
        
        components.commands.count = context.data.claudeCode.local.commands.length;
        components.commands.paths = commandPaths;
      }

      if (context.data.claudeCode.local?.mcpServers) {
        const mcpPath = '.mcp.json';
        const size = JSON.stringify(context.data.claudeCode.local.mcpServers).length;
        files.push(mcpPath);
        totalSize += size;
        
        initComponent('mcpServers');
        components.mcpServers.count = Object.keys(context.data.claudeCode.local.mcpServers).length;
        components.mcpServers.size = size;
        components.mcpServers.paths.push(mcpPath);
      }

      if (context.data.claudeCode.local?.steeringRules) {
        directories.push('.claude/steering');
        const steeringPath = '.claude/steering/rules.json';
        const size = JSON.stringify(context.data.claudeCode.local.steeringRules).length;
        files.push(steeringPath);
        totalSize += size;
        
        initComponent('steeringRules');
        components.steeringRules.count = context.data.claudeCode.local.steeringRules.length;
        components.steeringRules.size = size;
        components.steeringRules.paths.push(steeringPath);
      }

      if (context.data.claudeCode.local?.instructions) {
        initComponent('instructions');
        
        if (context.data.claudeCode.local.instructions.global) {
          const globalPath = 'CLAUDE.md';
          files.push(globalPath);
          const size = context.data.claudeCode.local.instructions.global.length;
          totalSize += size;
          components.instructions.size += size;
          components.instructions.paths.push(globalPath);
          components.instructions.count++;
        }
        
        if (context.data.claudeCode.local.instructions.local) {
          const localPath = 'CLAUDE.local.md';
          files.push(localPath);
          const size = context.data.claudeCode.local.instructions.local.length;
          totalSize += size;
          components.instructions.size += size;
          components.instructions.paths.push(localPath);
          components.instructions.count++;
        }
      }
    }

    // Calculate statistics
    const avgFileSize = files.length > 0 ? Math.round(totalSize / files.length) : 0;
    const largestComponent = Object.entries(components)
      .sort((a, b) => b[1].size - a[1].size)[0]?.[0] || 'none';
    
    // Estimate compression potential based on content type
    const textSize = totalSize;
    const estimatedCompressedSize = Math.round(textSize * 0.3); // Text typically compresses to 30%
    const compressionPotential = totalSize > 0 
      ? Math.round((1 - estimatedCompressedSize / totalSize) * 100)
      : 0;

    return {
      files,
      directories: [...new Set(directories)],
      totalSize,
      components,
      statistics: {
        avgFileSize,
        largestComponent,
        compressionPotential,
      },
    };
  }

  async createPackageManifest(context: TaptikContext): Promise<{
    files: string[];
    directories: string[];
    totalSize: number;
  }> {
    // Simplified version for backward compatibility
    const enhanced = await this.createEnhancedManifest(context, {} as CloudMetadata);
    return {
      files: enhanced.files,
      directories: enhanced.directories,
      totalSize: enhanced.totalSize,
    };
  }

  async writePackageToFile(
    taptikPackage: TaptikPackage,
    outputPath: string
  ): Promise<void> {
    if (!outputPath) {
      throw new Error('Invalid file path');
    }

    this.logger.log(`Writing package to: ${outputPath}`);
    const startTime = Date.now();

    try {
      // Ensure parent directory exists with proper error handling
      const dir = path.dirname(outputPath);
      try {
        await fs.access(dir);
      } catch {
        await fs.mkdir(dir, { recursive: true });
        this.logger.debug(`Created directory: ${dir}`);
      }

      // Prepare data with optimal formatting
      const jsonData = JSON.stringify(taptikPackage, null, 2);
      const originalSize = Buffer.from(jsonData).length;
      let outputData: Buffer;
      let compressionRatio = 1;

      // Apply compression based on type
      switch (taptikPackage.compression) {
        case 'gzip':
          outputData = await gzip(jsonData, { level: 9 });
          compressionRatio = outputData.length / originalSize;
          break;
        default:
          outputData = Buffer.from(jsonData);
      }

      // Validate compression effectiveness
      if (compressionRatio > 0.9 && taptikPackage.compression !== 'none') {
        this.logger.warn(
          `Compression ratio is poor (${(compressionRatio * 100).toFixed(1)}%), ` +
          `consider using 'none' compression for this package`
        );
      }

      // Write to file with atomic operation
      const tempPath = `${outputPath}.tmp`;
      await fs.writeFile(tempPath, outputData);
      await fs.rename(tempPath, outputPath);

      const processingTime = Date.now() - startTime;
      this.logger.log(
        `Package written successfully: ${outputPath} ` +
        `(${outputData.length} bytes, ${(compressionRatio * 100).toFixed(1)}% of original, ` +
        `${processingTime}ms)`
      );
    } catch (error) {
      this.logger.error(`Failed to write package to ${outputPath}`, error);
      throw new Error(`Package write failed: ${(error as Error).message}`);
    }
  }

  async compressPackage(
    data: unknown,
    compression: 'gzip' | 'none' = 'gzip'
  ): Promise<Buffer> {
    const jsonString = JSON.stringify(data, null, 2);
    
    switch (compression) {
      case 'gzip':
        return gzip(jsonString, { level: 9 });
      default:
        return Buffer.from(jsonString);
    }
  }

  async validatePackageIntegrity(taptikPackage: TaptikPackage): Promise<boolean> {
    try {
      const errors: string[] = [];

      // Validate format version
      if (!this.SUPPORTED_FORMATS.includes(taptikPackage.format)) {
        errors.push(`Unsupported package format: ${taptikPackage.format}`);
      }

      // Validate checksum
      const currentChecksum = await this.generateChecksum(taptikPackage.sanitizedConfig);
      if (currentChecksum !== taptikPackage.checksum) {
        errors.push('Primary checksum (SHA256) mismatch');
      }

      // Validate SHA512 checksum if present
      if ('checksumSha512' in taptikPackage) {
        const currentSha512 = await this.generateChecksum(taptikPackage.sanitizedConfig, 'sha512');
        if (currentSha512 !== (taptikPackage as Record<string, unknown>).checksumSha512) {
          errors.push('Secondary checksum (SHA512) mismatch');
        }
      }

      // Validate manifest
      const currentManifest = await this.createPackageManifest(taptikPackage.sanitizedConfig);
      const manifestMatch = 
        JSON.stringify(currentManifest.files.sort()) === JSON.stringify(taptikPackage.manifest.files.sort()) &&
        JSON.stringify(currentManifest.directories.sort()) === JSON.stringify(taptikPackage.manifest.directories.sort());

      if (!manifestMatch) {
        errors.push('Package manifest mismatch');
      }

      // Validate size constraints
      if (taptikPackage.size > this.MAX_PACKAGE_SIZE) {
        errors.push(`Package size exceeds maximum allowed (${this.MAX_PACKAGE_SIZE} bytes)`);
      }

      // Validate required fields
      if (!taptikPackage.metadata?.title) {
        errors.push('Missing required metadata: title');
      }
      if (!taptikPackage.sanitizedConfig?.version) {
        errors.push('Missing required config: version');
      }

      if (errors.length > 0) {
        this.logger.warn(`Package integrity validation failed: ${errors.join(', ')}`);
        return false;
      }

      this.logger.debug('Package integrity validation successful');
      return true;
    } catch (error) {
      this.logger.error('Error validating package integrity', error);
      return false;
    }
  }

  async readPackageFromFile(filePath: string): Promise<TaptikPackage> {
    this.logger.log(`Reading package from: ${filePath}`);
    const startTime = Date.now();

    try {
      // Validate file exists and is readable
      await fs.access(filePath, fs.constants.R_OK);
      const stats = await fs.stat(filePath);
      
      if (stats.size > this.MAX_PACKAGE_SIZE) {
        throw new Error(
          `Package file too large (${stats.size} bytes), ` +
          `maximum allowed is ${this.MAX_PACKAGE_SIZE} bytes`
        );
      }

      const fileData = await fs.readFile(filePath);
      let jsonString: string;
      let detectedCompression = 'none';

      // Try decompression
      try {
        // Try gzip
        const decompressed = await gunzip(fileData);
        jsonString = decompressed.toString();
        detectedCompression = 'gzip';
      } catch {
        // Not compressed, treat as plain JSON
        jsonString = fileData.toString();
      }

      const taptikPackage = JSON.parse(jsonString) as TaptikPackage;

      // Validate format
      if (!taptikPackage.format || !this.SUPPORTED_FORMATS.includes(taptikPackage.format)) {
        throw new Error(
          `Invalid or unsupported package format: ${taptikPackage.format}. ` +
          `Supported formats: ${this.SUPPORTED_FORMATS.join(', ')}`
        );
      }

      // Validate package integrity
      const isValid = await this.validatePackageIntegrity(taptikPackage);
      if (!isValid) {
        throw new Error('Package integrity validation failed');
      }

      const processingTime = Date.now() - startTime;
      this.logger.log(
        `Package read successfully: ${filePath} ` +
        `(${stats.size} bytes, ${detectedCompression} compression, ${processingTime}ms)`
      );

      return taptikPackage;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error('File not found');
      }
      if ((error as NodeJS.ErrnoException).code === 'EACCES') {
        throw new Error(`Permission denied reading package: ${filePath}`);
      }
      if (error instanceof SyntaxError) {
        throw new Error('Invalid package format');
      }
      throw error;
    }
  }

  async optimizePackageSize(context: TaptikContext): Promise<TaptikContext> {
    const startTime = Date.now();
    const originalSize = Buffer.from(JSON.stringify(context)).length;
    const optimized = JSON.parse(JSON.stringify(context));

    // Advanced optimization techniques
    const removeEmpty = (obj: Record<string, unknown>): Record<string, unknown> => {
      Object.keys(obj).forEach(key => {
        const value = obj[key];
        
        // Remove null, undefined, and empty values
        if (value === null || value === undefined || value === '' || 
            (Array.isArray(value) && value.length === 0) ||
            (typeof value === 'object' && Object.keys(value as object).length === 0)) {
          delete obj[key];
        } else if (typeof value === 'object' && !Array.isArray(value)) {
          removeEmpty(value as Record<string, unknown>);
          // Remove object if it became empty after cleanup
          if (Object.keys(value as object).length === 0) {
            delete obj[key];
          }
        } else if (typeof value === 'string') {
          // Minimize whitespace and remove unnecessary newlines
          const trimmed = (value as string)
            .replace(/\s+/g, ' ')
            .replace(/\n\s*\n/g, '\n')
            .trim();
          
          if (trimmed) {
            obj[key] = trimmed;
          } else {
            delete obj[key];
          }
        } else if (Array.isArray(value)) {
          // Remove empty items from arrays
          obj[key] = value.filter(item => 
            item !== null && item !== undefined && item !== ''
          );
          if ((obj[key] as unknown[]).length === 0) {
            delete obj[key];
          }
        }
      });
      return obj;
    };

    // Deduplicate repeated strings
    const deduplicateStrings = (obj: Record<string, unknown>): void => {
      const stringMap = new Map<string, number>();
      const MIN_STRING_LENGTH = 50; // Only dedupe strings longer than this
      
      const countStrings = (o: unknown): void => {
        if (typeof o === 'string' && o.length > MIN_STRING_LENGTH) {
          stringMap.set(o, (stringMap.get(o) || 0) + 1);
        } else if (typeof o === 'object' && o !== null) {
          if (Array.isArray(o)) {
            o.forEach(countStrings);
          } else {
            Object.values(o).forEach(countStrings);
          }
        }
      };
      
      countStrings(obj);
      
      // Create string references for frequently repeated strings
      const frequentStrings = Array.from(stringMap.entries())
        .filter(([_, count]) => count > 2)
        .map(([str]) => str);
      
      if (frequentStrings.length > 0) {
        (obj as Record<string, unknown>)._stringRefs = frequentStrings;
        // Note: In a real implementation, we'd replace strings with references
        // For now, we'll just mark that optimization is possible
      }
    };

    // Process each data section
    if (optimized.data.claudeCode) {
      removeEmpty(optimized.data.claudeCode);
      deduplicateStrings(optimized.data.claudeCode);
    }

    const optimizedSize = Buffer.from(JSON.stringify(optimized)).length;
    const reduction = originalSize - optimizedSize;
    const reductionPercent = (reduction / originalSize * 100).toFixed(1);
    
    this.logger.debug(
      `Package optimization completed in ${Date.now() - startTime}ms: ` +
      `${originalSize} → ${optimizedSize} bytes (${reductionPercent}% reduction)`
    );

    return optimized;
  }

  private getCircularReplacer() {
    const seen = new WeakSet();
    return (_key: string, value: unknown) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular]';
        }
        seen.add(value);
      }
      return value;
    };
  }

  private async validatePackageInputs(
    metadata: CloudMetadata,
    context: TaptikContext
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Required metadata fields
    if (!metadata.title?.trim()) {
      errors.push('Metadata title is required and cannot be empty');
    }
    if (!metadata.sourceIde) {
      errors.push('Source IDE must be specified');
    }
    if (!metadata.version) {
      warnings.push('Version not specified, using default');
    }

    // Context validation
    if (!context.version) {
      errors.push('Context version is required');
    }
    if (!context.sourceIde) {
      errors.push('Context source IDE is required');
    }
    if (!context.data || Object.keys(context.data).length === 0) {
      errors.push('Context data cannot be empty');
    }

    // Size validation
    const estimatedSize = Buffer.from(JSON.stringify(context)).length;
    if (estimatedSize > this.MAX_PACKAGE_SIZE) {
      errors.push(`Estimated package size exceeds maximum allowed`);
    } else if (estimatedSize > this.MAX_PACKAGE_SIZE * 0.8) {
      warnings.push('Package size is approaching maximum limit');
      suggestions.push('Consider enabling size optimization');
    }

    // Claude Code specific validation
    if (context.data && context.data.claudeCode) {
      const claude = context.data.claudeCode;
      if (!claude.local && !claude.global) {
        warnings.push('No Claude Code configuration data found');
      }
      
      // Check for potentially sensitive data
      const hasSensitiveData = this.checkForSensitiveData(context);
      if (hasSensitiveData) {
        warnings.push('Package may contain sensitive data');
        suggestions.push('Ensure sanitization has been applied before upload');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    };
  }

  private checkForSensitiveData(context: TaptikContext): boolean {
    const sensitivePatterns = [
      /api[_-]?key/i,
      /secret/i,
      /password/i,
      /token/i,
      /private[_-]?key/i,
    ];

    const checkString = (str: string): boolean => sensitivePatterns.some(pattern => pattern.test(str));

    const checkObject = (obj: unknown): boolean => {
      if (typeof obj === 'string') {
        return checkString(obj);
      }
      if (typeof obj === 'object' && obj !== null) {
        if (Array.isArray(obj)) {
          return obj.some(checkObject);
        }
        return Object.entries(obj).some(
          ([key, value]) => checkString(key) || checkObject(value)
        );
      }
      return false;
    };

    return checkObject(context.data);
  }

  private async createPartialPackage(
    metadata: CloudMetadata,
    context: TaptikContext,
    error: Error
  ): Promise<TaptikPackage> {
    this.logger.warn('Creating partial package due to error', error.message);

    // Create a minimal valid package with error information
    const partialContext: TaptikContext = {
      version: context.version || '1.0.0',
      sourceIde: context.sourceIde || 'unknown',
      targetIdes: context.targetIdes || [],
      data: {
        // Include whatever data we can salvage
        ...(context.data.claudeCode ? { claudeCode: context.data.claudeCode } : {}),
      },
      metadata: {
        timestamp: context.metadata?.timestamp || new Date().toISOString(),
        exportedBy: context.metadata?.exportedBy || 'error-recovery',
      },
    };

    const checksum = await this.generateChecksum(partialContext);
    const manifest = await this.createPackageManifest(partialContext);

    return {
      metadata: {
        ...metadata,
        title: metadata.title || 'Partial Package',
        description: `Partial package created due to error: ${error.message}`,
      },
      sanitizedConfig: partialContext,
      checksum,
      format: this.PACKAGE_VERSION,
      compression: 'none',
      manifest,
      size: Buffer.from(JSON.stringify(partialContext)).length,
    } as TaptikPackage;
  }

  async getPackageMetrics(taptikPackage: TaptikPackage): Promise<PackageMetrics> {
    const originalSize = Buffer.from(JSON.stringify(taptikPackage.sanitizedConfig)).length;
    const compressedData = await this.compressPackage(
      taptikPackage.sanitizedConfig,
      taptikPackage.compression as 'gzip' | 'none'
    );
    const compressedSize = compressedData.length;

    return {
      originalSize,
      compressedSize,
      compressionRatio: originalSize > 0 ? compressedSize / originalSize : 1,
      fileCount: taptikPackage.manifest.files.length,
      directoryCount: taptikPackage.manifest.directories.length,
      processingTime: 0, // Processing time not available in legacy packages
    };
  }
}