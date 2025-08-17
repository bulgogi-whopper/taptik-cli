import { promisify } from 'node:util';
import { gzip, gunzip } from 'node:zlib';

import { Injectable, Logger } from '@nestjs/common';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

export interface CompressionOptions {
  level?: number; // 1-9, where 9 is best compression
}

export interface CompressionResult {
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
}

@Injectable()
export class CompressionUtility {
  private readonly logger = new Logger(CompressionUtility.name);
  private readonly defaultLevel = 6; // Balanced compression

  /**
   * Compress data using gzip
   */
  async compress(
    data: Buffer | string,
    options: CompressionOptions = {},
  ): Promise<Buffer> {
    try {
      const input = Buffer.isBuffer(data) ? data : Buffer.from(data);
      const level = options.level || this.defaultLevel;

      const compressed = await gzipAsync(input, { level });

      const result: CompressionResult = {
        originalSize: input.length,
        compressedSize: compressed.length,
        compressionRatio: (1 - compressed.length / input.length) * 100,
      };

      this.logger.debug(
        `Compressed ${result.originalSize} bytes to ${result.compressedSize} bytes ` +
          `(${result.compressionRatio.toFixed(2)}% reduction)`,
      );

      return compressed;
    } catch (error) {
      this.logger.error(`Compression failed: ${error.message}`);
      throw new Error(`Failed to compress data: ${error.message}`);
    }
  }

  /**
   * Decompress gzip data
   */
  async decompress(data: Buffer): Promise<Buffer> {
    try {
      const decompressed = await gunzipAsync(data);

      this.logger.debug(
        `Decompressed ${data.length} bytes to ${decompressed.length} bytes`,
      );

      return decompressed;
    } catch (error) {
      this.logger.error(`Decompression failed: ${error.message}`);
      throw new Error(`Failed to decompress data: ${error.message}`);
    }
  }

  /**
   * Check if data is compressed (gzip magic number)
   */
  isCompressed(data: Buffer): boolean {
    // Gzip magic number: 1f 8b
    return data.length >= 2 && data[0] === 0x1f && data[1] === 0x8b;
  }

  /**
   * Get compression statistics
   */
  getCompressionStats(original: Buffer, compressed: Buffer): CompressionResult {
    return {
      originalSize: original.length,
      compressedSize: compressed.length,
      compressionRatio: (1 - compressed.length / original.length) * 100,
    };
  }

  /**
   * Estimate compressed size (rough estimate)
   */
  estimateCompressedSize(data: Buffer | string): number {
    const size = Buffer.isBuffer(data) ? data.length : Buffer.byteLength(data);
    // JSON typically compresses to 10-30% of original size
    // Using 25% as a conservative estimate
    return Math.ceil(size * 0.25);
  }
}
