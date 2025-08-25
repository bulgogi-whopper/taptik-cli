# Push Module Documentation

The Push module enables seamless cloud synchronization of Taptik packages with Supabase storage, providing secure upload, storage, and management capabilities.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Installation](#installation)
- [CLI Commands](#cli-commands)
- [API Reference](#api-reference)
- [Security](#security)
- [Performance](#performance)
- [Troubleshooting](#troubleshooting)

## Overview

The Push module provides:
- **Cloud Storage**: Upload and store Taptik packages in Supabase
- **Package Management**: CRUD operations for packages
- **Security**: Automatic sanitization and malicious content detection
- **Offline Support**: Queue uploads when offline
- **Analytics**: Track package usage and statistics
- **Rate Limiting**: Tier-based upload limits and bandwidth management

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│ CLI Command │────▶│ Push Service │────▶│  Supabase   │
└─────────────┘     └──────────────┘     └─────────────┘
                            │
                ┌───────────┴───────────┐
                │                       │
        ┌───────▼────────┐     ┌───────▼────────┐
        │  Sanitization  │     │   Validation   │
        └────────────────┘     └────────────────┘
```

### Core Services

- **PushService**: Main orchestrator for upload operations
- **CloudUploadService**: Handles chunked and resumable uploads
- **PackageRegistryService**: Database operations for package metadata
- **SanitizationService**: Removes sensitive data from packages
- **SecurityValidatorService**: Detects malicious content and injection attempts
- **RateLimiterService**: Enforces upload and bandwidth limits
- **LocalQueueService**: Manages offline upload queue
- **AnalyticsService**: Tracks usage metrics

## Installation

### Prerequisites

1. **Supabase Project**: Create a project at [supabase.com](https://supabase.com)
2. **Environment Variables**:
```bash
SUPABASE_URL=your_project_url
SUPABASE_ANON_KEY=your_anon_key
```

### Database Setup

Run the following migrations in your Supabase SQL editor:

```sql
-- Create packages table
CREATE TABLE taptik_packages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  config_id TEXT UNIQUE NOT NULL,
  user_id UUID NOT NULL,
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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_packages_user_id ON taptik_packages(user_id);
CREATE INDEX idx_packages_platform ON taptik_packages(platform);
CREATE INDEX idx_packages_public ON taptik_packages(is_public);
CREATE INDEX idx_packages_created ON taptik_packages(created_at DESC);

-- Enable Row Level Security
ALTER TABLE taptik_packages ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own packages"
  ON taptik_packages FOR SELECT
  USING (auth.uid() = user_id OR is_public = true);

CREATE POLICY "Users can insert their own packages"
  ON taptik_packages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own packages"
  ON taptik_packages FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own packages"
  ON taptik_packages FOR DELETE
  USING (auth.uid() = user_id);
```

### Storage Bucket Setup

1. Go to Storage in your Supabase dashboard
2. Create a new bucket called `taptik-packages`
3. Set the following policies:

```sql
-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'taptik-packages');

-- Allow users to read their own files
CREATE POLICY "Users can read own files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'taptik-packages' AND auth.uid()::text = (storage.foldername(name))[1]);
```

## CLI Commands

### Push Command

Upload a package to the cloud:

```bash
# Basic upload
taptik push package.taptik

# With options
taptik push package.taptik \
  --public \
  --title "My Package" \
  --description "Package description" \
  --tags "vim,config" \
  --version "2.0.0"

# Dry run
taptik push package.taptik --dry-run

# Force overwrite
taptik push package.taptik --force
```

**Options:**
- `--public`: Make package publicly accessible
- `--title <title>`: Package title
- `--description <desc>`: Package description  
- `--tags <tags>`: Comma-separated tags
- `--version <version>`: Override version
- `--force`: Overwrite existing package
- `--dry-run`: Simulate upload without executing
- `--team <id>`: Upload to team (Pro feature)

### List Command

List your uploaded packages:

```bash
# List all packages
taptik list --cloud

# Filter options
taptik list --cloud \
  --platform claude-code \
  --visibility public \
  --limit 20 \
  --sort-by downloads

# Output formats
taptik list --cloud --format json
taptik list --cloud --format simple
```

**Options:**
- `--cloud`: List cloud packages (required)
- `--platform <name>`: Filter by platform
- `--visibility <type>`: Filter by public/private
- `--limit <n>`: Maximum results
- `--sort-by <field>`: Sort by field
- `--format <type>`: Output format (table/json/simple)

### Update Command

Update package metadata:

```bash
# Update title and description
taptik update config-id \
  --title "New Title" \
  --description "Updated description"

# Update tags
taptik update config-id --tags "new,tags,here"
```

**Options:**
- `--title <title>`: New title
- `--description <desc>`: New description
- `--tags <tags>`: New tags (replaces existing)

### Delete Command

Delete a package:

```bash
# Interactive deletion
taptik delete config-id

# Skip confirmation
taptik delete config-id --yes
```

**Options:**
- `--yes`: Skip confirmation prompt

### Visibility Command

Change package visibility:

```bash
# Make public
taptik visibility config-id --public

# Make private  
taptik visibility config-id --private
```

**Options:**
- `--public`: Make package public
- `--private`: Make package private

### Stats Command

View package statistics:

```bash
# View stats
taptik stats config-id

# Specify period
taptik stats config-id --period month

# Output as JSON
taptik stats config-id --format json
```

**Options:**
- `--period <time>`: Time period (week/month/year/all)
- `--format <type>`: Output format (table/json)

### Build with Push

Combine build and push:

```bash
# Build and push
taptik build claude-code --push

# With push options
taptik build claude-code \
  --push \
  --push-public \
  --push-title "My Config" \
  --push-tags "vim,productivity"
```

## API Reference

### PushService

Main service for package uploads.

```typescript
interface PushResult {
  success: boolean;
  packageId?: string;
  configId?: string;
  message?: string;
  error?: PushError;
  sanitizationReport?: SanitizationReport;
}

class PushService {
  async pushPackage(options: PushOptions): Promise<PushResult>;
  async processQueue(): Promise<void>;
  async deletePackage(configId: string): Promise<void>;
}
```

### PackageRegistryService

Database operations for packages.

```typescript
class PackageRegistryService {
  async registerPackage(metadata: PackageMetadata): Promise<void>;
  async listUserPackages(userId: string, filters?: ListFilters): Promise<PackageMetadata[]>;
  async updatePackage(configId: string, updates: Partial<PackageMetadata>): Promise<void>;
  async deletePackage(configId: string): Promise<void>;
  async getPackageByConfigId(configId: string): Promise<PackageMetadata | null>;
}
```

### SanitizationService

Removes sensitive data from packages.

```typescript
interface SanitizationReport {
  removed: string[];
  masked: string[];
  removedCount: number;
  maskedCount: number;
  detectedPatterns: string[];
  classifications: string[];
  autoTags: string[];
}

class SanitizationService {
  async sanitizePackage(
    buffer: Buffer, 
    fileName: string,
    platform: PlatformConfig
  ): Promise<{
    sanitized: Buffer;
    report: SanitizationReport;
  }>;
}
```

## Security

### Sensitive Data Sanitization

The module automatically detects and removes:
- API keys (AWS, Google, GitHub, Stripe, etc.)
- Passwords and secrets
- Email addresses (optional)
- SSH keys and certificates
- Authentication tokens
- Database credentials

### Injection Prevention

Protection against:
- SQL injection
- JavaScript/XSS injection
- Command injection
- Path traversal attacks
- Prototype pollution
- LDAP injection

### Malicious Content Detection

Detects:
- Executable files (PE, ELF, Mach-O)
- Shell scripts with dangerous commands
- High entropy data (encryption/obfuscation)
- Suspicious file extensions
- Oversized inputs

### Security Best Practices

1. **Always sanitize packages from Claude Code**
2. **Never disable security validation**
3. **Review sanitization reports**
4. **Use secure credential storage**
5. **Enable audit logging**
6. **Regularly update dependencies**

## Performance

### Optimization Tips

1. **Chunked Uploads**: Files > 10MB are automatically chunked
2. **Compression**: Enable gzip for smaller transfers
3. **Caching**: Use local cache for frequently accessed packages
4. **Batch Operations**: Process multiple packages together
5. **Queue Management**: Use offline queue for unreliable connections

### Rate Limits

| Tier | Daily Uploads | Package Size | Bandwidth |
|------|--------------|--------------|-----------|
| Free | 100 | 10MB | 1GB |
| Pro | 1000 | 100MB | 10GB |
| Team | Unlimited | 500MB | Unlimited |

### Performance Metrics

- Average upload speed: 5-10 MB/s
- Checksum calculation: ~100 MB/s
- Sanitization: ~50 MB/s
- Queue processing: 10 packages/minute

## Troubleshooting

### Common Issues

#### Authentication Errors

**Problem**: "Not authenticated" error
**Solution**: 
```bash
taptik auth login
```

#### Rate Limit Exceeded

**Problem**: "Rate limit exceeded" error
**Solution**: 
- Wait for limit reset (daily at UTC midnight)
- Upgrade to Pro tier for higher limits
- Use offline queue for batch uploads

#### Package Too Large

**Problem**: "Package exceeds size limit"
**Solution**:
- Reduce package size
- Remove unnecessary files
- Upgrade tier for larger limits

#### Network Timeouts

**Problem**: Upload times out
**Solution**:
- Check internet connection
- Use chunked upload for large files
- Enable resume on failure
- Try offline queue

#### Sanitization Removing Too Much

**Problem**: Important data being removed
**Solution**:
- Review sanitization patterns
- Use environment variables instead of hardcoded values
- Mark false positives in config

### Debug Mode

Enable debug logging:

```bash
DEBUG=taptik:push:* taptik push package.taptik
```

### Support

For issues and questions:
- GitHub Issues: [taptik-cli/issues](https://github.com/taptik/taptik-cli/issues)
- Documentation: [docs.taptik.com](https://docs.taptik.com)
- Discord: [discord.gg/taptik](https://discord.gg/taptik)

## Migration Guide

### From Local to Cloud

1. **Export existing packages**:
```bash
taptik list --local --format json > packages.json
```

2. **Upload to cloud**:
```bash
for package in *.taptik; do
  taptik push "$package"
done
```

3. **Verify uploads**:
```bash
taptik list --cloud
```

### Backward Compatibility

- All local commands remain unchanged
- Cloud features are opt-in via `--cloud` flag
- No breaking changes to existing workflows
- Gradual migration supported

## Contributing

See [CONTRIBUTING.md](../../../CONTRIBUTING.md) for development setup and guidelines.

## License

MIT - See [LICENSE](../../../LICENSE) for details.