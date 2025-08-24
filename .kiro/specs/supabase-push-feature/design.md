# Design Document

## Overview

The Supabase Push Feature enables users to upload their local Taptik configuration packages to Supabase cloud storage with comprehensive metadata generation, security sanitization, and team collaboration support. The design follows a modular architecture with a dedicated PushModule that integrates seamlessly with the existing build workflow while maintaining clear separation of concerns.

## Architecture

### Module Structure

```
src/modules/push/
├── push.module.ts              # NestJS module definition
├── commands/
│   └── push.command.ts         # CLI command implementation
├── services/
│   ├── push.service.ts         # Core push orchestration
│   ├── cloud-upload.service.ts # Supabase storage operations
│   ├── package-registry.service.ts # Database operations
│   ├── sanitization.service.ts # Security filtering
│   ├── analytics.service.ts    # Usage tracking
│   ├── rate-limiter.service.ts # Rate limiting and quotas
│   ├── signed-url.service.ts   # Signed URL generation
│   ├── package-validator.service.ts # Package validation
│   └── local-queue.service.ts  # Offline queue management
├── interfaces/
│   ├── push-options.interface.ts
│   ├── upload-progress.interface.ts
│   ├── package-metadata.interface.ts
│   └── upload-queue.interface.ts
├── dto/
│   ├── push-package.dto.ts
│   └── package-metadata.dto.ts
└── constants/
    └── push.constants.ts
```

### Integration Points

```
BuildCommand (--push flag)
    ↓
PushService.upload()
    ↓
┌─ CloudUploadService ─ Supabase Storage
├─ PackageRegistryService ─ Supabase Database
├─ SanitizationService ─ Security Filtering
└─ AnalyticsService ─ Usage Tracking
```

## Components and Interfaces

### Core Interfaces

```typescript
// interfaces/push-options.interface.ts
export interface PushOptions {
  public?: boolean;
  private?: boolean;
  title?: string;
  description?: string;
  tags?: string[];
  team?: string;
  version?: string;
  force?: boolean;
  dryRun?: boolean;
}

// interfaces/package-metadata.interface.ts
export interface PackageMetadata {
  id: string;
  configId: string;
  name: string;
  title: string;
  description?: string;
  version: string;
  platform: string;
  isPublic: boolean;
  sanitizationLevel: 'safe' | 'warning' | 'blocked';
  checksum: string;
  storageUrl: string;
  packageSize: number;
  userId: string;
  teamId?: string;
  components: ComponentInfo[];
  autoTags: string[];
  userTags: string[];
  createdAt: Date;
  updatedAt: Date;
}

// interfaces/upload-progress.interface.ts
export interface UploadProgress {
  phase: 'validating' | 'sanitizing' | 'uploading' | 'registering' | 'complete';
  percentage: number;
  bytesUploaded: number;
  totalBytes: number;
  eta?: number;
  message: string;
}

// interfaces/upload-queue.interface.ts
export interface QueuedUpload {
  id: string;
  packagePath: string;
  options: PushOptions;
  attempts: number;
  lastAttempt?: Date;
  status: 'pending' | 'uploading' | 'failed' | 'completed';
  error?: string;
}
```

### Service Architecture

#### PushService (Core Orchestrator)

```typescript
@Injectable()
export class PushService {
  constructor(
    private cloudUploadService: CloudUploadService,
    private packageRegistryService: PackageRegistryService,
    private sanitizationService: SanitizationService,
    private analyticsService: AnalyticsService,
    private authService: AuthService,
    private progressService: ProgressService,
    private errorHandlerService: ErrorHandlerService,
  ) {}

  async upload(packagePath: string, options: PushOptions): Promise<PackageMetadata> {
    // 1. Validate package and user authentication
    // 2. Extract and sanitize package content
    // 3. Generate metadata and auto-tags
    // 4. Upload to Supabase Storage
    // 5. Register in database
    // 6. Track analytics
    // 7. Return metadata with shareable URL
  }

  async queueUpload(packagePath: string, options: PushOptions): Promise<string> {
    // Queue upload for offline processing
  }

  async processQueue(): Promise<void> {
    // Process pending uploads with retry logic
  }
}
```

#### CloudUploadService (Storage Operations)

```typescript
@Injectable()
export class CloudUploadService {
  private readonly BUCKET_CONFIG = {
    bucketName: 'taptik-packages',
    maxFileSize: 50 * 1024 * 1024, // 50MB
    allowedMimeTypes: ['application/octet-stream', 'application/gzip'],
    publicBucket: false, // Use signed URLs for access
    chunkSize: 5 * 1024 * 1024, // 5MB chunks for resumable uploads
  };

  constructor(
    private supabaseService: SupabaseService,
    private signedUrlService: SignedUrlService,
  ) {}

  async checkDuplicate(checksum: string): Promise<{
    exists: boolean;
    existingUrl?: string;
    existingId?: string;
  }> {
    // Query existing packages by checksum to avoid duplicate uploads
  }

  async uploadPackage(packageBuffer: Buffer, metadata: PackageMetadata, onProgress?: (progress: UploadProgress) => void): Promise<string> {
    // 1. Check for duplicate by checksum
    // 2. Generate storage path: packages/{userId}/{configId}/{version}/package.taptik
    // 3. Use chunked upload for files > 10MB
    // 4. Upload with progress tracking and resumable capability
    // 5. Generate signed URL for access
    // 6. Return storage URL
  }

  async resumeUpload(uploadId: string, packageBuffer: Buffer, onProgress?: (progress: UploadProgress) => void): Promise<string> {
    // Resume interrupted chunked upload
  }

  async deletePackage(storageUrl: string): Promise<void> {
    // Remove package from storage
  }

  async generateSignedDownloadUrl(
    packageId: string,
    userId?: string,
  ): Promise<{
    url: string;
    expires: Date;
  }> {
    // Generate time-limited download URL
  }
}

interface ChunkedUpload {
  uploadId: string;
  chunkSize: number;
  totalChunks: number;
  uploadedChunks: number[];
  resumeToken?: string;
}
```

#### PackageRegistryService (Database Operations)

```typescript
@Injectable()
export class PackageRegistryService {
  constructor(private supabaseService: SupabaseService) {}

  async registerPackage(metadata: PackageMetadata): Promise<PackageMetadata> {
    // Insert package metadata into taptik_packages table
  }

  async updatePackage(configId: string, updates: Partial<PackageMetadata>): Promise<PackageMetadata> {
    // Update package metadata
  }

  async deletePackage(configId: string): Promise<void> {
    // Soft delete package (set archived_at)
  }

  async listUserPackages(userId: string, filters?: PackageFilters): Promise<PackageMetadata[]> {
    // List user's packages with filtering
  }

  async getPackageStats(configId: string): Promise<PackageStats> {
    // Get download count, likes, etc.
  }
}
```

#### SanitizationService (Security Filtering)

```typescript
@Injectable()
export class SanitizationService {
  private readonly SENSITIVE_PATTERNS = [
    /api[_-]?key/i,
    /secret/i,
    /token/i,
    /password/i,
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // emails
  ];

  async sanitizePackage(packageBuffer: Buffer): Promise<{
    sanitizedBuffer: Buffer;
    report: SanitizationReport;
    level: 'safe' | 'warning' | 'blocked';
  }> {
    // 1. Extract package contents
    // 2. Scan for sensitive patterns
    // 3. Remove or mask sensitive data
    // 4. Generate sanitization report
    // 5. Determine safety level
    // 6. Repackage sanitized content
  }

  async generateAutoTags(packageContent: any): Promise<string[]> {
    // Extract tags from configuration content
    // - Platform detection (claude-code, kiro, etc.)
    // - Technology detection (react, typescript, etc.)
    // - Component detection (agents, commands, etc.)
  }
}
```

#### Additional Services

```typescript
// Rate Limiter Service
@Injectable()
export class RateLimiterService {
  private readonly limits = {
    free: { uploads: 100, bandwidth: 1024 * 1024 * 1024 }, // 1GB
    pro: { uploads: 1000, bandwidth: 10 * 1024 * 1024 * 1024 }, // 10GB
  };

  async checkLimit(
    userId: string,
    size: number,
  ): Promise<{
    allowed: boolean;
    remaining: number;
    resetAt: Date;
  }> {
    // Implementation using Supabase or Redis
  }
}

// Package Validator Service
@Injectable()
export class PackageValidatorService {
  async validateStructure(buffer: Buffer): Promise<boolean> {
    // Validate .taptik package structure
  }

  async validateChecksum(buffer: Buffer, expectedChecksum: string): Promise<boolean> {
    // Verify package integrity
  }

  async validateSize(size: number, userTier: 'free' | 'pro'): Promise<boolean> {
    // Check size limits based on user tier
  }

  async scanForMalware(buffer: Buffer): Promise<boolean> {
    // Basic malware detection patterns
  }
}

// Local Queue Service for Offline Mode
@Injectable()
export class LocalQueueService {
  private readonly queueConfig = {
    dbPath: '~/.taptik/upload-queue.db',
    syncInterval: 30000, // 30 seconds
    maxQueueSize: 100,
  };

  async addToQueue(packagePath: string, options: PushOptions): Promise<string> {
    // Add upload to local queue
  }

  async processQueue(): Promise<void> {
    // Process queued uploads when online
  }

  async getQueueStatus(): Promise<QueuedUpload[]> {
    // Get current queue status
  }
}

// Signed URL Service
@Injectable()
export class SignedUrlService {
  async generateUploadUrl(
    userId: string,
    packageId: string,
  ): Promise<{
    url: string;
    expires: Date;
    fields: Record<string, string>;
  }> {
    // Generate signed upload URL
  }

  async generateDownloadUrl(
    packageId: string,
    userId?: string,
  ): Promise<{
    url: string;
    expires: Date;
  }> {
    // Generate signed download URL
  }
}
```

## Data Models

### Database Schema

```sql
-- Core package metadata table
CREATE TABLE taptik_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id TEXT UNIQUE NOT NULL, -- User-facing ID (e.g., "abc-123-def")
    name TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    version TEXT NOT NULL,
    platform TEXT NOT NULL, -- 'claude-code', 'kiro', etc.

    -- Security & Visibility
    is_public BOOLEAN DEFAULT false,
    sanitization_level TEXT CHECK (sanitization_level IN ('safe', 'warning', 'blocked')),
    checksum TEXT NOT NULL, -- SHA256 for deduplication

    -- Storage
    storage_url TEXT NOT NULL,
    package_size BIGINT NOT NULL,

    -- Ownership
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    team_id UUID REFERENCES teams(id),

    -- Metadata
    components JSONB, -- Array of included components
    auto_tags JSONB, -- Auto-generated tags
    user_tags JSONB, -- User-provided tags

    -- Stats
    download_count INT DEFAULT 0,
    like_count INT DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    archived_at TIMESTAMPTZ, -- Soft delete

    -- Constraints
    UNIQUE(user_id, name, version),
    UNIQUE(team_id, name, version) -- Allow same name across teams
);

-- Upload queue for offline processing
CREATE TABLE upload_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    package_path TEXT NOT NULL,
    options JSONB NOT NULL,
    attempts INT DEFAULT 0,
    max_attempts INT DEFAULT 5,
    status TEXT CHECK (status IN ('pending', 'uploading', 'failed', 'completed')) DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    last_attempt_at TIMESTAMPTZ,
    next_retry_at TIMESTAMPTZ
);

-- Package version history
CREATE TABLE package_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_id UUID REFERENCES taptik_packages(id) ON DELETE CASCADE,
    version TEXT NOT NULL,
    changelog TEXT,
    storage_url TEXT NOT NULL,
    checksum TEXT NOT NULL,
    package_size BIGINT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id) NOT NULL,
    UNIQUE(package_id, version)
);

-- Download tracking (separate for performance)
CREATE TABLE package_downloads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_id UUID REFERENCES taptik_packages(id) ON DELETE CASCADE,
    downloaded_by UUID REFERENCES auth.users(id), -- NULL for anonymous
    ip_address INET,
    user_agent TEXT,
    download_source TEXT CHECK (download_source IN ('web', 'cli', 'api')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Analytics tracking
CREATE TABLE package_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_id UUID REFERENCES taptik_packages(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- 'download', 'view', 'like', 'share'
    user_id UUID REFERENCES auth.users(id), -- NULL for anonymous
    metadata JSONB, -- Additional event data
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Audit logging for security
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL, -- 'upload', 'delete', 'update', 'download'
    resource_type TEXT NOT NULL, -- 'package', 'user', 'team'
    resource_id TEXT NOT NULL,
    metadata JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_packages_public ON taptik_packages(is_public) WHERE archived_at IS NULL;
CREATE INDEX idx_packages_checksum ON taptik_packages(checksum);
CREATE INDEX idx_packages_user ON taptik_packages(user_id) WHERE archived_at IS NULL;
CREATE INDEX idx_packages_team ON taptik_packages(team_id) WHERE archived_at IS NULL;
CREATE INDEX idx_packages_platform ON taptik_packages(platform) WHERE archived_at IS NULL;
CREATE INDEX idx_packages_tags ON taptik_packages USING GIN ((auto_tags || user_tags));
CREATE INDEX idx_queue_status ON upload_queue(status, next_retry_at);
CREATE INDEX idx_analytics_package ON package_analytics(package_id, event_type);
```

### Row Level Security Policies

```sql
-- Enable RLS
ALTER TABLE taptik_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE upload_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE package_analytics ENABLE ROW LEVEL SECURITY;

-- Package access policies
CREATE POLICY "Public packages are viewable by everyone" ON taptik_packages
    FOR SELECT USING (is_public = true AND archived_at IS NULL);

CREATE POLICY "Users can view their own packages" ON taptik_packages
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Team members can view team packages" ON taptik_packages
    FOR SELECT USING (
        team_id IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM team_members
            WHERE team_id = taptik_packages.team_id
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage their own packages" ON taptik_packages
    FOR ALL USING (auth.uid() = user_id);

-- Queue policies
CREATE POLICY "Users can manage their own queue" ON upload_queue
    FOR ALL USING (auth.uid() = user_id);

-- Analytics policies
CREATE POLICY "Package owners can view analytics" ON package_analytics
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM taptik_packages
            WHERE id = package_analytics.package_id
            AND user_id = auth.uid()
        )
    );
```

## Error Handling

### Error Categories and Codes

```typescript
export enum PushErrorCode {
  // Authentication errors (3xx)
  AUTH_REQUIRED = 'AUTH_001',
  AUTH_EXPIRED = 'AUTH_002',
  INSUFFICIENT_PERMISSIONS = 'AUTH_003',

  // Validation errors (4xx)
  INVALID_PACKAGE = 'VAL_001',
  INVALID_VERSION = 'VAL_002',
  PACKAGE_TOO_LARGE = 'VAL_003',
  UNSUPPORTED_PLATFORM = 'VAL_004',

  // Security errors (5xx)
  SENSITIVE_DATA_DETECTED = 'SEC_001',
  SANITIZATION_FAILED = 'SEC_002',
  MALICIOUS_CONTENT = 'SEC_003',

  // Network/Storage errors (6xx)
  UPLOAD_FAILED = 'NET_001',
  STORAGE_QUOTA_EXCEEDED = 'NET_002',
  NETWORK_TIMEOUT = 'NET_003',

  // Rate limiting errors (7xx)
  RATE_LIMIT_EXCEEDED = 'RATE_001',
  DAILY_QUOTA_EXCEEDED = 'RATE_002',

  // System errors (8xx)
  DATABASE_ERROR = 'SYS_001',
  INTERNAL_ERROR = 'SYS_002',
}

export class PushError extends Error {
  constructor(
    public code: PushErrorCode,
    message: string,
    public details?: any,
    public retryable: boolean = false,
  ) {
    super(message);
    this.name = 'PushError';
  }
}
```

### Retry Strategy

```typescript
export class RetryStrategy {
  private static readonly MAX_ATTEMPTS = 5;
  private static readonly BASE_DELAY = 1000; // 1 second
  private static readonly MAX_DELAY = 30000; // 30 seconds

  static calculateDelay(attempt: number): number {
    // Exponential backoff with jitter
    const delay = Math.min(this.BASE_DELAY * Math.pow(2, attempt), this.MAX_DELAY);
    return delay + Math.random() * 1000; // Add jitter
  }

  static shouldRetry(error: PushError): boolean {
    return error.retryable && error.code.startsWith('NET_');
  }
}
```

## Testing Strategy

### Unit Tests

```typescript
// push.service.spec.ts
describe('PushService', () => {
  let service: PushService;
  let mockCloudUploadService: jest.Mocked<CloudUploadService>;
  let mockPackageRegistryService: jest.Mocked<PackageRegistryService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PushService,
        { provide: CloudUploadService, useValue: mockCloudUploadService },
        { provide: PackageRegistryService, useValue: mockPackageRegistryService },
        // ... other mocked services
      ],
    }).compile();

    service = module.get<PushService>(PushService);
  });

  describe('upload', () => {
    it('should upload package successfully', async () => {
      // Test successful upload flow
    });

    it('should handle authentication errors', async () => {
      // Test auth error handling
    });

    it('should sanitize sensitive data', async () => {
      // Test sanitization process
    });

    it('should queue upload when offline', async () => {
      // Test offline queue functionality
    });
  });
});
```

### Integration Tests

```typescript
// push.integration.spec.ts
describe('Push Integration', () => {
  let app: INestApplication;
  let supabaseClient: SupabaseClient;

  beforeAll(async () => {
    // Setup test Supabase project
    // Initialize test application
  });

  it('should complete full upload workflow', async () => {
    // Test end-to-end upload process
  });

  it('should handle concurrent uploads', async () => {
    // Test race conditions and locking
  });
});
```

### E2E Tests

```typescript
// push.e2e.spec.ts
describe('Push Command E2E', () => {
  it('should push package via CLI', async () => {
    const result = execSync('taptik push test-package.taptik --public --title="Test Config"');
    expect(result.toString()).toContain('Upload successful');
  });

  it('should integrate with build command', async () => {
    const result = execSync('taptik build --platform=claude-code --push --public');
    expect(result.toString()).toContain('Build complete');
    expect(result.toString()).toContain('Upload successful');
  });
});
```

## Performance Considerations

### Upload Optimization

- **Streaming Uploads**: Use streaming for packages > 10MB
- **Compression**: Gzip compression before upload
- **Chunked Upload**: Support resumable uploads for large files
- **Parallel Processing**: Process sanitization and metadata generation in parallel

### Database Optimization

- **Connection Pooling**: Reuse Supabase connections
- **Batch Operations**: Batch analytics inserts
- **Caching**: Cache frequently accessed metadata
- **Indexing**: Optimize queries with appropriate indexes

### Memory Management

- **Streaming Processing**: Avoid loading entire packages into memory
- **Garbage Collection**: Explicit cleanup of large buffers
- **Memory Limits**: Set limits for package processing

## Security Considerations

### Data Protection

- **Encryption in Transit**: HTTPS for all communications
- **Encryption at Rest**: Supabase storage encryption
- **Access Control**: RLS policies for data isolation
- **Audit Logging**: Track all sensitive operations

### Input Validation

- **Package Validation**: Verify .taptik format integrity
- **Size Limits**: Enforce maximum package sizes
- **Content Scanning**: Detect malicious content patterns
- **Path Traversal**: Prevent directory traversal attacks

### Rate Limiting

- **Per-User Limits**: Prevent abuse with user quotas
- **IP-Based Limits**: Additional protection against automated attacks
- **Graceful Degradation**: Maintain service during high load
- **Queue Management**: Prevent queue overflow attacks

This design provides a robust, scalable, and secure foundation for the Supabase push feature while maintaining clean architecture and comprehensive error handling.
