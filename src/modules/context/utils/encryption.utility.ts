import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scrypt,
  createHash,
} from 'node:crypto';
import { promisify } from 'node:util';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ENCRYPTION_ALGORITHMS } from '../constants';

const scryptAsync = promisify(scrypt);

export interface EncryptionOptions {
  algorithm?: string;
  keyDerivation?: boolean;
}

export interface EncryptedData {
  data: string; // Base64 encoded encrypted data
  iv: string; // Base64 encoded initialization vector
  salt?: string; // Base64 encoded salt (if key derivation is used)
  authTag?: string; // Base64 encoded auth tag (for GCM mode)
  algorithm: string;
}

@Injectable()
export class EncryptionUtility {
  private readonly logger = new Logger(EncryptionUtility.name);
  private readonly algorithm = ENCRYPTION_ALGORITHMS.AES_256_GCM;
  private readonly keyLength = 32; // 256 bits
  private readonly ivLength = 16; // 128 bits
  private readonly saltLength = 32; // 256 bits
  private readonly tagLength = 16; // 128 bits
  private encryptionKey: Buffer;

  constructor(private readonly configService: ConfigService) {
    this.initializeKey();
  }

  private initializeKey(): void {
    // Try to get encryption key from environment
    const key = this.configService.get<string>('ENCRYPTION_KEY');

    if (key) {
      // Use provided key (should be base64 encoded)
      this.encryptionKey = Buffer.from(key, 'base64');
      if (this.encryptionKey.length !== this.keyLength) {
        this.logger.warn('Invalid encryption key length. Generating new key.');
        this.encryptionKey = this.generateKey();
      }
    } else {
      // Generate a key for this session (not persistent)
      this.logger.warn(
        'No encryption key found. Using session key (not persistent).',
      );
      this.encryptionKey = this.generateKey();
    }
  }

  /**
   * Encrypt data using AES-256-GCM
   */
  async encrypt(
    data: Buffer | string,
    options: EncryptionOptions = {},
  ): Promise<Buffer> {
    try {
      const input = Buffer.isBuffer(data) ? data : Buffer.from(data);
      const iv = randomBytes(this.ivLength);

      // Use key derivation if password is provided
      let key = this.encryptionKey;
      let salt: Buffer | undefined;

      if (options.keyDerivation) {
        salt = randomBytes(this.saltLength);
        key = await this.deriveKey(this.encryptionKey.toString('base64'), salt);
      }

      // Create cipher
      const cipher = createCipheriv(this.algorithm, key, iv);

      // Encrypt data
      const encrypted = Buffer.concat([cipher.update(input), cipher.final()]);

      // Get auth tag for GCM mode
      const authTag = cipher.getAuthTag();

      // Combine all parts into a single buffer
      // Format: [1 byte: version][16 bytes: iv][16 bytes: authTag][32 bytes: salt (optional)][encrypted data]
      const parts = [
        Buffer.from([0x01]), // Version 1
        iv,
        authTag,
      ];

      if (salt) {
        parts.push(salt);
      }

      parts.push(encrypted);

      const result = Buffer.concat(parts);

      this.logger.debug(
        `Encrypted ${input.length} bytes to ${result.length} bytes`,
      );

      return result;
    } catch (error) {
      this.logger.error(`Encryption failed: ${error.message}`);
      throw new Error(`Failed to encrypt data: ${error.message}`);
    }
  }

  /**
   * Decrypt data using AES-256-GCM
   */
  async decrypt(
    encryptedData: Buffer,
    options: EncryptionOptions = {},
  ): Promise<Buffer> {
    try {
      // Parse the encrypted data
      let offset = 0;

      // Check version
      const version = encryptedData[offset];
      offset += 1;

      if (version !== 0x01) {
        throw new Error(`Unsupported encryption version: ${version}`);
      }

      // Extract IV
      const iv = encryptedData.subarray(offset, offset + this.ivLength);
      offset += this.ivLength;

      // Extract auth tag
      const authTag = encryptedData.subarray(offset, offset + this.tagLength);
      offset += this.tagLength;

      // Extract salt if key derivation was used
      let key = this.encryptionKey;
      if (options.keyDerivation) {
        const salt = encryptedData.subarray(offset, offset + this.saltLength);
        offset += this.saltLength;
        key = await this.deriveKey(this.encryptionKey.toString('base64'), salt);
      }

      // Extract encrypted data
      const encrypted = encryptedData.subarray(offset);

      // Create decipher
      const decipher = createDecipheriv(this.algorithm, key, iv);
      decipher.setAuthTag(authTag);

      // Decrypt data
      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ]);

      this.logger.debug(
        `Decrypted ${encryptedData.length} bytes to ${decrypted.length} bytes`,
      );

      return decrypted;
    } catch (error) {
      this.logger.error(`Decryption failed: ${error.message}`);
      throw new Error(`Failed to decrypt data: ${error.message}`);
    }
  }

  /**
   * Generate a random encryption key
   */
  generateKey(): Buffer {
    return randomBytes(this.keyLength);
  }

  /**
   * Derive a key from a password using scrypt
   */
  private async deriveKey(password: string, salt: Buffer): Promise<Buffer> {
    const key = await scryptAsync(password, salt, this.keyLength);
    return key as Buffer;
  }

  /**
   * Check if data is encrypted (by checking for version byte)
   */
  isEncrypted(data: Buffer): boolean {
    // Check if data starts with our version byte and has minimum length
    const minLength = 1 + this.ivLength + this.tagLength + 1; // version + iv + tag + at least 1 byte of data
    return data.length >= minLength && data[0] === 0x01;
  }

  /**
   * Generate a hash of data (for checksums)
   */
  hash(data: Buffer | string): string {
    const input = Buffer.isBuffer(data) ? data : Buffer.from(data);
    return createHash('sha256').update(input).digest('hex');
  }

  /**
   * Encrypt sensitive fields in an object
   */
  async encryptSensitiveFields(
    object: any,
    sensitiveFields: string[],
  ): Promise<any> {
    const result = { ...object };

    for (const field of sensitiveFields) {
      if (result[field]) {
        // eslint-disable-next-line no-await-in-loop
        const encrypted = await this.encrypt(JSON.stringify(result[field]));
        result[field] = {
          __encrypted: true,
          data: encrypted.toString('base64'),
        };
      }
    }

    return result;
  }

  /**
   * Decrypt sensitive fields in an object
   */
  async decryptSensitiveFields(object: any): Promise<any> {
    const result = { ...object };

    const decryptRecursive = async (item: any): Promise<any> => {
      if (item && typeof item === 'object') {
        if (item.__encrypted === true && item.data) {
          // This is an encrypted field
          const decrypted = await this.decrypt(
            Buffer.from(item.data, 'base64'),
          );
          return JSON.parse(decrypted.toString());
        }

        // Recursively check nested objects
        const newItem: any = Array.isArray(item) ? [] : {};
        for (const key in item) {
          // eslint-disable-next-line no-await-in-loop
          newItem[key] = await decryptRecursive(item[key]);
        }
        return newItem;
      }

      return item;
    };

    return decryptRecursive(result);
  }
}
