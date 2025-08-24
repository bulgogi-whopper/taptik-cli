export interface SecretMetadata {
  service: string;
  description?: string;
  createdAt?: Date;
  expiresAt?: Date;
  lastAccessed?: Date;
  accessed?: number;
  encrypted?: boolean;
  tags?: string[];
}

export interface SecretStorage {
  secretId: string;
  value: string;
  metadata: SecretMetadata;
}

export interface DetectedSecret {
  key: string;
  value: string;
  path: string;
  type: SecretType;
  confidence: number; // 0-1 confidence score
}

export interface EnvironmentSecret {
  key: string;
  secretId: string;
  required?: boolean;
}

export interface RotationPolicy {
  maxAge: number; // milliseconds
  rotateOnAccess?: boolean;
  backupCount?: number;
  notificationThreshold?: number; // days before expiration
}

export interface SecretAuditEntry {
  secretId: string;
  status: SecretStatus;
  createdAt: Date;
  lastAccessed?: Date;
  expiresAt?: Date;
  accessCount: number;
  issues: string[];
  recommendations: string[];
}

export interface SecretMapping {
  path: string;
  placeholder: string;
  secretId: string;
  value: string;
}

export interface SanitizationResult {
  sanitized: Record<string, unknown>;
  secretMapping: SecretMapping[];
}

export type SecretType =
  | 'api_key'
  | 'token'
  | 'password'
  | 'connection_string'
  | 'private_key'
  | 'certificate'
  | 'webhook_secret'
  | 'encryption_key'
  | 'unknown';

export type SecretStatus =
  | 'active'
  | 'expired'
  | 'unused'
  | 'corrupted'
  | 'missing';

export interface SecretPattern {
  name: string;
  pattern: RegExp;
  type: SecretType;
  description: string;
  confidence: number;
}
