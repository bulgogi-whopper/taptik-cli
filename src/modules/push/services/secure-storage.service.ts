import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { Injectable, Logger } from '@nestjs/common';

export interface SecureCredential {
  key: string;
  value: string;
  encrypted: boolean;
  expiresAt?: Date;
}

@Injectable()
export class SecureStorageService {
  private readonly logger = new Logger(SecureStorageService.name);
  private readonly storageDir: string;
  private readonly algorithm = 'aes-256-gcm';
  private encryptionKey: Buffer | null = null;

  constructor() {
    // Use platform-specific secure storage location
    const baseDir = process.platform === 'darwin'
      ? path.join(os.homedir(), 'Library', 'Application Support')
      : process.platform === 'win32'
        ? process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
        : path.join(os.homedir(), '.config');
    
    this.storageDir = path.join(baseDir, 'taptik-cli', 'secure');
    this.initializeStorage();
  }

  /**
   * Initialize secure storage directory
   */
  private async initializeStorage(): Promise<void> {
    try {
      await fs.mkdir(this.storageDir, { recursive: true, mode: 0o700 });
      
      // Set restrictive permissions on Unix-like systems
      if (process.platform !== 'win32') {
        await fs.chmod(this.storageDir, 0o700);
      }
    } catch (error) {
      this.logger.error('Failed to initialize secure storage', error);
    }
  }

  /**
   * Get or create encryption key
   */
  private async getEncryptionKey(): Promise<Buffer> {
    if (this.encryptionKey) {
      return this.encryptionKey;
    }

    const keyPath = path.join(this.storageDir, '.key');
    
    try {
      // Try to read existing key
      const keyData = await fs.readFile(keyPath);
      this.encryptionKey = keyData;
      return keyData;
    } catch {
      // Generate new key if doesn't exist
      const newKey = crypto.randomBytes(32);
      await fs.writeFile(keyPath, newKey, { mode: 0o600 });
      this.encryptionKey = newKey;
      return newKey;
    }
  }

  /**
   * Store a credential securely
   */
  async storeCredential(
    namespace: string,
    key: string,
    value: string,
    encrypt: boolean = true,
    ttlSeconds?: number,
  ): Promise<void> {
    try {
      const credential: SecureCredential = {
        key,
        value: encrypt ? await this.encrypt(value) : value,
        encrypted: encrypt,
        expiresAt: ttlSeconds ? new Date(Date.now() + ttlSeconds * 1000) : undefined,
      };

      const filePath = path.join(this.storageDir, `${namespace}.json`);
      
      // Read existing credentials
      let credentials: Record<string, SecureCredential> = {};
      try {
        const data = await fs.readFile(filePath, 'utf-8');
        credentials = JSON.parse(data);
      } catch {
        // File doesn't exist yet
      }

      // Update or add credential
      credentials[key] = credential;

      // Write back with restrictive permissions
      await fs.writeFile(
        filePath,
        JSON.stringify(credentials, null, 2),
        { mode: 0o600 }
      );

      this.logger.debug(`Stored credential ${key} in namespace ${namespace}`);
    } catch (error) {
      this.logger.error(`Failed to store credential ${key}`, error);
      throw error;
    }
  }

  /**
   * Retrieve a credential
   */
  async getCredential(namespace: string, key: string): Promise<string | null> {
    try {
      const filePath = path.join(this.storageDir, `${namespace}.json`);
      const data = await fs.readFile(filePath, 'utf-8');
      const credentials: Record<string, SecureCredential> = JSON.parse(data);
      
      const credential = credentials[key];
      if (!credential) {
        return null;
      }

      // Check expiration
      if (credential.expiresAt && new Date(credential.expiresAt) < new Date()) {
        this.logger.debug(`Credential ${key} has expired`);
        await this.deleteCredential(namespace, key);
        return null;
      }

      // Decrypt if needed
      return credential.encrypted 
        ? await this.decrypt(credential.value)
        : credential.value;
    } catch (error) {
      this.logger.debug(`Credential ${key} not found in namespace ${namespace}`);
      return null;
    }
  }

  /**
   * Delete a credential
   */
  async deleteCredential(namespace: string, key: string): Promise<void> {
    try {
      const filePath = path.join(this.storageDir, `${namespace}.json`);
      const data = await fs.readFile(filePath, 'utf-8');
      const credentials: Record<string, SecureCredential> = JSON.parse(data);
      
      delete credentials[key];
      
      if (Object.keys(credentials).length === 0) {
        // Delete file if no credentials left
        await fs.unlink(filePath);
      } else {
        await fs.writeFile(
          filePath,
          JSON.stringify(credentials, null, 2),
          { mode: 0o600 }
        );
      }

      this.logger.debug(`Deleted credential ${key} from namespace ${namespace}`);
    } catch (error) {
      this.logger.debug(`Failed to delete credential ${key}`, error);
    }
  }

  /**
   * Clear all credentials in a namespace
   */
  async clearNamespace(namespace: string): Promise<void> {
    try {
      const filePath = path.join(this.storageDir, `${namespace}.json`);
      await fs.unlink(filePath);
      this.logger.debug(`Cleared all credentials in namespace ${namespace}`);
    } catch (error) {
      this.logger.debug(`Failed to clear namespace ${namespace}`, error);
    }
  }

  /**
   * Encrypt a value
   */
  private async encrypt(text: string): Promise<string> {
    const key = await this.getEncryptionKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Combine iv, authTag, and encrypted data
    return `${iv.toString('hex')  }:${  authTag.toString('hex')  }:${  encrypted}`;
  }

  /**
   * Decrypt a value
   */
  private async decrypt(encryptedData: string): Promise<string> {
    const key = await this.getEncryptionKey();
    const parts = encryptedData.split(':');
    
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Store API key securely
   */
  async storeApiKey(service: string, apiKey: string): Promise<void> {
    await this.storeCredential('api-keys', service, apiKey, true);
  }

  /**
   * Get API key
   */
  async getApiKey(service: string): Promise<string | null> {
    return this.getCredential('api-keys', service);
  }

  /**
   * Store auth token with TTL
   */
  async storeAuthToken(userId: string, token: string, ttlSeconds: number = 3600): Promise<void> {
    await this.storeCredential('auth-tokens', userId, token, true, ttlSeconds);
  }

  /**
   * Get auth token
   */
  async getAuthToken(userId: string): Promise<string | null> {
    return this.getCredential('auth-tokens', userId);
  }

  /**
   * Clean up expired credentials
   */
  async cleanupExpired(): Promise<void> {
    try {
      const files = await fs.readdir(this.storageDir);
      
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        
        const filePath = path.join(this.storageDir, file);
        const data = await fs.readFile(filePath, 'utf-8');
        const credentials: Record<string, SecureCredential> = JSON.parse(data);
        
        let modified = false;
        const now = new Date();
        
        for (const [key, credential] of Object.entries(credentials)) {
          if (credential.expiresAt && new Date(credential.expiresAt) < now) {
            delete credentials[key];
            modified = true;
            this.logger.debug(`Cleaned up expired credential ${key}`);
          }
        }
        
        if (modified) {
          if (Object.keys(credentials).length === 0) {
            await fs.unlink(filePath);
          } else {
            await fs.writeFile(
              filePath,
              JSON.stringify(credentials, null, 2),
              { mode: 0o600 }
            );
          }
        }
      }
    } catch (error) {
      this.logger.error('Failed to cleanup expired credentials', error);
    }
  }
}