# Push Module API Documentation

## Table of Contents

- [Services](#services)
- [Interfaces](#interfaces)
- [DTOs](#dtos)
- [Errors](#errors)
- [Events](#events)

## Services

### PushService

Main orchestrator service for package upload operations.

#### Methods

##### `pushPackage(options: PushOptions): Promise<PushResult>`

Uploads a package to Supabase cloud storage.

**Parameters:**
- `options: PushOptions` - Upload configuration options
  - `filePath: string` - Path to the .taptik package file
  - `userId: string` - User identifier
  - `isPublic?: boolean` - Make package publicly accessible (default: false)
  - `title?: string` - Package title
  - `description?: string` - Package description
  - `tags?: string[]` - User-defined tags
  - `teamId?: string` - Team identifier for collaborative packages
  - `version?: string` - Override package version
  - `force?: boolean` - Overwrite existing package
  - `dryRun?: boolean` - Simulate upload without executing

**Returns:**
```typescript
interface PushResult {
  success: boolean;
  packageId?: string;
  configId?: string;
  message?: string;
  error?: PushError;
  sanitizationReport?: SanitizationReport;
}
```

**Example:**
```typescript
const result = await pushService.pushPackage({
  filePath: '/path/to/package.taptik',
  userId: 'user-123',
  isPublic: true,
  title: 'My Package',
  tags: ['vim', 'config']
});
```

##### `processQueue(): Promise<void>`

Processes the offline upload queue, retrying failed uploads.

**Example:**
```typescript
await pushService.processQueue();
```

##### `deletePackage(configId: string, userId: string): Promise<void>`

Deletes a package from cloud storage and database.

**Parameters:**
- `configId: string` - Package configuration identifier
- `userId: string` - User identifier for authorization

**Example:**
```typescript
await pushService.deletePackage('config-123', 'user-123');
```

### CloudUploadService

Handles chunked and resumable uploads to Supabase Storage.

#### Methods

##### `uploadPackage(buffer: Buffer, fileName: string, userId: string, onProgress?: ProgressCallback): Promise<UploadResult>`

Uploads a package with chunked transfer and progress tracking.

**Parameters:**
- `buffer: Buffer` - Package data
- `fileName: string` - Original file name
- `userId: string` - User identifier
- `onProgress?: ProgressCallback` - Progress callback function

**Returns:**
```typescript
interface UploadResult {
  storageUrl: string;
  checksum: string;
  size: number;
  chunks?: number;
}
```

##### `resumeUpload(uploadId: string, remainingChunks: Buffer[], startChunk: number): Promise<UploadResult>`

Resumes an interrupted upload from the last successful chunk.

**Parameters:**
- `uploadId: string` - Upload session identifier
- `remainingChunks: Buffer[]` - Remaining data chunks
- `startChunk: number` - Index of first chunk to upload

### PackageRegistryService

Database operations for package metadata management.

#### Methods

##### `registerPackage(metadata: PackageMetadata): Promise<void>`

Registers a new package in the database.

**Parameters:**
- `metadata: PackageMetadata` - Complete package metadata

##### `listUserPackages(userId: string, filters?: ListFilters): Promise<PackageMetadata[]>`

Lists packages for a specific user with optional filtering.

**Parameters:**
- `userId: string` - User identifier
- `filters?: ListFilters` - Optional filtering criteria
  - `platform?: string` - Filter by platform
  - `isPublic?: boolean` - Filter by visibility
  - `tags?: string[]` - Filter by tags
  - `teamId?: string` - Filter by team
  - `sortBy?: 'created_at' | 'updated_at' | 'download_count'`
  - `sortOrder?: 'asc' | 'desc'`
  - `limit?: number` - Maximum results
  - `offset?: number` - Pagination offset

##### `updatePackage(configId: string, updates: Partial<PackageMetadata>): Promise<void>`

Updates package metadata.

**Parameters:**
- `configId: string` - Package configuration identifier
- `updates: Partial<PackageMetadata>` - Fields to update

##### `getPackageByConfigId(configId: string): Promise<PackageMetadata | null>`

Retrieves a package by its configuration ID.

**Parameters:**
- `configId: string` - Package configuration identifier

**Returns:**
- `PackageMetadata | null` - Package metadata or null if not found

### SanitizationService

Removes sensitive data from packages before upload.

#### Methods

##### `sanitizePackage(buffer: Buffer, fileName: string, platform: PlatformConfig): Promise<SanitizationResult>`

Sanitizes a package by removing sensitive data.

**Parameters:**
- `buffer: Buffer` - Original package data
- `fileName: string` - Package file name
- `platform: PlatformConfig` - Platform configuration

**Returns:**
```typescript
interface SanitizationResult {
  sanitized: Buffer;
  report: SanitizationReport;
}

interface SanitizationReport {
  removed: string[];
  masked: string[];
  removedCount: number;
  maskedCount: number;
  detectedPatterns: string[];
  classifications: string[];
  autoTags: string[];
}
```

### SecurityValidatorService

Validates input for security threats and malicious content.

#### Methods

##### `validateInput(input: unknown, fieldName: string): SecurityValidationResult`

Validates user input for injection attempts and malicious patterns.

**Parameters:**
- `input: unknown` - Input to validate
- `fieldName: string` - Field name for error reporting

**Returns:**
```typescript
interface SecurityValidationResult {
  isValid: boolean;
  issues: SecurityIssue[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  sanitizedValue?: any;
}
```

##### `detectMaliciousContent(buffer: Buffer): SecurityValidationResult`

Detects malicious content in binary data.

**Parameters:**
- `buffer: Buffer` - Binary data to scan

##### `validateFilePath(filePath: string): SecurityValidationResult`

Validates file paths for traversal attempts and suspicious patterns.

**Parameters:**
- `filePath: string` - File path to validate

### RateLimiterService

Enforces upload and bandwidth limits based on user tier.

#### Methods

##### `checkLimit(userId: string, tier: UserTier): Promise<RateLimitResult>`

Checks if user has exceeded rate limits.

**Parameters:**
- `userId: string` - User identifier
- `tier: UserTier` - User subscription tier

**Returns:**
```typescript
interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  limit: number;
}
```

##### `recordUpload(userId: string, size: number): Promise<void>`

Records an upload for rate limit tracking.

**Parameters:**
- `userId: string` - User identifier
- `size: number` - Upload size in bytes

### LocalQueueService

Manages offline upload queue for resilient operations.

#### Methods

##### `addToQueue(upload: QueuedUpload): Promise<void>`

Adds a failed upload to the retry queue.

**Parameters:**
- `upload: QueuedUpload` - Upload metadata and configuration

##### `processQueue(): Promise<ProcessQueueResult>`

Processes all queued uploads with retry logic.

**Returns:**
```typescript
interface ProcessQueueResult {
  processed: number;
  successful: number;
  failed: number;
  remaining: number;
}
```

##### `getQueueStatus(): Promise<QueueStatus>`

Gets current queue status and statistics.

**Returns:**
```typescript
interface QueueStatus {
  count: number;
  oldestItem?: Date;
  totalSize: number;
  items: QueuedUpload[];
}
```

### AnalyticsService

Tracks usage metrics and generates insights.

#### Methods

##### `trackEvent(event: AnalyticsEvent): Promise<void>`

Records an analytics event.

**Parameters:**
- `event: AnalyticsEvent` - Event to track
  - `type: 'upload' | 'download' | 'view' | 'like' | 'share'`
  - `packageId: string`
  - `userId?: string`
  - `metadata?: Record<string, any>`
  - `timestamp?: Date`

##### `getPackageStatistics(packageId: string, period?: TimePeriod): Promise<PackageStats>`

Gets statistics for a specific package.

**Parameters:**
- `packageId: string` - Package identifier
- `period?: TimePeriod` - Time period for statistics

**Returns:**
```typescript
interface PackageStats {
  downloads: number;
  views: number;
  likes: number;
  shares: number;
  uniqueUsers: number;
  topRegions: string[];
  dailyTrend: TrendData[];
}
```

### AuditLoggerService

Comprehensive audit logging for security and compliance.

#### Methods

##### `logPackageUpload(userId: string, packageMetadata: PackageMetadata, securityContext: SecurityContext, duration: number, success: boolean, error?: Error): Promise<void>`

Logs a package upload operation.

**Parameters:**
- `userId: string` - User identifier
- `packageMetadata: PackageMetadata` - Package metadata
- `securityContext: SecurityContext` - Security context information
- `duration: number` - Operation duration in milliseconds
- `success: boolean` - Operation success status
- `error?: Error` - Error if operation failed

##### `logSecurityEvent(event: SecurityEvent): Promise<void>`

Logs a security-related event.

**Parameters:**
- `event: SecurityEvent` - Security event details

### SecureStorageService

Platform-specific secure credential storage.

#### Methods

##### `storeCredential(namespace: string, key: string, value: string, encrypt?: boolean, ttlSeconds?: number): Promise<void>`

Stores a credential securely.

**Parameters:**
- `namespace: string` - Credential namespace
- `key: string` - Credential key
- `value: string` - Credential value
- `encrypt?: boolean` - Whether to encrypt (default: true)
- `ttlSeconds?: number` - Time to live in seconds

##### `getCredential(namespace: string, key: string, decrypt?: boolean): Promise<string | null>`

Retrieves a stored credential.

**Parameters:**
- `namespace: string` - Credential namespace
- `key: string` - Credential key
- `decrypt?: boolean` - Whether to decrypt (default: true)

**Returns:**
- `string | null` - Credential value or null if not found

### OperationLockService

File-based locking for concurrent operation protection.

#### Methods

##### `acquireLock(operation: string, resourceId: string, userId?: string, timeout?: number): Promise<boolean>`

Acquires a lock for an operation.

**Parameters:**
- `operation: string` - Operation type
- `resourceId: string` - Resource identifier
- `userId?: string` - User identifier
- `timeout?: number` - Lock timeout in milliseconds

**Returns:**
- `boolean` - True if lock acquired, false otherwise

##### `releaseLock(operation: string, resourceId: string, userId?: string): Promise<void>`

Releases a previously acquired lock.

**Parameters:**
- `operation: string` - Operation type
- `resourceId: string` - Resource identifier
- `userId?: string` - User identifier

## Interfaces

### PackageMetadata

Complete package metadata structure.

```typescript
interface PackageMetadata {
  id?: string;
  configId: string;
  userId: string;
  name: string;
  title?: string;
  description?: string;
  platform: string;
  version: string;
  isPublic: boolean;
  userTags?: string[];
  autoTags?: string[];
  sanitizationLevel?: SanitizationLevel;
  checksum: string;
  storageUrl: string;
  packageSize: number;
  downloadCount?: number;
  createdAt?: Date;
  updatedAt?: Date;
  teamId?: string;
  likes?: number;
  views?: number;
}
```

### PushOptions

Configuration options for package upload.

```typescript
interface PushOptions {
  filePath: string;
  userId: string;
  isPublic?: boolean;
  title?: string;
  description?: string;
  tags?: string[];
  teamId?: string;
  version?: string;
  force?: boolean;
  dryRun?: boolean;
  skipSanitization?: boolean;
  skipValidation?: boolean;
}
```

### QueuedUpload

Queued upload metadata for offline support.

```typescript
interface QueuedUpload {
  id: string;
  filePath: string;
  options: PushOptions;
  retryCount: number;
  lastError?: string;
  createdAt: Date;
  nextRetryAt: Date;
  status: 'pending' | 'processing' | 'failed';
}
```

### SecurityContext

Security context for audit logging.

```typescript
interface SecurityContext {
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  authMethod?: string;
  riskScore?: number;
  threatIndicators?: string[];
}
```

## DTOs

### CreatePackageDto

Data transfer object for package creation.

```typescript
class CreatePackageDto {
  @IsString()
  @IsNotEmpty()
  configId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isPublic?: boolean = false;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsString()
  @IsOptional()
  teamId?: string;

  @IsString()
  @IsOptional()
  version?: string;
}
```

### UpdatePackageDto

Data transfer object for package updates.

```typescript
class UpdatePackageDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];
}
```

### ListPackagesDto

Data transfer object for package listing.

```typescript
class ListPackagesDto {
  @IsString()
  @IsOptional()
  platform?: string;

  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsString()
  @IsOptional()
  teamId?: string;

  @IsEnum(['created_at', 'updated_at', 'download_count'])
  @IsOptional()
  sortBy?: string = 'created_at';

  @IsEnum(['asc', 'desc'])
  @IsOptional()
  sortOrder?: string = 'desc';

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsNumber()
  @IsOptional()
  @Min(0)
  offset?: number = 0;
}
```

## Errors

### PushError

Custom error class for push operations.

```typescript
class PushError extends Error {
  constructor(
    public code: string,
    message: string,
    public context?: PushErrorContext,
    public cause?: Error
  ) {
    super(message);
    this.name = 'PushError';
  }

  get retryable(): boolean {
    return RETRYABLE_ERROR_CODES.includes(this.code);
  }

  get category(): ErrorCategory {
    return categorizeErrorCode(this.code);
  }
}
```

### Error Codes

| Code | Category | Description | Retryable |
|------|----------|-------------|-----------|
| `PUSH_AUTH_001` | Authentication | Not authenticated | No |
| `PUSH_AUTH_002` | Authentication | Invalid credentials | No |
| `PUSH_AUTH_003` | Authentication | Session expired | Yes |
| `PUSH_VAL_001` | Validation | Invalid package format | No |
| `PUSH_VAL_002` | Validation | Package too large | No |
| `PUSH_VAL_003` | Validation | Missing required fields | No |
| `PUSH_VAL_004` | Validation | Invalid checksum | No |
| `PUSH_SEC_001` | Security | Malicious content detected | No |
| `PUSH_SEC_002` | Security | Sensitive data detected | No |
| `PUSH_SEC_003` | Security | Injection attempt detected | No |
| `PUSH_SEC_004` | Security | Unauthorized access | No |
| `PUSH_NET_001` | Network | Connection timeout | Yes |
| `PUSH_NET_002` | Network | Upload failed | Yes |
| `PUSH_NET_003` | Network | Server unavailable | Yes |
| `PUSH_RATE_001` | RateLimit | Upload limit exceeded | Yes |
| `PUSH_RATE_002` | RateLimit | Bandwidth limit exceeded | Yes |
| `PUSH_SYS_001` | System | Internal server error | Yes |
| `PUSH_SYS_002` | System | Database error | Yes |
| `PUSH_SYS_003` | System | Storage error | Yes |

## Events

### Package Events

The push module emits the following events:

#### `package.uploaded`

Emitted when a package is successfully uploaded.

```typescript
interface PackageUploadedEvent {
  packageId: string;
  configId: string;
  userId: string;
  size: number;
  timestamp: Date;
}
```

#### `package.deleted`

Emitted when a package is deleted.

```typescript
interface PackageDeletedEvent {
  packageId: string;
  configId: string;
  userId: string;
  timestamp: Date;
}
```

#### `package.updated`

Emitted when package metadata is updated.

```typescript
interface PackageUpdatedEvent {
  packageId: string;
  configId: string;
  userId: string;
  changes: Partial<PackageMetadata>;
  timestamp: Date;
}
```

### Security Events

#### `security.threat_detected`

Emitted when a security threat is detected.

```typescript
interface ThreatDetectedEvent {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId?: string;
  details: Record<string, any>;
  timestamp: Date;
}
```

#### `security.sanitization_performed`

Emitted when package sanitization is performed.

```typescript
interface SanitizationPerformedEvent {
  packageId: string;
  removedCount: number;
  maskedCount: number;
  classifications: string[];
  timestamp: Date;
}
```

## Usage Examples

### Complete Upload Flow

```typescript
import { PushService } from '@modules/push/services/push.service';

async function uploadPackage(pushService: PushService) {
  try {
    const result = await pushService.pushPackage({
      filePath: '/path/to/my-config.taptik',
      userId: 'user-123',
      isPublic: true,
      title: 'My Vim Configuration',
      description: 'Optimized Vim setup for TypeScript development',
      tags: ['vim', 'typescript', 'productivity'],
      version: '2.0.0'
    });

    if (result.success) {
      console.log(`Package uploaded: ${result.configId}`);
      
      if (result.sanitizationReport) {
        console.log(`Removed ${result.sanitizationReport.removedCount} sensitive items`);
      }
    } else {
      console.error(`Upload failed: ${result.error?.message}`);
      
      if (result.error?.retryable) {
        // Can retry the upload
        setTimeout(() => uploadPackage(pushService), 5000);
      }
    }
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}
```

### Batch Upload with Queue

```typescript
import { PushService } from '@modules/push/services/push.service';
import { LocalQueueService } from '@modules/push/services/local-queue.service';

async function batchUpload(
  pushService: PushService,
  queueService: LocalQueueService,
  packages: string[]
) {
  const results = [];
  
  for (const packagePath of packages) {
    try {
      const result = await pushService.pushPackage({
        filePath: packagePath,
        userId: 'user-123',
        isPublic: false
      });
      
      results.push(result);
    } catch (error) {
      // Add to queue for retry
      await queueService.addToQueue({
        id: `upload-${Date.now()}`,
        filePath: packagePath,
        options: {
          filePath: packagePath,
          userId: 'user-123',
          isPublic: false
        },
        retryCount: 0,
        lastError: error.message,
        createdAt: new Date(),
        nextRetryAt: new Date(Date.now() + 60000),
        status: 'pending'
      });
    }
  }
  
  // Process queue later
  const queueResult = await queueService.processQueue();
  console.log(`Processed ${queueResult.successful}/${queueResult.processed} queued uploads`);
  
  return results;
}
```

### Security Validation

```typescript
import { SecurityValidatorService } from '@modules/push/services/security-validator.service';

async function validateUserInput(
  validator: SecurityValidatorService,
  userInput: string
) {
  const result = validator.validateInput(userInput, 'packageTitle');
  
  if (!result.isValid) {
    console.error('Security issues detected:');
    result.issues.forEach(issue => {
      console.error(`- ${issue.type}: ${issue.message}`);
    });
    
    if (result.riskLevel === 'critical') {
      // Block the operation
      throw new Error('Critical security risk detected');
    } else if (result.sanitizedValue) {
      // Use sanitized value
      return result.sanitizedValue;
    }
  }
  
  return userInput;
}
```

### Rate Limit Checking

```typescript
import { RateLimiterService } from '@modules/push/services/rate-limiter.service';

async function checkUploadAllowed(
  rateLimiter: RateLimiterService,
  userId: string,
  userTier: 'free' | 'pro'
) {
  const result = await rateLimiter.checkLimit(userId, userTier);
  
  if (!result.allowed) {
    const resetTime = result.resetAt.toLocaleTimeString();
    throw new Error(
      `Upload limit exceeded. You have 0 uploads remaining. ` +
      `Limit resets at ${resetTime}.`
    );
  }
  
  console.log(`You have ${result.remaining} uploads remaining today.`);
  return true;
}
```

## Best Practices

### Error Handling

Always check for retryable errors and implement exponential backoff:

```typescript
async function uploadWithRetry(
  pushService: PushService,
  options: PushOptions,
  maxRetries: number = 3
) {
  let lastError: PushError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await pushService.pushPackage(options);
      
      if (result.success) {
        return result;
      }
      
      if (result.error && !result.error.retryable) {
        throw result.error;
      }
      
      lastError = result.error;
    } catch (error) {
      if (error instanceof PushError && !error.retryable) {
        throw error;
      }
      lastError = error;
    }
    
    // Exponential backoff
    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  
  throw lastError;
}
```

### Security

Always validate and sanitize user input:

```typescript
function preparePackageMetadata(userInput: any): CreatePackageDto {
  const dto = new CreatePackageDto();
  
  // Validate and sanitize each field
  dto.title = sanitizeString(userInput.title, 100);
  dto.description = sanitizeString(userInput.description, 500);
  dto.tags = userInput.tags?.map(tag => sanitizeString(tag, 20)).slice(0, 10);
  dto.isPublic = Boolean(userInput.isPublic);
  
  // Validate DTO
  const errors = validateSync(dto);
  if (errors.length > 0) {
    throw new ValidationError('Invalid package metadata', errors);
  }
  
  return dto;
}

function sanitizeString(input: unknown, maxLength: number): string {
  if (typeof input !== 'string') return '';
  
  // Remove control characters and trim
  const sanitized = input
    .replace(/[\x00-\x1F\x7F]/g, '')
    .trim()
    .slice(0, maxLength);
  
  return sanitized;
}
```

### Performance

Use chunked uploads for large files:

```typescript
async function uploadLargeFile(
  uploader: CloudUploadService,
  filePath: string,
  userId: string
) {
  const stats = await fs.stat(filePath);
  
  if (stats.size > 10 * 1024 * 1024) { // 10MB
    // Use chunked upload
    const buffer = await fs.readFile(filePath);
    
    return uploader.uploadPackage(
      buffer,
      path.basename(filePath),
      userId,
      (progress) => {
        console.log(`Upload progress: ${progress.percentage}%`);
      }
    );
  } else {
    // Small file, upload directly
    const buffer = await fs.readFile(filePath);
    return uploader.uploadPackage(buffer, path.basename(filePath), userId);
  }
}
```

### Monitoring

Track all operations for debugging and analytics:

```typescript
async function monitoredUpload(
  pushService: PushService,
  auditLogger: AuditLoggerService,
  analytics: AnalyticsService,
  options: PushOptions
) {
  const startTime = Date.now();
  let result: PushResult;
  
  try {
    result = await pushService.pushPackage(options);
    
    // Track success
    await analytics.trackEvent({
      type: 'upload',
      packageId: result.packageId,
      userId: options.userId,
      metadata: {
        duration: Date.now() - startTime,
        size: options.packageSize,
        platform: options.platform
      }
    });
    
  } catch (error) {
    // Log failure
    await auditLogger.logPackageUpload(
      options.userId,
      null,
      { ipAddress: getClientIP(), userAgent: getUserAgent() },
      Date.now() - startTime,
      false,
      error
    );
    
    throw error;
  }
  
  return result;
}
```

## Testing

### Unit Testing

Test individual service methods in isolation:

```typescript
import { Test } from '@nestjs/testing';
import { PackageValidatorService } from '@modules/push/services/package-validator.service';

describe('PackageValidatorService', () => {
  let service: PackageValidatorService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [PackageValidatorService],
    }).compile();

    service = module.get<PackageValidatorService>(PackageValidatorService);
  });

  it('should validate package structure', async () => {
    const validPackage = Buffer.from(JSON.stringify({
      name: 'test-package',
      version: '1.0.0',
      platform: 'claude-code'
    }));

    const result = await service.validatePackage(validPackage, 'test.taptik');
    
    expect(result.isValid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('should reject invalid package structure', async () => {
    const invalidPackage = Buffer.from('not json');

    const result = await service.validatePackage(invalidPackage, 'test.taptik');
    
    expect(result.isValid).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ type: 'INVALID_FORMAT' })
    );
  });
});
```

### Integration Testing

Test service interactions:

```typescript
import { Test } from '@nestjs/testing';
import { PushService } from '@modules/push/services/push.service';
import { SupabaseService } from '@modules/supabase/services/supabase.service';

describe('PushService Integration', () => {
  let pushService: PushService;
  let supabaseService: SupabaseService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [PushModule, SupabaseModule],
    }).compile();

    pushService = module.get<PushService>(PushService);
    supabaseService = module.get<SupabaseService>(SupabaseService);
    
    // Mock Supabase client
    jest.spyOn(supabaseService, 'getClient').mockReturnValue(mockClient);
  });

  it('should complete full upload flow', async () => {
    const result = await pushService.pushPackage({
      filePath: '/test/package.taptik',
      userId: 'test-user',
      isPublic: false
    });

    expect(result.success).toBe(true);
    expect(result.packageId).toBeDefined();
    expect(result.configId).toBeDefined();
  });
});
```

## Migration Guide

### Migrating from Local Storage

1. Export existing local packages:
```bash
taptik list --local --format json > local-packages.json
```

2. Upload to cloud:
```typescript
import { readFile } from 'fs/promises';
import { PushService } from '@modules/push/services/push.service';

async function migratePackages(pushService: PushService) {
  const packages = JSON.parse(await readFile('local-packages.json', 'utf-8'));
  
  for (const pkg of packages) {
    await pushService.pushPackage({
      filePath: pkg.path,
      userId: 'user-123',
      isPublic: false,
      title: pkg.name,
      tags: pkg.tags
    });
  }
}
```

### Upgrading from v1 to v2

Version 2 introduces breaking changes:

1. **New error structure**: Update error handling to use `PushError` class
2. **Required authentication**: All operations now require authenticated user
3. **Sanitization by default**: Claude Code packages are automatically sanitized
4. **Rate limiting**: Implement retry logic for rate-limited operations

## Appendix

### Environment Variables

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `SUPABASE_URL` | Yes | Supabase project URL | - |
| `SUPABASE_ANON_KEY` | Yes | Supabase anonymous key | - |
| `PUSH_CHUNK_SIZE` | No | Upload chunk size in bytes | 5242880 (5MB) |
| `PUSH_RATE_LIMIT_WINDOW` | No | Rate limit window in seconds | 86400 (24 hours) |
| `PUSH_MAX_RETRIES` | No | Maximum upload retries | 3 |
| `PUSH_QUEUE_SYNC_INTERVAL` | No | Queue sync interval in seconds | 30 |
| `PUSH_AUDIT_LOG_BUFFER_SIZE` | No | Audit log buffer size | 100 |
| `PUSH_SECURE_STORAGE_KEY` | No | Encryption key for secure storage | Auto-generated |

### Database Schema

```sql
-- Main packages table
CREATE TABLE taptik_packages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  config_id TEXT UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  name TEXT NOT NULL,
  title TEXT,
  description TEXT,
  platform TEXT NOT NULL,
  version TEXT NOT NULL,
  is_public BOOLEAN DEFAULT false,
  user_tags TEXT[],
  auto_tags TEXT[],
  sanitization_level TEXT,
  checksum TEXT NOT NULL,
  storage_url TEXT NOT NULL,
  package_size BIGINT NOT NULL,
  download_count INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  team_id UUID REFERENCES teams(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  archived_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX idx_packages_user_id ON taptik_packages(user_id);
CREATE INDEX idx_packages_config_id ON taptik_packages(config_id);
CREATE INDEX idx_packages_platform ON taptik_packages(platform);
CREATE INDEX idx_packages_public ON taptik_packages(is_public);
CREATE INDEX idx_packages_team ON taptik_packages(team_id);
CREATE INDEX idx_packages_created ON taptik_packages(created_at DESC);
CREATE INDEX idx_packages_downloads ON taptik_packages(download_count DESC);

-- Version history tracking
CREATE TABLE package_versions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  package_id UUID NOT NULL REFERENCES taptik_packages(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  changelog TEXT,
  storage_url TEXT NOT NULL,
  checksum TEXT NOT NULL,
  size BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(package_id, version)
);

-- Download tracking for analytics
CREATE TABLE package_downloads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  package_id UUID NOT NULL REFERENCES taptik_packages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  ip_address INET,
  user_agent TEXT,
  country_code TEXT,
  region TEXT,
  downloaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit logs for security
CREATE TABLE audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  metadata JSONB,
  ip_address INET,
  user_agent TEXT,
  session_id TEXT,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rate limiting tracking
CREATE TABLE rate_limits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL,
  last_action TIMESTAMPTZ,
  UNIQUE(user_id, action, window_start)
);
```

### Supabase Storage Configuration

```typescript
// Storage bucket configuration
const bucketConfig = {
  name: 'taptik-packages',
  public: false,
  fileSizeLimit: 104857600, // 100MB
  allowedMimeTypes: ['application/json', 'application/octet-stream'],
};

// Storage policies
const policies = [
  {
    name: 'Authenticated users can upload',
    definition: `
      CREATE POLICY "Authenticated users can upload"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'taptik-packages');
    `
  },
  {
    name: 'Users can read own files',
    definition: `
      CREATE POLICY "Users can read own files"
      ON storage.objects FOR SELECT
      TO authenticated
      USING (
        bucket_id = 'taptik-packages' AND 
        auth.uid()::text = (storage.foldername(name))[1]
      );
    `
  },
  {
    name: 'Public packages are readable',
    definition: `
      CREATE POLICY "Public packages are readable"
      ON storage.objects FOR SELECT
      TO anon, authenticated
      USING (
        bucket_id = 'taptik-packages' AND
        EXISTS (
          SELECT 1 FROM taptik_packages
          WHERE storage_url = storage.objects.name
          AND is_public = true
        )
      );
    `
  }
];
```