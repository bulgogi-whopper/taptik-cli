# Push Module Migration Guide

## Table of Contents

- [Overview](#overview)
- [Migration Paths](#migration-paths)
- [Version Migration](#version-migration)
- [Local to Cloud Migration](#local-to-cloud-migration)
- [Platform Migration](#platform-migration)
- [Database Migration](#database-migration)
- [Breaking Changes](#breaking-changes)
- [Rollback Procedures](#rollback-procedures)
- [Troubleshooting](#troubleshooting)

## Overview

This guide covers migration scenarios for the Push module:

1. **Version upgrades**: Migrating between Push module versions
2. **Local to cloud**: Moving from local storage to cloud storage
3. **Platform changes**: Migrating between different platforms
4. **Database updates**: Schema migrations and data transformations
5. **Breaking changes**: Handling incompatible changes

## Migration Paths

### Migration Decision Tree

```
Start
  │
  ├─ Current Setup?
  │   ├─ Local Only → Local to Cloud Migration
  │   ├─ Cloud v1 → Version Migration (v1 to v2)
  │   └─ Cloud v2 → Platform or Database Migration
  │
  ├─ Data Volume?
  │   ├─ < 100 packages → Direct Migration
  │   ├─ 100-1000 packages → Batched Migration
  │   └─ > 1000 packages → Phased Migration
  │
  └─ Downtime Tolerance?
      ├─ Zero downtime → Blue-Green Deployment
      ├─ < 5 minutes → Rolling Update
      └─ Maintenance window → Direct Cutover
```

## Version Migration

### v1.x to v2.0 Migration

Version 2.0 introduces significant changes:

#### Breaking Changes

```typescript
// v1.x API
interface PushOptionsV1 {
  file: string;
  user: string;
  public?: boolean;
  metadata?: {
    title?: string;
    tags?: string[];
  };
}

// v2.0 API
interface PushOptionsV2 {
  filePath: string; // Renamed from 'file'
  userId: string; // Renamed from 'user'
  isPublic?: boolean; // Renamed from 'public'
  title?: string; // Flattened from metadata
  description?: string; // New field
  tags?: string[]; // Flattened from metadata
  teamId?: string; // New field
  version?: string; // New field
}
```

#### Migration Script

```typescript
// scripts/migrate-v1-to-v2.ts
import { createClient } from '@supabase/supabase-js';

export async function migrateV1ToV2() {
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

  console.log('Starting v1 to v2 migration...');

  // Step 1: Backup existing data
  console.log('Creating backup...');
  await supabase.rpc('create_backup', {
    table_name: 'taptik_packages',
    backup_name: 'pre_v2_migration',
  });

  // Step 2: Add new columns
  console.log('Adding new columns...');
  await supabase.rpc('execute_sql', {
    sql: `
      ALTER TABLE taptik_packages
      ADD COLUMN IF NOT EXISTS description TEXT,
      ADD COLUMN IF NOT EXISTS team_id UUID,
      ADD COLUMN IF NOT EXISTS sanitization_level TEXT,
      ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
    `,
  });

  // Step 3: Migrate data
  console.log('Migrating data...');
  const { data: packages, error } = await supabase.from('taptik_packages').select('*').is('description', null);

  if (error) {
    throw new Error(`Failed to fetch packages: ${error.message}`);
  }

  for (const pkg of packages) {
    // Extract metadata from JSON if stored that way
    const metadata = pkg.metadata || {};

    await supabase
      .from('taptik_packages')
      .update({
        description: metadata.description || `Package ${pkg.name}`,
        sanitization_level: 'none', // Default for v1 packages
      })
      .eq('id', pkg.id);
  }

  // Step 4: Create new indexes
  console.log('Creating indexes...');
  await supabase.rpc('execute_sql', {
    sql: `
      CREATE INDEX IF NOT EXISTS idx_packages_team 
      ON taptik_packages(team_id) WHERE team_id IS NOT NULL;
      
      CREATE INDEX IF NOT EXISTS idx_packages_archived 
      ON taptik_packages(archived_at) WHERE archived_at IS NOT NULL;
      
      CREATE INDEX IF NOT EXISTS idx_packages_likes 
      ON taptik_packages(likes) WHERE likes > 0;
    `,
  });

  // Step 5: Update RLS policies
  console.log('Updating RLS policies...');
  await updateRLSPolicies(supabase);

  console.log('Migration completed successfully!');

  return {
    success: true,
    packagesUpdated: packages.length,
  };
}

async function updateRLSPolicies(supabase: any) {
  // Drop old policies
  await supabase.rpc('execute_sql', {
    sql: `
      DROP POLICY IF EXISTS "Users can view public packages" ON taptik_packages;
      DROP POLICY IF EXISTS "Users can manage own packages" ON taptik_packages;
    `,
  });

  // Create new policies
  await supabase.rpc('execute_sql', {
    sql: `
      CREATE POLICY "Users can view accessible packages"
      ON taptik_packages FOR SELECT
      USING (
        auth.uid() = user_id 
        OR is_public = true
        OR team_id IN (
          SELECT team_id FROM team_members 
          WHERE user_id = auth.uid()
        )
      );
      
      CREATE POLICY "Users can manage own packages"
      ON taptik_packages FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
    `,
  });
}

// Run migration
if (require.main === module) {
  migrateV1ToV2()
    .then((result) => {
      console.log('Migration result:', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}
```

### v2.0 to v2.1 Migration

Version 2.1 adds analytics features:

```typescript
// scripts/migrate-v2.0-to-v2.1.ts
export async function migrateV2ToV21() {
  // Create analytics tables
  await supabase.rpc('execute_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS package_analytics (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        package_id UUID NOT NULL REFERENCES taptik_packages(id),
        event_type TEXT NOT NULL,
        user_id UUID,
        metadata JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      
      CREATE INDEX idx_analytics_package ON package_analytics(package_id);
      CREATE INDEX idx_analytics_event ON package_analytics(event_type);
      CREATE INDEX idx_analytics_created ON package_analytics(created_at DESC);
    `,
  });

  // Migrate existing download counts
  const { data: packages } = await supabase.from('taptik_packages').select('id, download_count').gt('download_count', 0);

  for (const pkg of packages) {
    // Create historical download events
    for (let i = 0; i < pkg.download_count; i++) {
      await supabase.from('package_analytics').insert({
        package_id: pkg.id,
        event_type: 'download',
        metadata: { migrated: true },
      });
    }
  }
}
```

## Local to Cloud Migration

### Exporting Local Packages

```typescript
// scripts/export-local-packages.ts
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

interface LocalPackage {
  path: string;
  name: string;
  platform: string;
  size: number;
  checksum: string;
  metadata: any;
}

export async function exportLocalPackages(): Promise<LocalPackage[]> {
  const localDir = path.join(os.homedir(), '.taptik', 'packages');
  const packages: LocalPackage[] = [];

  // Scan local directory
  const files = await fs.readdir(localDir, { withFileTypes: true });

  for (const file of files) {
    if (file.isFile() && file.name.endsWith('.taptik')) {
      const filePath = path.join(localDir, file.name);
      const stats = await fs.stat(filePath);
      const content = await fs.readFile(filePath);

      // Calculate checksum
      const checksum = crypto.createHash('sha256').update(content).digest('hex');

      // Parse package metadata
      let metadata = {};
      try {
        const packageData = JSON.parse(content.toString());
        metadata = packageData.metadata || {};
      } catch {
        // Binary package, extract from filename
        metadata = { name: path.basename(file.name, '.taptik') };
      }

      packages.push({
        path: filePath,
        name: file.name,
        platform: metadata.platform || 'unknown',
        size: stats.size,
        checksum,
        metadata,
      });
    }
  }

  // Save manifest
  await fs.writeFile('local-packages-manifest.json', JSON.stringify(packages, null, 2));

  console.log(`Exported ${packages.length} packages`);
  return packages;
}
```

### Uploading to Cloud

```typescript
// scripts/upload-local-packages.ts
import { PushService } from '../src/modules/push/services/push.service';

export async function uploadLocalPackages(manifest: LocalPackage[], options: UploadOptions = {}) {
  const pushService = new PushService(/* dependencies */);
  const results = {
    successful: 0,
    failed: 0,
    skipped: 0,
    errors: [] as any[],
  };

  // Process in batches
  const batchSize = options.batchSize || 10;
  const dryRun = options.dryRun || false;

  for (let i = 0; i < manifest.length; i += batchSize) {
    const batch = manifest.slice(i, i + batchSize);

    console.log(`Processing batch ${Math.floor(i / batchSize) + 1}`);

    const uploads = batch.map(async (pkg) => {
      try {
        // Check if already uploaded
        const existing = await pushService.getPackageByChecksum(pkg.checksum);

        if (existing && !options.force) {
          console.log(`Skipping ${pkg.name} (already uploaded)`);
          results.skipped++;
          return;
        }

        if (dryRun) {
          console.log(`[DRY RUN] Would upload ${pkg.name}`);
          return;
        }

        // Upload package
        const result = await pushService.pushPackage({
          filePath: pkg.path,
          userId: options.userId!,
          isPublic: options.makePublic || false,
          title: pkg.metadata.title || pkg.name,
          description: pkg.metadata.description,
          tags: pkg.metadata.tags,
          version: pkg.metadata.version || '1.0.0',
        });

        if (result.success) {
          console.log(`✓ Uploaded ${pkg.name}`);
          results.successful++;

          // Optionally remove local file
          if (options.removeLocal) {
            await fs.unlink(pkg.path);
          }
        } else {
          throw result.error;
        }
      } catch (error) {
        console.error(`✗ Failed to upload ${pkg.name}:`, error);
        results.failed++;
        results.errors.push({
          package: pkg.name,
          error: error.message,
        });
      }
    });

    await Promise.all(uploads);

    // Rate limiting delay
    if (i + batchSize < manifest.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return results;
}

// Main migration script
export async function migrateLocalToCloud() {
  console.log('Starting local to cloud migration...');

  // Step 1: Export local packages
  const manifest = await exportLocalPackages();

  // Step 2: Verify export
  console.log(`Found ${manifest.length} packages to migrate`);
  const totalSize = manifest.reduce((sum, pkg) => sum + pkg.size, 0);
  console.log(`Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);

  // Step 3: Confirm migration
  const proceed = await confirm('Proceed with migration?');
  if (!proceed) {
    console.log('Migration cancelled');
    return;
  }

  // Step 4: Upload packages
  const results = await uploadLocalPackages(manifest, {
    userId: process.env.USER_ID!,
    batchSize: 10,
    makePublic: false,
    removeLocal: false,
    dryRun: false,
  });

  // Step 5: Report results
  console.log('\nMigration Results:');
  console.log(`✓ Successful: ${results.successful}`);
  console.log(`⊘ Skipped: ${results.skipped}`);
  console.log(`✗ Failed: ${results.failed}`);

  if (results.errors.length > 0) {
    console.log('\nErrors:');
    results.errors.forEach((err) => {
      console.log(`  - ${err.package}: ${err.error}`);
    });
  }

  // Step 6: Verification
  console.log('\nVerifying migration...');
  const cloudPackages = await pushService.listUserPackages(process.env.USER_ID!);
  console.log(`Cloud packages: ${cloudPackages.length}`);

  return results;
}
```

## Platform Migration

### Migrating Between Platforms

```typescript
// scripts/migrate-platform.ts
export async function migratePlatform(fromPlatform: string, toPlatform: string) {
  // Platform-specific transformations
  const transformers = {
    'claude-code': {
      cursor: transformClaudeCodeToCursor,
      kiro: transformClaudeCodeToKiro,
      vim: transformClaudeCodeToVim,
    },
    cursor: {
      'claude-code': transformCursorToClaudeCode,
      kiro: transformCursorToKiro,
    },
    // ... more transformers
  };

  const transformer = transformers[fromPlatform]?.[toPlatform];

  if (!transformer) {
    throw new Error(`No transformer from ${fromPlatform} to ${toPlatform}`);
  }

  // Get packages to migrate
  const packages = await supabase.from('taptik_packages').select('*').eq('platform', fromPlatform);

  const migrated = [];

  for (const pkg of packages.data) {
    // Download package
    const { data: file } = await supabase.storage.from('taptik-packages').download(pkg.storage_url);

    // Transform package
    const transformed = await transformer(file);

    // Upload transformed package
    const newPath = pkg.storage_url.replace(fromPlatform, toPlatform);
    await supabase.storage.from('taptik-packages').upload(newPath, transformed);

    // Create new package record
    await supabase.from('taptik_packages').insert({
      ...pkg,
      id: undefined,
      platform: toPlatform,
      storage_url: newPath,
      name: `${pkg.name}_${toPlatform}`,
      created_at: new Date(),
    });

    migrated.push(pkg.id);
  }

  return migrated;
}

// Platform-specific transformers
function transformClaudeCodeToCursor(data: Buffer): Buffer {
  const package = JSON.parse(data.toString());

  // Claude Code to Cursor transformation
  const transformed = {
    ...package,
    platform: 'cursor',
    settings: {
      ...package.settings,
      // Remove Claude-specific settings
      claudeApiKey: undefined,
      claudeModel: undefined,
      // Add Cursor-specific settings
      cursorModel: 'gpt-4',
    },
    keybindings: transformKeybindings(package.keybindings, 'cursor'),
  };

  return Buffer.from(JSON.stringify(transformed));
}
```

## Database Migration

### Schema Migrations

```sql
-- migrations/001_initial_schema.sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  executed_at TIMESTAMPTZ DEFAULT NOW()
);

-- migrations/002_add_team_support.sql
BEGIN;
  -- Check if migration already applied
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM schema_migrations WHERE version = 2
    ) THEN
      -- Add team support
      ALTER TABLE taptik_packages
      ADD COLUMN team_id UUID REFERENCES teams(id);

      CREATE INDEX idx_packages_team
      ON taptik_packages(team_id)
      WHERE team_id IS NOT NULL;

      -- Record migration
      INSERT INTO schema_migrations (version, name)
      VALUES (2, 'add_team_support');
    END IF;
  END $$;
COMMIT;

-- migrations/003_add_versioning.sql
BEGIN;
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM schema_migrations WHERE version = 3
    ) THEN
      -- Create versions table
      CREATE TABLE package_versions (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        package_id UUID NOT NULL REFERENCES taptik_packages(id),
        version TEXT NOT NULL,
        changelog TEXT,
        storage_url TEXT NOT NULL,
        checksum TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(package_id, version)
      );

      -- Migrate existing packages to versions
      INSERT INTO package_versions (
        package_id, version, storage_url, checksum
      )
      SELECT
        id,
        COALESCE(version, '1.0.0'),
        storage_url,
        checksum
      FROM taptik_packages;

      INSERT INTO schema_migrations (version, name)
      VALUES (3, 'add_versioning');
    END IF;
  END $$;
COMMIT;
```

### Data Migration

```typescript
// scripts/migrate-data.ts
export async function migrateData() {
  const migrations = [
    { version: 1, fn: migration001_normalizeData },
    { version: 2, fn: migration002_addDefaults },
    { version: 3, fn: migration003_cleanupOrphans },
  ];

  for (const migration of migrations) {
    const applied = await isMigrationApplied(migration.version);

    if (!applied) {
      console.log(`Running migration ${migration.version}...`);

      try {
        await migration.fn();
        await recordMigration(migration.version);
        console.log(`Migration ${migration.version} completed`);
      } catch (error) {
        console.error(`Migration ${migration.version} failed:`, error);
        throw error;
      }
    }
  }
}

async function migration001_normalizeData() {
  // Normalize platform names
  await supabase.rpc('execute_sql', {
    sql: `
      UPDATE taptik_packages
      SET platform = LOWER(REPLACE(platform, ' ', '-'))
      WHERE platform != LOWER(REPLACE(platform, ' ', '-'));
    `,
  });

  // Normalize tags
  await supabase.rpc('execute_sql', {
    sql: `
      UPDATE taptik_packages
      SET user_tags = array(
        SELECT DISTINCT LOWER(TRIM(tag))
        FROM unnest(user_tags) AS tag
        WHERE TRIM(tag) != ''
      );
    `,
  });
}

async function migration002_addDefaults() {
  // Add default values for null fields
  await supabase.rpc('execute_sql', {
    sql: `
      UPDATE taptik_packages
      SET 
        description = COALESCE(description, 'No description'),
        version = COALESCE(version, '1.0.0'),
        download_count = COALESCE(download_count, 0),
        is_public = COALESCE(is_public, false)
      WHERE 
        description IS NULL 
        OR version IS NULL 
        OR download_count IS NULL 
        OR is_public IS NULL;
    `,
  });
}

async function migration003_cleanupOrphans() {
  // Remove orphaned storage files
  const { data: packages } = await supabase.from('taptik_packages').select('storage_url');

  const validUrls = new Set(packages.map((p) => p.storage_url));

  const { data: files } = await supabase.storage.from('taptik-packages').list('packages');

  for (const file of files) {
    if (!validUrls.has(file.name)) {
      console.log(`Removing orphaned file: ${file.name}`);
      await supabase.storage.from('taptik-packages').remove([file.name]);
    }
  }
}
```

## Breaking Changes

### Handling Breaking Changes

```typescript
// src/modules/push/utils/compatibility.ts
export class CompatibilityLayer {
  // Version detection
  detectApiVersion(request: any): string {
    // Check headers
    if (request.headers['x-api-version']) {
      return request.headers['x-api-version'];
    }

    // Check request structure
    if ('file' in request.body) {
      return '1.0'; // Old API
    } else if ('filePath' in request.body) {
      return '2.0'; // New API
    }

    return '2.0'; // Default to latest
  }

  // Request transformation
  transformRequest(request: any, fromVersion: string, toVersion: string): any {
    if (fromVersion === '1.0' && toVersion === '2.0') {
      return {
        ...request,
        filePath: request.file,
        userId: request.user,
        isPublic: request.public,
        title: request.metadata?.title,
        description: request.metadata?.description,
        tags: request.metadata?.tags,
      };
    }

    return request;
  }

  // Response transformation
  transformResponse(response: any, toVersion: string): any {
    if (toVersion === '1.0') {
      // Transform v2 response to v1 format
      return {
        success: response.success,
        id: response.packageId,
        url: response.storageUrl,
        metadata: {
          title: response.title,
          tags: response.tags,
        },
      };
    }

    return response;
  }
}

// Middleware for backward compatibility
export function backwardCompatibilityMiddleware() {
  const compatibility = new CompatibilityLayer();

  return (req: Request, res: Response, next: NextFunction) => {
    const version = compatibility.detectApiVersion(req);

    if (version !== '2.0') {
      // Transform old request to new format
      req.body = compatibility.transformRequest(req.body, version, '2.0');

      // Wrap response to transform back
      const originalJson = res.json.bind(res);
      res.json = (data: any) => {
        const transformed = compatibility.transformResponse(data, version);
        return originalJson(transformed);
      };
    }

    next();
  };
}
```

## Rollback Procedures

### Database Rollback

```typescript
// scripts/rollback-database.ts
export async function rollbackDatabase(targetVersion: number) {
  const currentVersion = await getCurrentVersion();

  if (targetVersion >= currentVersion) {
    throw new Error('Target version must be less than current version');
  }

  console.log(`Rolling back from v${currentVersion} to v${targetVersion}`);

  // Get rollback scripts
  const rollbacks = await getRollbackScripts(currentVersion, targetVersion);

  for (const rollback of rollbacks) {
    console.log(`Executing rollback ${rollback.version}...`);

    try {
      await supabase.rpc('execute_sql', { sql: rollback.sql });
      await updateVersion(rollback.version - 1);
    } catch (error) {
      console.error(`Rollback ${rollback.version} failed:`, error);
      throw error;
    }
  }

  console.log('Rollback completed');
}

function getRollbackScripts(from: number, to: number): RollbackScript[] {
  const scripts = [
    {
      version: 3,
      sql: `
        DROP TABLE IF EXISTS package_versions CASCADE;
        DELETE FROM schema_migrations WHERE version = 3;
      `,
    },
    {
      version: 2,
      sql: `
        ALTER TABLE taptik_packages DROP COLUMN IF EXISTS team_id;
        DROP INDEX IF EXISTS idx_packages_team;
        DELETE FROM schema_migrations WHERE version = 2;
      `,
    },
  ];

  return scripts.filter((s) => s.version > to && s.version <= from).sort((a, b) => b.version - a.version);
}
```

### Application Rollback

```bash
#!/bin/bash
# scripts/rollback-application.sh

VERSION=$1
if [ -z "$VERSION" ]; then
  echo "Usage: ./rollback-application.sh <version>"
  exit 1
fi

echo "Rolling back to version $VERSION..."

# Docker rollback
docker pull taptik-cli:$VERSION
docker stop taptik-cli-current
docker run -d --name taptik-cli-$VERSION taptik-cli:$VERSION

# Kubernetes rollback
kubectl set image deployment/taptik-cli taptik-cli=taptik-cli:$VERSION
kubectl rollout status deployment/taptik-cli

# Verify rollback
curl -f http://localhost:3000/health || exit 1

echo "Rollback to $VERSION completed"
```

## Troubleshooting

### Common Migration Issues

#### 1. Data Integrity Issues

```typescript
// scripts/verify-migration.ts
export async function verifyMigration() {
  const checks = [checkDataIntegrity, checkStorageConsistency, checkIndexes, checkConstraints];

  const results = [];

  for (const check of checks) {
    const result = await check();
    results.push(result);

    if (!result.success) {
      console.error(`Check failed: ${result.name}`);
      console.error(result.errors);
    }
  }

  return results;
}

async function checkDataIntegrity() {
  const issues = [];

  // Check for null required fields
  const { data: nullChecks } = await supabase.rpc('execute_sql', {
    sql: `
      SELECT COUNT(*) as count
      FROM taptik_packages
      WHERE 
        config_id IS NULL OR
        user_id IS NULL OR
        name IS NULL OR
        checksum IS NULL OR
        storage_url IS NULL
    `,
  });

  if (nullChecks[0].count > 0) {
    issues.push(`Found ${nullChecks[0].count} packages with null required fields`);
  }

  // Check for orphaned records
  const { data: orphans } = await supabase.rpc('execute_sql', {
    sql: `
      SELECT COUNT(*) as count
      FROM taptik_packages p
      WHERE NOT EXISTS (
        SELECT 1 FROM auth.users u 
        WHERE u.id = p.user_id
      )
    `,
  });

  if (orphans[0].count > 0) {
    issues.push(`Found ${orphans[0].count} orphaned packages`);
  }

  return {
    name: 'Data Integrity',
    success: issues.length === 0,
    errors: issues,
  };
}

async function checkStorageConsistency() {
  const issues = [];

  // Get all package URLs from database
  const { data: packages } = await supabase.from('taptik_packages').select('id, storage_url');

  // Check each file exists in storage
  for (const pkg of packages) {
    const { data, error } = await supabase.storage.from('taptik-packages').download(pkg.storage_url);

    if (error) {
      issues.push(`Missing file for package ${pkg.id}: ${pkg.storage_url}`);
    }
  }

  return {
    name: 'Storage Consistency',
    success: issues.length === 0,
    errors: issues,
  };
}
```

#### 2. Performance Issues After Migration

```typescript
// scripts/optimize-after-migration.ts
export async function optimizeAfterMigration() {
  console.log('Optimizing database after migration...');

  // Update statistics
  await supabase.rpc('execute_sql', {
    sql: 'ANALYZE taptik_packages;',
  });

  // Rebuild indexes
  await supabase.rpc('execute_sql', {
    sql: 'REINDEX TABLE taptik_packages;',
  });

  // Vacuum to reclaim space
  await supabase.rpc('execute_sql', {
    sql: 'VACUUM ANALYZE taptik_packages;',
  });

  // Clear caches
  await redis.flushall();

  console.log('Optimization completed');
}
```

#### 3. Fixing Failed Migrations

```typescript
// scripts/fix-failed-migration.ts
export async function fixFailedMigration(version: number) {
  console.log(`Attempting to fix migration ${version}...`);

  // Check migration state
  const state = await getMigrationState(version);

  switch (state) {
    case 'partial':
      await resumeMigration(version);
      break;
    case 'corrupted':
      await rollbackAndRetry(version);
      break;
    case 'locked':
      await unlockAndContinue(version);
      break;
    default:
      throw new Error(`Unknown migration state: ${state}`);
  }
}

async function resumeMigration(version: number) {
  // Get checkpoint
  const checkpoint = await getCheckpoint(version);

  console.log(`Resuming from checkpoint: ${checkpoint}`);

  // Continue migration from checkpoint
  const migration = getMigrationByVersion(version);
  await migration.resume(checkpoint);
}

async function rollbackAndRetry(version: number) {
  console.log('Rolling back corrupted migration...');

  // Rollback
  await rollbackDatabase(version - 1);

  // Clean up
  await cleanupCorruptedData(version);

  // Retry
  console.log('Retrying migration...');
  await runMigration(version);
}
```

## Migration Checklist

### Pre-Migration

- [ ] Backup all data
- [ ] Export local packages
- [ ] Document current version
- [ ] Test migration in staging
- [ ] Notify users of maintenance
- [ ] Prepare rollback plan
- [ ] Check disk space
- [ ] Verify credentials
- [ ] Test network connectivity
- [ ] Review breaking changes

### During Migration

- [ ] Monitor progress
- [ ] Check error logs
- [ ] Verify data integrity
- [ ] Test sample operations
- [ ] Monitor resource usage
- [ ] Keep audit trail
- [ ] Maintain communication
- [ ] Have rollback ready
- [ ] Document issues
- [ ] Track timing

### Post-Migration

- [ ] Verify all data migrated
- [ ] Check storage consistency
- [ ] Test all operations
- [ ] Update documentation
- [ ] Monitor performance
- [ ] Clear old data
- [ ] Update DNS/routing
- [ ] Notify users complete
- [ ] Archive backups
- [ ] Document lessons learned

## Resources

- [Database Migration Best Practices](https://www.postgresql.org/docs/current/migration.html)
- [Supabase Migration Guide](https://supabase.com/docs/guides/migrations)
- [Zero-Downtime Deployments](https://martinfowler.com/bliki/BlueGreenDeployment.html)
- [Data Migration Patterns](https://www.enterpriseintegrationpatterns.com)
