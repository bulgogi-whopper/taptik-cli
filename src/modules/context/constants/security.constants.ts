/**
 * Security-related constants and patterns
 */

export enum SecuritySeverity {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info',
}

export enum SecurityAction {
  REMOVED = 'removed',
  MASKED = 'masked',
  FLAGGED = 'flagged',
  ENCRYPTED = 'encrypted',
  IGNORED = 'ignored',
}

export enum SensitiveDataType {
  API_KEY = 'api_key',
  SECRET = 'secret',
  PASSWORD = 'password',
  TOKEN = 'token',
  PRIVATE_KEY = 'private_key',
  ACCESS_KEY = 'access_key',
  DATABASE_URL = 'database_url',
  CREDENTIAL = 'credential',
  CERTIFICATE = 'certificate',
  SSH_KEY = 'ssh_key',
}

/**
 * Security patterns for detecting sensitive data
 */
export const SECURITY_PATTERNS: Record<SensitiveDataType, RegExp> = {
  [SensitiveDataType.API_KEY]:
    /(?:api[_-]?key|apikey)[\s:=]["']?([\w-]+)["']?/gi,
  [SensitiveDataType.SECRET]:
    /(?:secret|client[_-]?secret)[\s:=]["']?([\w#$%&()-+=@^]+)["']?/gi,
  [SensitiveDataType.PASSWORD]:
    /(?:password|passwd|pwd)[\s:=]["']?([\w#$%&()-+=@^]+)["']?/gi,
  [SensitiveDataType.TOKEN]:
    /(?:token|auth[_-]?token|bearer)[\s:=]["']?([\w.-]+)["']?/gi,
  [SensitiveDataType.PRIVATE_KEY]:
    /-{5}begin\s+(?:rsa\s+)?private\s+key-{5}[\S\s]*?-{5}end\s+(?:rsa\s+)?private\s+key-{5}/gi,
  [SensitiveDataType.ACCESS_KEY]:
    /(?:access[_-]?key|accesskey)[\s:=]["']?([\w-]+)["']?/gi,
  [SensitiveDataType.DATABASE_URL]:
    /(?:database[_-]?url|db[_-]?url|connection[_-]?string)[\s:=]["']?((?:mongodb|mysql|postgres|postgresql|redis|sqlite):\/\/[^\s"']+)["']?/gi,
  [SensitiveDataType.CREDENTIAL]:
    /(?:credential|cred)s?[\s:=]["']?([\w.-]+)["']?/gi,
  [SensitiveDataType.CERTIFICATE]:
    /-{5}begin\s+certificate-{5}[\S\s]*?-{5}end\s+certificate-{5}/gi,
  [SensitiveDataType.SSH_KEY]: /ssh-(?:rsa|ed25519|ecdsa|dss)\s+[\w+/]+=*/gi,
} as const;

/**
 * Environment variable patterns that should be masked
 */
export const SENSITIVE_ENV_VARS = [
  'API_KEY',
  'SECRET',
  'PASSWORD',
  'TOKEN',
  'ACCESS_KEY',
  'PRIVATE_KEY',
  'DATABASE_URL',
  'DB_URL',
  'CONNECTION_STRING',
  'SUPABASE_KEY',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_KEY',
  'JWT_SECRET',
  'SESSION_SECRET',
  'ENCRYPTION_KEY',
  'SIGNING_KEY',
  'CLIENT_SECRET',
  'REFRESH_TOKEN',
] as const;

/**
 * File patterns that commonly contain sensitive data
 */
export const SENSITIVE_FILE_PATTERNS = [
  '**/.env*',
  '**/*.key',
  '**/*.pem',
  '**/*.p12',
  '**/*.pfx',
  '**/secrets.*',
  '**/credentials.*',
  '**/*secret*',
  '**/*password*',
  '**/.npmrc',
  '**/.yarnrc',
  '**/.docker/config.json',
  '**/id_rsa*',
  '**/id_dsa*',
  '**/id_ecdsa*',
  '**/id_ed25519*',
] as const;

/**
 * Fields in JSON that should be masked
 */
export const SENSITIVE_JSON_FIELDS = [
  'password',
  'secret',
  'token',
  'apiKey',
  'api_key',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'privateKey',
  'private_key',
  'clientSecret',
  'client_secret',
  'authToken',
  'auth_token',
  'sessionToken',
  'session_token',
  'bearerToken',
  'bearer_token',
  'databaseUrl',
  'database_url',
  'connectionString',
  'connection_string',
] as const;

/**
 * Security severity mappings
 */
export const SEVERITY_MAPPING: Record<SensitiveDataType, SecuritySeverity> = {
  [SensitiveDataType.API_KEY]: SecuritySeverity.HIGH,
  [SensitiveDataType.SECRET]: SecuritySeverity.HIGH,
  [SensitiveDataType.PASSWORD]: SecuritySeverity.HIGH,
  [SensitiveDataType.PRIVATE_KEY]: SecuritySeverity.HIGH,
  [SensitiveDataType.ACCESS_KEY]: SecuritySeverity.HIGH,
  [SensitiveDataType.TOKEN]: SecuritySeverity.MEDIUM,
  [SensitiveDataType.DATABASE_URL]: SecuritySeverity.MEDIUM,
  [SensitiveDataType.CREDENTIAL]: SecuritySeverity.MEDIUM,
  [SensitiveDataType.CERTIFICATE]: SecuritySeverity.LOW,
  [SensitiveDataType.SSH_KEY]: SecuritySeverity.HIGH,
} as const;

/**
 * Masking strategies
 */
export const MASKING_STRATEGIES = {
  FULL: '[REDACTED]',
  PARTIAL: (value: string) => {
    if (value.length <= 8) return '[***]';
    return `${value.slice(0, 3)}...${value.slice(Math.max(0, value.length - 3))}`;
  },
  HASH: (value: string) =>
    // Simple hash representation (in real implementation, use crypto)
    `[HASH:${value.length}]`,
  TYPE: (type: SensitiveDataType) => `[${type.toUpperCase()}]`,
} as const;

/**
 * Security validation rules
 */
export const SECURITY_RULES = {
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  MAX_SECRET_LENGTH: 1024, // Maximum length for a secret value
  MIN_PASSWORD_LENGTH: 8,
  REQUIRE_ENCRYPTION_FOR: [
    SensitiveDataType.PRIVATE_KEY,
    SensitiveDataType.SSH_KEY,
    SensitiveDataType.PASSWORD,
  ],
} as const;

/**
 * Helper functions for security operations
 */
export function getSeverity(type: SensitiveDataType): SecuritySeverity {
  return SEVERITY_MAPPING[type] || SecuritySeverity.INFO;
}

export function shouldEncrypt(type: SensitiveDataType): boolean {
  const requireEncryption: SensitiveDataType[] = [
    SensitiveDataType.PRIVATE_KEY,
    SensitiveDataType.SSH_KEY,
    SensitiveDataType.PASSWORD,
  ];
  return requireEncryption.includes(type);
}

export function maskValue(
  value: string,
  strategy: 'FULL' | 'PARTIAL' | 'HASH' = 'FULL',
): string {
  if (strategy === 'FULL') return MASKING_STRATEGIES.FULL;
  if (strategy === 'PARTIAL') return MASKING_STRATEGIES.PARTIAL(value);
  if (strategy === 'HASH') return MASKING_STRATEGIES.HASH(value);
  return MASKING_STRATEGIES.FULL;
}

export function isSensitiveField(fieldName: string): boolean {
  const lowerField = fieldName.toLowerCase();
  return SENSITIVE_JSON_FIELDS.some((sensitive) =>
    lowerField.includes(sensitive.toLowerCase()),
  );
}

export function detectSensitiveType(content: string): SensitiveDataType | null {
  for (const [type, pattern] of Object.entries(SECURITY_PATTERNS)) {
    if (pattern.test(content)) {
      return type as SensitiveDataType;
    }
  }
  return null;
}
