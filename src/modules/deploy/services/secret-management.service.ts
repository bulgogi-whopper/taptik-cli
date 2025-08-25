import { randomUUID } from 'node:crypto';
import * as crypto from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';

import {
  SecretMetadata,
  SecretStorage,
  DetectedSecret,
  EnvironmentSecret,
  RotationPolicy,
  SecretAuditEntry,
  SecretMapping,
  SanitizationResult,
  SecretType,
  SecretStatus,
  SecretPattern,
} from '../interfaces/secret-management.interface';

// Lazy import for keytar to handle optional dependency
let keytar:
  | {
      setPassword: (
        service: string,
        account: string,
        password: string,
      ) => Promise<void>;
      getPassword: (service: string, account: string) => Promise<string | null>;
      deletePassword: (service: string, account: string) => Promise<boolean>;
      findCredentials: (
        service: string,
      ) => Promise<Array<{ account: string; password: string }>>;
    }
  | undefined;

async function loadKeytar(): Promise<typeof keytar> {
  if (keytar !== undefined) {
    return keytar;
  }

  try {
    keytar = await import('keytar');
    return keytar;
  } catch {
    // Keytar not available, will use fallback
    return undefined;
  }
}

@Injectable()
export class SecretManagementService {
  private readonly logger = new Logger(SecretManagementService.name);
  private readonly serviceName = 'taptik-cli';
  private readonly encryptionKey = this.generateEncryptionKey();

  private readonly secretPatterns: SecretPattern[] = [
    {
      name: 'API Key',
      pattern: /(?:api[_-]?key|apikey|key)[\s"':]*["']*([\w-]{20,})["']*$/im,
      type: 'api_key',
      description: 'Generic API key pattern',
      confidence: 0.8,
    },
    {
      name: 'Bearer Token',
      pattern:
        /(?:bearer[\s_]?token|authorization)[\s"':]*["']*(?:bearer\s+)?([\w.-]{20,})["']*$/im,
      type: 'token',
      description: 'Bearer token pattern',
      confidence: 0.9,
    },
    {
      name: 'JWT Token',
      pattern: /(?:eyJ[\w-]*\.){2}[\w-]*/g,
      type: 'token',
      description: 'JWT token pattern',
      confidence: 0.95,
    },
    {
      name: 'Password',
      pattern: /(?:password|passwd|pwd)[\s"':]*["']*([^\s"']{8,})["']*$/im,
      type: 'password',
      description: 'Password field pattern',
      confidence: 0.7,
    },
    {
      name: 'Connection String',
      pattern:
        /(?:connection[\s_]?string|conn[\s_]?str)[\s"':]*["']*([^\s"']{20,})["']*$/im,
      type: 'connection_string',
      description: 'Database connection string',
      confidence: 0.8,
    },
    {
      name: 'Private Key',
      pattern:
        /-{5}BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-{5}[\S\s]*?-{5}END\s+(?:RSA\s+)?PRIVATE\s+KEY-{5}/g,
      type: 'private_key',
      description: 'PEM private key',
      confidence: 1,
    },
    {
      name: 'GitHub Token',
      pattern: /gh[ps]_\w{36,}/g,
      type: 'token',
      description: 'GitHub personal access token',
      confidence: 0.99,
    },
    {
      name: 'AWS Access Key',
      pattern: /AKIA[\dA-Z]{16}/g,
      type: 'api_key',
      description: 'AWS access key ID',
      confidence: 0.99,
    },
    {
      name: 'Secret Key',
      pattern: /(?:secret[\s_]?key|secretkey)[\s"':]*["']*([\w-]{20,})["']*$/im,
      type: 'encryption_key',
      description: 'Generic secret key pattern',
      confidence: 0.8,
    },
  ];

  /**
   * Detects secrets in configuration object
   */
  async detectSecrets(config: unknown, path = ''): Promise<DetectedSecret[]> {
    const secrets: DetectedSecret[] = [];

    try {
      if (config === null || config === undefined) {
        return secrets;
      }

      if (typeof config === 'string') {
        const detectedInString = this.detectSecretsInString(config, path);
        secrets.push(...detectedInString);
      } else if (Array.isArray(config)) {
        const arrayResults = await Promise.all(
          config.map(async (item, i) => {
            const arrayPath = path ? `${path}[${i}]` : `[${i}]`;
            return this.detectSecrets(item, arrayPath);
          }),
        );
        secrets.push(...arrayResults.flat());
      } else if (typeof config === 'object') {
        const entries = Object.entries(config);
        const entryResults = await Promise.all(
          entries.map(async ([key, value]) => {
            const keyPath = path ? `${path}.${key}` : key;

            // Check if the key itself suggests a secret
            if (
              this.isSecretKey(key) &&
              typeof value === 'string' &&
              value.length > 0
            ) {
              return [
                {
                  key,
                  value: value as string,
                  path: keyPath,
                  type: this.inferSecretType(key),
                  confidence: this.calculateConfidence(key, value as string),
                },
              ];
            } else {
              // Recursively check nested values
              return this.detectSecrets(value, keyPath);
            }
          }),
        );
        secrets.push(...entryResults.flat());
      }

      return secrets;
    } catch (error) {
      this.logger.warn(
        `Failed to detect secrets at path ${path}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return secrets;
    }
  }

  /**
   * Stores a secret securely in system keychain
   */
  async storeSecret(
    secretId: string,
    value: string,
    metadata: SecretMetadata,
  ): Promise<string> {
    try {
      const keytarInstance = await loadKeytar();
      if (!keytarInstance) {
        throw new Error('System keychain not available');
      }

      const fullSecretId = `taptik:${secretId}`;
      const secretData: SecretStorage = {
        secretId,
        value: metadata.encrypted ? this.encrypt(value) : value,
        metadata: {
          ...metadata,
          createdAt: new Date(),
          accessed: 0,
        },
      };

      await keytarInstance.setPassword(
        this.serviceName,
        fullSecretId,
        JSON.stringify(secretData),
      );

      this.logger.log(`Successfully stored secret: ${secretId}`);
      return fullSecretId;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to store secret ${secretId}: ${message}`);
      throw new Error(`Failed to store secret: ${message}`);
    }
  }

  /**
   * Retrieves a secret from system keychain
   */
  async retrieveSecret(secretId: string): Promise<string | null> {
    try {
      const keytarInstance = await loadKeytar();
      if (!keytarInstance) {
        this.logger.warn(
          'System keychain not available, checking environment variables',
        );
        return process.env[secretId] || null;
      }

      const fullSecretId = `taptik:${secretId}`;
      const storedData = await keytarInstance.getPassword(
        this.serviceName,
        fullSecretId,
      );

      if (!storedData) {
        return null;
      }

      const secretStorage: SecretStorage = JSON.parse(storedData);

      // Check expiration
      if (
        secretStorage.metadata.expiresAt &&
        new Date() > new Date(secretStorage.metadata.expiresAt)
      ) {
        this.logger.warn(`Secret ${secretId} has expired, removing`);
        await this.deleteSecret(secretId);
        return null;
      }

      // Update access tracking
      secretStorage.metadata.lastAccessed = new Date();
      secretStorage.metadata.accessed =
        (secretStorage.metadata.accessed || 0) + 1;
      await keytarInstance.setPassword(
        this.serviceName,
        fullSecretId,
        JSON.stringify(secretStorage),
      );

      // Decrypt if necessary
      const value = secretStorage.metadata.encrypted
        ? this.decrypt(secretStorage.value)
        : secretStorage.value;

      return value;
    } catch (error) {
      this.logger.warn(
        `Failed to retrieve secret ${secretId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return null;
    }
  }

  /**
   * Deletes a secret from keychain
   */
  async deleteSecret(secretId: string): Promise<boolean> {
    try {
      const keytarInstance = await loadKeytar();
      if (!keytarInstance) {
        return false;
      }

      const fullSecretId = `taptik:${secretId}`;
      const deleted = await keytarInstance.deletePassword(
        this.serviceName,
        fullSecretId,
      );

      if (deleted) {
        this.logger.log(`Successfully deleted secret: ${secretId}`);
      }

      return deleted;
    } catch (error) {
      this.logger.error(
        `Failed to delete secret ${secretId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return false;
    }
  }

  /**
   * Injects secrets as environment variables
   */
  async injectEnvironmentVariables(
    secrets: EnvironmentSecret[],
  ): Promise<void> {
    const results = await Promise.all(
      secrets.map(async (secret) => {
        if (!this.isValidEnvironmentVariableName(secret.key)) {
          throw new Error(`Invalid environment variable name: ${secret.key}`);
        }

        const value = await this.retrieveSecret(secret.secretId);

        if (value === null) {
          if (secret.required !== false) {
            throw new Error(`Failed to retrieve secret: ${secret.secretId}`);
          }
          this.logger.warn(`Optional secret not found: ${secret.secretId}`);
          return null;
        }

        return { key: secret.key, value };
      }),
    );

    for (const result of results) {
      if (result) {
        process.env[result.key] = result.value;
        this.logger.debug(`Injected environment variable: ${result.key}`);
      }
    }
  }

  /**
   * Clears environment variables
   */
  clearEnvironmentVariables(keys: string[]): void {
    for (const key of keys) {
      delete process.env[key];
    }
  }

  /**
   * Rotates a secret if needed
   */
  async rotateSecret(
    secretId: string,
    newValue: string,
    policy: RotationPolicy,
  ): Promise<boolean> {
    try {
      const currentSecret = await this.getSecretMetadata(secretId);

      if (!currentSecret) {
        this.logger.warn(`Secret ${secretId} not found for rotation`);
        return false;
      }

      const now = new Date();
      const age =
        now.getTime() - new Date(currentSecret.createdAt || 0).getTime();

      // Check if rotation is needed
      if (age < policy.maxAge && !policy.rotateOnAccess) {
        this.logger.debug(
          `Secret ${secretId} is still fresh, skipping rotation`,
        );
        return false;
      }

      // Backup old secret if requested
      if (policy.backupCount && policy.backupCount > 0) {
        await this.backupSecret(secretId, policy.backupCount);
      }

      // Store new secret
      await this.storeSecret(secretId, newValue, {
        ...currentSecret,
        createdAt: now,
        lastAccessed: undefined,
        accessed: 0,
      });

      this.logger.log(`Successfully rotated secret: ${secretId}`);
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to rotate secret ${secretId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return false;
    }
  }

  /**
   * Generates audit log of all secrets
   */
  async auditSecrets(): Promise<SecretAuditEntry[]> {
    const auditEntries: SecretAuditEntry[] = [];

    try {
      const keytarInstance = await loadKeytar();
      if (!keytarInstance) {
        this.logger.warn('Keychain not available for audit');
        return auditEntries;
      }

      const credentials = await keytarInstance.findCredentials(
        this.serviceName,
      );

      for (const credential of credentials) {
        try {
          const secretId = credential.account.replace('taptik:', '');
          const secretData: SecretStorage = JSON.parse(credential.password);

          const entry: SecretAuditEntry = {
            secretId,
            status: this.determineSecretStatus(secretData),
            createdAt: new Date(secretData.metadata.createdAt || 0),
            lastAccessed: secretData.metadata.lastAccessed
              ? new Date(secretData.metadata.lastAccessed)
              : undefined,
            expiresAt: secretData.metadata.expiresAt
              ? new Date(secretData.metadata.expiresAt)
              : undefined,
            accessCount: secretData.metadata.accessed || 0,
            issues: [],
            recommendations: [],
          };

          // Add issues and recommendations
          this.analyzeSecretHealth(entry, secretData);

          auditEntries.push(entry);
        } catch (error) {
          this.logger.warn(
            `Failed to audit secret ${credential.account}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          );
        }
      }

      return auditEntries;
    } catch (error) {
      this.logger.error(
        `Failed to generate audit log: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return auditEntries;
    }
  }

  /**
   * Sanitizes configuration by replacing secrets with placeholders
   */
  async sanitizeConfiguration(
    config: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const { sanitized } = await this.sanitizeConfigurationWithMapping(config);
    return sanitized;
  }

  /**
   * Sanitizes configuration and returns mapping for restoration
   */
  async sanitizeConfigurationWithMapping(
    config: Record<string, unknown>,
  ): Promise<SanitizationResult> {
    const secrets = await this.detectSecrets(config);
    const secretMapping: SecretMapping[] = [];
    const sanitized = JSON.parse(JSON.stringify(config)); // Deep clone

    for (const secret of secrets) {
      const placeholder = `\${SECRET:${secret.path}}`;
      const secretId = randomUUID();

      // Replace the secret value with placeholder
      this.setValueAtPath(sanitized, secret.path, placeholder);

      secretMapping.push({
        path: secret.path,
        placeholder,
        secretId,
        value: secret.value,
      });
    }

    return { sanitized, secretMapping };
  }

  private detectSecretsInString(value: string, path: string): DetectedSecret[] {
    const secrets: DetectedSecret[] = [];

    for (const pattern of this.secretPatterns) {
      const matches = value.match(pattern.pattern);
      if (matches) {
        for (const match of matches) {
          secrets.push({
            key: path.split('.').pop() || path,
            value: match,
            path,
            type: pattern.type,
            confidence: pattern.confidence,
          });
        }
      }
    }

    return secrets;
  }

  private isSecretKey(key: string): boolean {
    const secretKeywords = [
      'password',
      'passwd',
      'pwd',
      'secret',
      'key',
      'token',
      'auth',
      'credential',
      'api_key',
      'apikey',
      'access_key',
      'private_key',
      'jwt',
      'bearer',
    ];

    const lowerKey = key.toLowerCase();
    return secretKeywords.some((keyword) => lowerKey.includes(keyword));
  }

  private inferSecretType(key: string): SecretType {
    const lowerKey = key.toLowerCase();

    if (lowerKey.includes('password') || lowerKey.includes('passwd'))
      return 'password';
    if (lowerKey.includes('token') || lowerKey.includes('bearer'))
      return 'token';
    if (lowerKey.includes('api') && lowerKey.includes('key')) return 'api_key';
    if (lowerKey.includes('private') && lowerKey.includes('key'))
      return 'private_key';
    if (lowerKey.includes('connection') || lowerKey.includes('conn'))
      return 'connection_string';
    if (lowerKey.includes('webhook')) return 'webhook_secret';
    if (lowerKey.includes('cert')) return 'certificate';

    return 'unknown';
  }

  private calculateConfidence(key: string, value: string): number {
    let confidence = 0.5; // Base confidence

    // Increase confidence based on key patterns
    if (this.isSecretKey(key)) confidence += 0.3;

    // Increase confidence based on value patterns
    if (value.length >= 20) confidence += 0.1;
    if (value.length >= 40) confidence += 0.1;
    if (/[A-Z]/.test(value) && /[a-z]/.test(value) && /\d/.test(value))
      confidence += 0.1;

    return Math.min(confidence, 1);
  }

  private async isKeychainAvailable(): Promise<boolean> {
    const keytarInstance = await loadKeytar();
    return keytarInstance !== undefined;
  }

  private isValidEnvironmentVariableName(name: string): boolean {
    return /^[_a-z]\w*$/i.test(name);
  }

  private generateEncryptionKey(): string {
    // In production, this should be derived from a more secure source
    return crypto
      .scryptSync('taptik-cli-secret-key', 'salt', 32)
      .toString('hex');
  }

  private encrypt(value: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      'aes-256-cbc',
      Buffer.from(this.encryptionKey, 'hex'),
      iv,
    );
    let encrypted = cipher.update(value, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `encrypted:${iv.toString('hex')}:${encrypted}`;
  }

  private decrypt(encryptedValue: string): string {
    if (!encryptedValue.startsWith('encrypted:')) {
      return encryptedValue;
    }

    const parts = encryptedValue.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted value format');
    }

    const iv = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      Buffer.from(this.encryptionKey, 'hex'),
      iv,
    );
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  private async getSecretMetadata(
    secretId: string,
  ): Promise<SecretMetadata | null> {
    try {
      const keytarInstance = await loadKeytar();
      if (!keytarInstance) {
        return null;
      }

      const fullSecretId = `taptik:${secretId}`;
      const storedData = await keytarInstance.getPassword(
        this.serviceName,
        fullSecretId,
      );

      if (!storedData) {
        return null;
      }

      const secretStorage: SecretStorage = JSON.parse(storedData);
      return secretStorage.metadata;
    } catch {
      return null;
    }
  }

  private async backupSecret(
    secretId: string,
    backupCount: number,
  ): Promise<void> {
    const current = await this.retrieveSecret(secretId);
    if (!current) return;

    const backupId = `${secretId}.backup.${Date.now()}`;
    const metadata = await this.getSecretMetadata(secretId);

    if (metadata) {
      await this.storeSecret(backupId, current, {
        ...metadata,
        description: `Backup of ${secretId}`,
        tags: [...(metadata.tags || []), 'backup'],
      });

      // Clean up old backups if needed
      await this.cleanupOldBackups(secretId, backupCount);
    }
  }

  private async cleanupOldBackups(
    secretId: string,
    maxBackups: number,
  ): Promise<void> {
    const keytarInstance = await loadKeytar();
    if (!keytarInstance) return;

    try {
      const credentials = await keytarInstance.findCredentials(
        this.serviceName,
      );
      const backups = credentials
        .filter((cred) => cred.account.includes(`${secretId}.backup`))
        .map((cred) => ({
          account: cred.account,
          timestamp: Number.parseInt(
            cred.account.split('.backup.')[1] || '0',
            10,
          ),
        }))
        .sort((a, b) => b.timestamp - a.timestamp);

      // Remove old backups beyond the limit
      const deletePromises = backups
        .slice(maxBackups)
        .map((backup) =>
          keytarInstance.deletePassword(this.serviceName, backup.account),
        );
      await Promise.all(deletePromises);
    } catch (error) {
      this.logger.warn(
        `Failed to cleanup old backups: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  private determineSecretStatus(secretData: SecretStorage): SecretStatus {
    const now = new Date();

    // Check if expired
    if (
      secretData.metadata.expiresAt &&
      now > new Date(secretData.metadata.expiresAt)
    ) {
      return 'expired';
    }

    // Check if unused (not accessed in 30 days)
    const lastAccessed = secretData.metadata.lastAccessed
      ? new Date(secretData.metadata.lastAccessed)
      : new Date(secretData.metadata.createdAt || 0);
    const daysSinceAccess =
      (now.getTime() - lastAccessed.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceAccess > 30 && (secretData.metadata.accessed || 0) === 0) {
      return 'unused';
    }

    return 'active';
  }

  private analyzeSecretHealth(
    entry: SecretAuditEntry,
    _secretData: SecretStorage,
  ): void {
    const now = new Date();

    // Check expiration
    if (entry.expiresAt && now > entry.expiresAt) {
      entry.issues.push('Secret has expired');
      entry.recommendations.push('Rotate or delete expired secret');
    } else if (entry.expiresAt) {
      const daysUntilExpiry =
        (entry.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      if (daysUntilExpiry < 7) {
        entry.issues.push('Secret expires soon');
        entry.recommendations.push('Plan secret rotation');
      }
    }

    // Check usage
    if (entry.accessCount === 0) {
      const daysSinceCreation =
        (now.getTime() - entry.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceCreation > 7) {
        entry.issues.push('Secret has not been accessed recently');
        entry.recommendations.push('Consider removing unused secret');
      }
    }

    // Check age
    const ageInDays =
      (now.getTime() - entry.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    if (ageInDays > 90) {
      entry.issues.push('Secret is old and may need rotation');
      entry.recommendations.push('Consider rotating old secret');
    }
  }

  private setValueAtPath(
    object: Record<string, unknown>,
    path: string,
    value: unknown,
  ): void {
    const keys = path.split('.');
    let current = object;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current)) {
        current[key] = {};
      }
      current = current[key] as Record<string, unknown>;
    }

    const lastKey = keys.at(-1);
    if (lastKey) {
      current[lastKey] = value;
    }
  }
}
