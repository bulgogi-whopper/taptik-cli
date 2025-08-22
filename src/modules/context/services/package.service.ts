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
}

@Injectable()
export class PackageService {
  private readonly logger = new Logger(PackageService.name);

  async createTaptikPackage(
    metadata: CloudMetadata,
    context: TaptikContext,
    options: PackageOptions = {}
  ): Promise<TaptikPackage> {
    this.logger.log('Creating Taptik package');

    // Validate inputs
    if (!metadata.title) {
      throw new Error('Invalid metadata: title is required');
    }
    if (!context.version) {
      throw new Error('Invalid context: version is required');
    }

    const compression = options.compression || 'gzip';
    const sanitizedConfig = options.optimizeSize
      ? await this.optimizePackageSize(context)
      : context;

    // Generate checksum
    const checksum = await this.generateChecksum(sanitizedConfig);

    // Create manifest
    const manifest = await this.createPackageManifest(sanitizedConfig);

    // Calculate size
    const packageData = {
      metadata,
      sanitizedConfig,
      checksum,
      format: 'taptik-v1' as const,
      compression,
      manifest,
    };

    const size = Buffer.from(JSON.stringify(packageData)).length;

    const taptikPackage: TaptikPackage = {
      ...packageData,
      size,
    };

    this.logger.log(`Package created with size: ${size} bytes`);
    return taptikPackage;
  }

  async generateChecksum(data: unknown): Promise<string> {
    try {
      // Handle circular references by using a replacer
      const jsonString = JSON.stringify(data, this.getCircularReplacer());
      const hash = crypto.createHash('sha256');
      hash.update(jsonString);
      return hash.digest('hex');
    } catch (error) {
      this.logger.error('Error generating checksum', error);
      throw error;
    }
  }

  async createPackageManifest(context: TaptikContext): Promise<{
    files: string[];
    directories: string[];
    totalSize: number;
  }> {
    const files: string[] = [];
    const directories: string[] = [];
    let totalSize = 0;

    // Analyze Claude Code data
    if (context.data.claudeCode) {
      directories.push('.claude');

      if (context.data.claudeCode.local?.settings) {
        files.push('settings.json');
        totalSize += JSON.stringify(context.data.claudeCode.local.settings).length;
      }

      if (context.data.claudeCode.local?.agents && context.data.claudeCode.local.agents.length > 0) {
        files.push('agents.json');
        directories.push('.claude/agents');
        totalSize += JSON.stringify(context.data.claudeCode.local.agents).length;
      }

      if (context.data.claudeCode.local?.commands && context.data.claudeCode.local.commands.length > 0) {
        files.push('commands.json');
        directories.push('.claude/commands');
        totalSize += JSON.stringify(context.data.claudeCode.local.commands).length;
      }

      if (context.data.claudeCode.local?.mcpServers) {
        files.push('.mcp.json');
        totalSize += JSON.stringify(context.data.claudeCode.local.mcpServers).length;
      }

      if (context.data.claudeCode.local?.steeringRules) {
        files.push('steering.json');
        directories.push('.claude/steering');
        totalSize += JSON.stringify(context.data.claudeCode.local.steeringRules).length;
      }

      if (context.data.claudeCode.local?.instructions) {
        if (context.data.claudeCode.local.instructions.global) {
          files.push('CLAUDE.md');
          totalSize += context.data.claudeCode.local.instructions.global.length;
        }
        if (context.data.claudeCode.local.instructions.local) {
          files.push('CLAUDE.local.md');
          totalSize += context.data.claudeCode.local.instructions.local.length;
        }
      }
    }

    return {
      files,
      directories: [...new Set(directories)], // Remove duplicates
      totalSize,
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

    // Ensure parent directory exists
    const dir = path.dirname(outputPath);
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
    }

    // Prepare data
    const jsonData = JSON.stringify(taptikPackage, null, 2);
    let outputData: Buffer;

    // Apply compression if needed
    if (taptikPackage.compression === 'gzip') {
      outputData = await gzip(jsonData, { level: 9 });
    } else {
      outputData = Buffer.from(jsonData);
    }

    // Write to file
    await fs.writeFile(outputPath, outputData, 'utf-8');
    this.logger.log(`Package written successfully: ${outputPath}`);
  }

  async compressPackage(data: unknown): Promise<Buffer> {
    const jsonString = JSON.stringify(data, null, 2);
    return gzip(jsonString, { level: 9 });
  }

  async validatePackageIntegrity(taptikPackage: TaptikPackage): Promise<boolean> {
    try {
      // Validate checksum
      const currentChecksum = await this.generateChecksum(taptikPackage.sanitizedConfig);
      if (currentChecksum !== taptikPackage.checksum) {
        this.logger.warn('Checksum mismatch detected');
        return false;
      }

      // Validate manifest
      const currentManifest = await this.createPackageManifest(taptikPackage.sanitizedConfig);
      const manifestMatch = 
        JSON.stringify(currentManifest.files.sort()) === JSON.stringify(taptikPackage.manifest.files.sort()) &&
        JSON.stringify(currentManifest.directories.sort()) === JSON.stringify(taptikPackage.manifest.directories.sort());

      if (!manifestMatch) {
        this.logger.warn('Manifest mismatch detected');
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('Error validating package integrity', error);
      return false;
    }
  }

  async readPackageFromFile(filePath: string): Promise<TaptikPackage> {
    this.logger.log(`Reading package from: ${filePath}`);

    try {
      const fileData = await fs.readFile(filePath);
      let jsonString: string;

      // Try to decompress if it's gzipped
      try {
        const decompressed = await gunzip(fileData);
        jsonString = decompressed.toString();
      } catch {
        // Not compressed, treat as plain JSON
        jsonString = fileData.toString();
      }

      const taptikPackage = JSON.parse(jsonString) as TaptikPackage;

      // Validate format
      if (!taptikPackage.format || taptikPackage.format !== 'taptik-v1') {
        throw new Error('Invalid package format');
      }

      return taptikPackage;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error('File not found');
      }
      if (error instanceof SyntaxError) {
        throw new Error('Invalid package format');
      }
      throw error;
    }
  }

  async optimizePackageSize(context: TaptikContext): Promise<TaptikContext> {
    const optimized = JSON.parse(JSON.stringify(context));

    // Remove null, undefined, and empty string values
    const removeEmpty = (obj: Record<string, unknown>): Record<string, unknown> => {
      Object.keys(obj).forEach(key => {
        if (obj[key] === null || obj[key] === undefined || obj[key] === '') {
          delete obj[key];
        } else if (typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
          removeEmpty(obj[key] as Record<string, unknown>);
        } else if (typeof obj[key] === 'string') {
          // Minimize whitespace
          obj[key] = (obj[key] as string).replace(/\s+/g, ' ').trim();
        }
      });
      return obj;
    };

    // Process each data section
    if (optimized.data.claudeCode) {
      removeEmpty(optimized.data.claudeCode);
    }

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
}