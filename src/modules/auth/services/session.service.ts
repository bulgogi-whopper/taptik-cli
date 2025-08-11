import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { Injectable, Logger } from '@nestjs/common';

import { UserSession } from '../../../models/user.model';
import {
  ISessionStorage,
  StoredSession,
  SessionMetadata,
  SessionStorageOptions,
  AuthError,
  AuthErrorCode,
  RequiredSessionStorageOptions,
} from '../types';

/**
 * Session management service that handles secure storage, retrieval,
 * and validation of user sessions with encryption support
 */
@Injectable()
export class SessionService implements ISessionStorage {
  private readonly logger = new Logger(SessionService.name);
  private readonly options: RequiredSessionStorageOptions;
  private readonly sessionFile: string;

  constructor(options?: Partial<SessionStorageOptions>) {
    // Default configuration
    const defaultOptions: RequiredSessionStorageOptions = {
      directory: join(homedir(), '.taptik'),
      filename: 'session.json',
      expirationCheck: true,
      encryption: false,
      ttl: 24 * 60 * 60 * 1000, // 24 hours
      fileMode: 0o600, // Read/write for owner only
    };

    this.options = { ...defaultOptions, ...options };
    this.sessionFile = join(this.options.directory, this.options.filename);

    // Validate encryption setup
    if (this.options.encryption && !this.options.encryptionKey) {
      this.options.encryptionKey = this.generateEncryptionKey();
      this.logger.warn('Encryption enabled but no key provided. Generated new key.');
    }
  }

  /**
   * Save user session with optional metadata
   */
  async saveSession(session: UserSession, metadata?: SessionMetadata): Promise<void> {
    try {
      await this.ensureDirectoryExists();

      const now = new Date();
      const expiresAt = new Date(now.getTime() + (this.options.ttl || 24 * 60 * 60 * 1000));

      const storedSession: StoredSession = {
        userSession: session,
        storedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        metadata: {
          provider: metadata?.provider || 'oauth',
          creationMethod: metadata?.creationMethod || 'oauth',
          client: metadata?.client || {
            version: process.env.npm_package_version || '0.0.1',
            platform: process.platform,
          },
          lastAccessedAt: now,
          accessCount: 1,
          ...metadata,
        },
      };

      let content = JSON.stringify(storedSession, null, 2);

      // Encrypt if enabled
      if (this.options.encryption && this.options.encryptionKey) {
        content = this.encryptData(content);
      }

      await fs.writeFile(this.sessionFile, content, {
        encoding: 'utf8',
        mode: this.options.fileMode,
      });

      this.logger.log('💾 Session saved successfully');
    } catch (error) {
      const authError: AuthError = {
        code: AuthErrorCode.SESSION_STORAGE_ERROR,
        message: `Failed to save session: ${error instanceof Error ? error.message : 'Unknown error'}`,
        recoverable: true,
        suggestions: [
          'Check file system permissions',
          'Ensure sufficient disk space',
          'Verify directory write access',
        ],
      };
      this.logger.error('Failed to save session:', error);
      throw authError;
    }
  }

  /**
   * Load stored session with validation and expiry check
   */
  async loadSession(): Promise<StoredSession | null> {
    try {
      if (!(await this.hasSession())) {
        return null;
      }

      let content = await fs.readFile(this.sessionFile, 'utf8');

      // Decrypt if enabled
      if (this.options.encryption && this.options.encryptionKey) {
        try {
          content = this.decryptData(content);
        } catch (decryptError) {
          this.logger.error('Failed to decrypt session data:', decryptError);
          // Clean up corrupted encrypted session
          await this.clearSession();
          return null;
        }
      }

      const storedSession: StoredSession = JSON.parse(content);

      // Validate session structure
      if (!this.isValidStoredSession(storedSession)) {
        this.logger.error('Invalid session structure detected');
        await this.clearSession();
        return null;
      }

      // Check expiration if enabled
      if (this.options.expirationCheck && !(await this.isSessionValid(storedSession))) {
        this.logger.log('⏰ Session has expired, removing...');
        await this.clearSession();
        return null;
      }

      // Update access metadata
      await this.updateAccessMetadata(storedSession);

      // Convert date strings back to Date objects
      const session: StoredSession = {
        ...storedSession,
        userSession: {
          ...storedSession.userSession,
          expiresAt: new Date(storedSession.userSession.expiresAt),
        },
        metadata: {
          ...storedSession.metadata,
          lastAccessedAt: new Date(),
          accessCount: (storedSession.metadata?.accessCount || 0) + 1,
        },
      };

      this.logger.log('📂 Session loaded successfully');
      return session;
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return null; // No session file exists
      }

      this.logger.error('Failed to load session:', error);
      return null;
    }
  }

  /**
   * Clear stored session
   */
  async clearSession(): Promise<void> {
    try {
      await fs.unlink(this.sessionFile);
      this.logger.log('🗑️ Session cleared successfully');
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return; // File doesn't exist, already cleared
      }

      const authError: AuthError = {
        code: AuthErrorCode.SESSION_CLEANUP_FAILED,
        message: `Failed to clear session: ${error instanceof Error ? error.message : 'Unknown error'}`,
        recoverable: true,
        suggestions: [
          'Check file system permissions',
          'Try clearing session manually',
          'Restart the application',
        ],
      };
      this.logger.error('Failed to clear session:', error);
      throw authError;
    }
  }

  /**
   * Check if session exists
   */
  async hasSession(): Promise<boolean> {
    try {
      await fs.access(this.sessionFile);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate session expiration and integrity
   */
  async isSessionValid(session: StoredSession): Promise<boolean> {
    if (!session || !session.userSession) {
      return false;
    }

    // Check session expiration
    const now = new Date();
    const expiresAt = new Date(session.userSession.expiresAt);

    if (now >= expiresAt) {
      return false;
    }

    // Check stored session expiration if available
    if (session.expiresAt) {
      const sessionExpiresAt = new Date(session.expiresAt);
      if (now >= sessionExpiresAt) {
        return false;
      }
    }

    // Additional validation for session integrity
    if (!session.userSession.user || !session.userSession.user.id) {
      return false;
    }

    if (!session.userSession.accessToken) {
      return false;
    }

    return true;
  }

  /**
   * Get session file path for debugging
   */
  getSessionPath(): string {
    return this.sessionFile;
  }

  /**
   * Get current session configuration
   */
  getConfiguration(): SessionStorageOptions {
    return { ...this.options };
  }

  /**
   * Update session TTL
   */
  async extendSession(additionalTime: number): Promise<void> {
    const session = await this.loadSession();
    if (!session) {
      throw new Error('No session to extend');
    }

    const newExpiryTime = new Date(session.userSession.expiresAt.getTime() + additionalTime);
    session.userSession.expiresAt = newExpiryTime;

    if (session.expiresAt) {
      const newStoredExpiryTime = new Date(new Date(session.expiresAt).getTime() + additionalTime);
      session.expiresAt = newStoredExpiryTime.toISOString();
    }

    await this.saveSession(session.userSession, session.metadata);
    this.logger.log(`⏱️ Session extended by ${additionalTime}ms`);
  }

  /**
   * Get session statistics
   */
  async getSessionStats(): Promise<{
    exists: boolean;
    isValid: boolean;
    expiresAt?: Date;
    accessCount?: number;
    lastAccessed?: Date;
    createdAt?: Date;
  }> {
    const session = await this.loadSession();
    
    return {
      exists: session !== null,
      isValid: session ? await this.isSessionValid(session) : false,
      expiresAt: session?.userSession.expiresAt,
      accessCount: session?.metadata?.accessCount,
      lastAccessed: session?.metadata?.lastAccessedAt,
      createdAt: session?.storedAt ? new Date(session.storedAt) : undefined,
    };
  }

  /**
   * Private helper methods
   */

  private async ensureDirectoryExists(): Promise<void> {
    try {
      await fs.mkdir(this.options.directory, { 
        recursive: true, 
        mode: 0o700 // Directory accessible only by owner
      });
    } catch (error) {
      throw new Error(`Failed to create session directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private generateEncryptionKey(): string {
    return randomBytes(32).toString('hex');
  }

  private encryptData(data: string): string {
    if (!this.options.encryptionKey) {
      throw new Error('Encryption key not available');
    }
    
    try {
      const algorithm = 'aes-256-gcm';
      const key = Buffer.from(this.options.encryptionKey.slice(0, 32), 'utf8');
      const iv = randomBytes(16);
      const cipher = createCipheriv(algorithm, key, iv);
      
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      // Return iv + authTag + encrypted data
      return `${iv.toString('hex')  }:${  authTag.toString('hex')  }:${  encrypted}`;
    } catch (error) {
      throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private decryptData(encryptedData: string): string {
    if (!this.options.encryptionKey) {
      throw new Error('Encryption key not available for decryption');
    }
    
    try {
      const algorithm = 'aes-256-gcm';
      const key = Buffer.from(this.options.encryptionKey.slice(0, 32), 'utf8');
      
      const parts = encryptedData.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
      }
      
      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const encrypted = parts[2];
      
      const decipher = createDecipheriv(algorithm, key, iv);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private isValidStoredSession(object: unknown): object is StoredSession {
    return (
      typeof object === 'object' &&
      object !== null &&
      'userSession' in object &&
      'storedAt' in object &&
      typeof (object as Record<string, unknown>).userSession === 'object' &&
      typeof (object as Record<string, unknown>).storedAt === 'string'
    );
  }

  private async updateAccessMetadata(session: StoredSession): Promise<void> {
    if (!session.metadata) {
      return;
    }

    try {
      // Update metadata in memory only (don't write back to avoid recursion)
      session.metadata.lastAccessedAt = new Date();
      session.metadata.accessCount = (session.metadata.accessCount || 0) + 1;

      // Write metadata update directly to file without going through saveSession
      // to avoid recursion in loadSession -> updateAccessMetadata -> saveSession -> loadSession
      await this.ensureDirectoryExists();
      
      let content = JSON.stringify(session, null, 2);

      // Encrypt if enabled
      if (this.options.encryption && this.options.encryptionKey) {
        content = this.encryptData(content);
      }

      await fs.writeFile(this.sessionFile, content, {
        encoding: 'utf8',
        mode: this.options.fileMode,
      });
    } catch (error) {
      // Non-critical error, just log it
      this.logger.warn('Failed to update access metadata:', error);
    }
  }
}