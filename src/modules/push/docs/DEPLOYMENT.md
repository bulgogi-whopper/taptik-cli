# Push Module Deployment Guide

## Table of Contents

- [Prerequisites](#prerequisites)
- [Supabase Setup](#supabase-setup)
- [Database Configuration](#database-configuration)
- [Storage Configuration](#storage-configuration)
- [Environment Configuration](#environment-configuration)
- [Deployment Steps](#deployment-steps)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Services

1. **Supabase Account**
   - Sign up at [supabase.com](https://supabase.com)
   - Create a new project
   - Note your project URL and keys

2. **Node.js Environment**
   - Node.js 18+ required
   - pnpm package manager
   - TypeScript 5+

3. **Git Repository**
   - GitHub account for version control
   - CI/CD pipeline (GitHub Actions recommended)

### Development Tools

```bash
# Install required tools
brew install node@18
npm install -g pnpm
brew install supabase/tap/supabase
```

## Supabase Setup

### 1. Create Supabase Project

1. Go to [app.supabase.com](https://app.supabase.com)
2. Click "New Project"
3. Configure:
   - **Name**: taptik-production
   - **Database Password**: [strong password]
   - **Region**: Choose nearest to users
   - **Pricing Plan**: Free or Pro based on needs

4. Wait for project provisioning (2-3 minutes)

### 2. Get Project Credentials

1. Go to Settings → API
2. Copy:
   - **Project URL**: `https://[project-id].supabase.co`
   - **Anon Key**: `eyJ...` (public)
   - **Service Key**: `eyJ...` (secret, for migrations)

3. Store securely:
```bash
# .env.production
SUPABASE_URL=https://[project-id].supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ... # Never commit!
```

### 3. Configure Authentication

1. Go to Authentication → Providers
2. Enable Email authentication:
   - Enable email confirmations
   - Set redirect URLs
   - Configure email templates

3. Enable OAuth providers:
```sql
-- Enable Google OAuth
UPDATE auth.providers
SET enabled = true
WHERE provider = 'google';

-- Configure redirect URLs
INSERT INTO auth.redirect_urls (url)
VALUES 
  ('http://localhost:3000/auth/callback'),
  ('https://yourdomain.com/auth/callback');
```

## Database Configuration

### 1. Run Initial Migrations

Create migration files:

```sql
-- migrations/001_create_packages_table.sql
CREATE TABLE IF NOT EXISTS taptik_packages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  config_id TEXT UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  title TEXT,
  description TEXT,
  platform TEXT NOT NULL,
  version TEXT NOT NULL,
  is_public BOOLEAN DEFAULT false,
  user_tags TEXT[],
  auto_tags TEXT[],
  sanitization_level TEXT CHECK (sanitization_level IN ('none', 'basic', 'strict')),
  checksum TEXT NOT NULL,
  storage_url TEXT NOT NULL,
  package_size BIGINT NOT NULL CHECK (package_size > 0),
  download_count INTEGER DEFAULT 0 CHECK (download_count >= 0),
  likes INTEGER DEFAULT 0 CHECK (likes >= 0),
  views INTEGER DEFAULT 0 CHECK (views >= 0),
  team_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  archived_at TIMESTAMPTZ,
  
  CONSTRAINT valid_dates CHECK (created_at <= updated_at),
  CONSTRAINT valid_archive CHECK (archived_at IS NULL OR archived_at >= created_at)
);

-- Create indexes for performance
CREATE INDEX idx_packages_user_id ON taptik_packages(user_id);
CREATE INDEX idx_packages_config_id ON taptik_packages(config_id);
CREATE INDEX idx_packages_platform ON taptik_packages(platform);
CREATE INDEX idx_packages_public ON taptik_packages(is_public) WHERE is_public = true;
CREATE INDEX idx_packages_team ON taptik_packages(team_id) WHERE team_id IS NOT NULL;
CREATE INDEX idx_packages_created ON taptik_packages(created_at DESC);
CREATE INDEX idx_packages_downloads ON taptik_packages(download_count DESC) WHERE download_count > 0;
CREATE INDEX idx_packages_archived ON taptik_packages(archived_at) WHERE archived_at IS NOT NULL;

-- Create update trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER packages_updated_at
  BEFORE UPDATE ON taptik_packages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
```

```sql
-- migrations/002_create_version_history.sql
CREATE TABLE IF NOT EXISTS package_versions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  package_id UUID NOT NULL REFERENCES taptik_packages(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  changelog TEXT,
  storage_url TEXT NOT NULL,
  checksum TEXT NOT NULL,
  size BIGINT NOT NULL CHECK (size > 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  CONSTRAINT unique_package_version UNIQUE(package_id, version)
);

CREATE INDEX idx_versions_package ON package_versions(package_id);
CREATE INDEX idx_versions_created ON package_versions(created_at DESC);
```

```sql
-- migrations/003_create_analytics_tables.sql
CREATE TABLE IF NOT EXISTS package_downloads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  package_id UUID NOT NULL REFERENCES taptik_packages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  ip_address INET,
  user_agent TEXT,
  country_code TEXT,
  region TEXT,
  city TEXT,
  downloaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_downloads_package ON package_downloads(package_id);
CREATE INDEX idx_downloads_user ON package_downloads(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_downloads_date ON package_downloads(downloaded_at DESC);
CREATE INDEX idx_downloads_country ON package_downloads(country_code) WHERE country_code IS NOT NULL;

-- Analytics aggregation view
CREATE MATERIALIZED VIEW package_analytics AS
SELECT 
  p.id as package_id,
  p.config_id,
  p.name,
  COUNT(DISTINCT d.user_id) as unique_downloaders,
  COUNT(d.id) as total_downloads,
  array_agg(DISTINCT d.country_code) FILTER (WHERE d.country_code IS NOT NULL) as countries,
  MAX(d.downloaded_at) as last_download
FROM taptik_packages p
LEFT JOIN package_downloads d ON p.id = d.package_id
GROUP BY p.id, p.config_id, p.name;

CREATE INDEX idx_analytics_package ON package_analytics(package_id);
CREATE INDEX idx_analytics_downloads ON package_analytics(total_downloads DESC);
```

```sql
-- migrations/004_create_audit_logs.sql
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  metadata JSONB,
  ip_address INET,
  user_agent TEXT,
  session_id TEXT,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_user ON audit_logs(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_failed ON audit_logs(success) WHERE success = false;

-- Partition by month for performance
CREATE TABLE audit_logs_2024_01 PARTITION OF audit_logs
  FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

```sql
-- migrations/005_create_rate_limits.sql
CREATE TABLE IF NOT EXISTS rate_limits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0),
  window_start TIMESTAMPTZ NOT NULL,
  last_action TIMESTAMPTZ,
  
  CONSTRAINT unique_rate_limit UNIQUE(user_id, action, window_start)
);

CREATE INDEX idx_rate_user ON rate_limits(user_id);
CREATE INDEX idx_rate_window ON rate_limits(window_start);
CREATE INDEX idx_rate_action ON rate_limits(action);

-- Cleanup old rate limits
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS void AS $$
BEGIN
  DELETE FROM rate_limits
  WHERE window_start < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;
```

### 2. Configure Row Level Security (RLS)

```sql
-- Enable RLS on all tables
ALTER TABLE taptik_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE package_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE package_downloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Package policies
CREATE POLICY "Users can view their own packages"
  ON taptik_packages FOR SELECT
  USING (auth.uid() = user_id OR is_public = true);

CREATE POLICY "Users can insert their own packages"
  ON taptik_packages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own packages"
  ON taptik_packages FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own packages"
  ON taptik_packages FOR DELETE
  USING (auth.uid() = user_id);

-- Version policies
CREATE POLICY "Users can view versions of accessible packages"
  ON package_versions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM taptik_packages p
      WHERE p.id = package_versions.package_id
      AND (p.user_id = auth.uid() OR p.is_public = true)
    )
  );

CREATE POLICY "Users can insert versions for their packages"
  ON package_versions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM taptik_packages p
      WHERE p.id = package_versions.package_id
      AND p.user_id = auth.uid()
    )
  );

-- Download tracking (write-only for users)
CREATE POLICY "Anyone can record downloads"
  ON package_downloads FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Package owners can view download stats"
  ON package_downloads FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM taptik_packages p
      WHERE p.id = package_downloads.package_id
      AND p.user_id = auth.uid()
    )
  );

-- Audit logs (write-only for users, read for admins)
CREATE POLICY "Users can write audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can view their own audit logs"
  ON audit_logs FOR SELECT
  USING (user_id = auth.uid());

-- Rate limits
CREATE POLICY "Users can view their own rate limits"
  ON rate_limits FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "System can manage rate limits"
  ON rate_limits FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');
```

### 3. Create Database Functions

```sql
-- Function to get user's upload statistics
CREATE OR REPLACE FUNCTION get_user_upload_stats(user_uuid UUID)
RETURNS TABLE (
  total_packages INTEGER,
  total_size BIGINT,
  total_downloads INTEGER,
  public_packages INTEGER,
  platforms TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER as total_packages,
    COALESCE(SUM(package_size), 0) as total_size,
    COALESCE(SUM(download_count), 0)::INTEGER as total_downloads,
    COUNT(*) FILTER (WHERE is_public = true)::INTEGER as public_packages,
    array_agg(DISTINCT platform) as platforms
  FROM taptik_packages
  WHERE user_id = user_uuid
  AND archived_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check rate limits
CREATE OR REPLACE FUNCTION check_rate_limit(
  user_uuid UUID,
  action_type TEXT,
  max_count INTEGER,
  window_seconds INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
  current_count INTEGER;
  window_start_time TIMESTAMPTZ;
BEGIN
  window_start_time := date_trunc('day', NOW());
  
  SELECT count INTO current_count
  FROM rate_limits
  WHERE user_id = user_uuid
  AND action = action_type
  AND window_start = window_start_time;
  
  IF current_count IS NULL THEN
    INSERT INTO rate_limits (user_id, action, count, window_start, last_action)
    VALUES (user_uuid, action_type, 1, window_start_time, NOW())
    ON CONFLICT (user_id, action, window_start) 
    DO UPDATE SET count = rate_limits.count + 1, last_action = NOW();
    RETURN true;
  ELSIF current_count < max_count THEN
    UPDATE rate_limits
    SET count = count + 1, last_action = NOW()
    WHERE user_id = user_uuid
    AND action = action_type
    AND window_start = window_start_time;
    RETURN true;
  ELSE
    RETURN false;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 4. Apply Migrations

```bash
# Using Supabase CLI
supabase db push

# Or using SQL editor in dashboard
# Copy and paste each migration file
```

## Storage Configuration

### 1. Create Storage Bucket

```typescript
// scripts/setup-storage.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function setupStorage() {
  // Create main bucket
  const { data: bucket, error: bucketError } = await supabase.storage
    .createBucket('taptik-packages', {
      public: false,
      fileSizeLimit: 104857600, // 100MB
      allowedMimeTypes: ['application/json', 'application/octet-stream'],
    });

  if (bucketError && !bucketError.message.includes('already exists')) {
    console.error('Error creating bucket:', bucketError);
    return;
  }

  console.log('Bucket ready:', bucket || 'taptik-packages');

  // Create folder structure
  const folders = [
    'packages/',
    'temp/',
    'archives/',
  ];

  for (const folder of folders) {
    const { error } = await supabase.storage
      .from('taptik-packages')
      .upload(`${folder}.keep`, new Blob(['']));
    
    if (error && !error.message.includes('already exists')) {
      console.error(`Error creating folder ${folder}:`, error);
    }
  }

  console.log('Storage setup complete');
}

setupStorage();
```

### 2. Configure Storage Policies

```sql
-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload packages"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'taptik-packages' AND
    (storage.foldername(name))[1] = 'packages' AND
    auth.uid()::text = (storage.foldername(name))[2]
  );

-- Allow users to read their own files
CREATE POLICY "Users can read own packages"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'taptik-packages' AND
    auth.uid()::text = (storage.foldername(name))[2]
  );

-- Allow reading public packages
CREATE POLICY "Anyone can read public packages"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (
    bucket_id = 'taptik-packages' AND
    EXISTS (
      SELECT 1 FROM taptik_packages p
      WHERE p.storage_url = name
      AND p.is_public = true
    )
  );

-- Allow users to delete their own files
CREATE POLICY "Users can delete own packages"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'taptik-packages' AND
    auth.uid()::text = (storage.foldername(name))[2]
  );
```

### 3. Configure CDN (Optional)

For better performance, configure CDN:

1. Go to Storage → Settings
2. Enable "Use CDN"
3. Configure custom domain (optional)
4. Set cache headers:

```typescript
// When uploading
const { data, error } = await supabase.storage
  .from('taptik-packages')
  .upload(path, file, {
    cacheControl: '3600', // 1 hour
    contentType: 'application/json',
  });
```

## Environment Configuration

### 1. Production Environment Variables

```bash
# .env.production
# Supabase
SUPABASE_URL=https://[project-id].supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ... # For migrations only

# OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Push Module
PUSH_CHUNK_SIZE=5242880 # 5MB
PUSH_MAX_PACKAGE_SIZE=104857600 # 100MB
PUSH_RATE_LIMIT_FREE=100
PUSH_RATE_LIMIT_PRO=1000
PUSH_RATE_LIMIT_WINDOW=86400 # 24 hours
PUSH_MAX_RETRIES=3
PUSH_RETRY_DELAY=1000
PUSH_QUEUE_SYNC_INTERVAL=30
PUSH_AUDIT_LOG_BUFFER_SIZE=100
PUSH_AUDIT_LOG_FLUSH_INTERVAL=5000

# Security
PUSH_ENABLE_SANITIZATION=true
PUSH_SANITIZATION_LEVEL=strict
PUSH_SECURE_STORAGE_KEY=generate-random-32-byte-key
PUSH_LOCK_TIMEOUT=30000
PUSH_LOCK_RETRY_COUNT=5

# Analytics
PUSH_ANALYTICS_ENABLED=true
PUSH_ANALYTICS_BATCH_SIZE=50
PUSH_ANALYTICS_FLUSH_INTERVAL=10000

# Monitoring
SENTRY_DSN=your-sentry-dsn
LOG_LEVEL=info
DEBUG=taptik:push:error
```

### 2. Secure Secrets Management

Use environment-specific secret management:

```bash
# Development
doppler secrets download --no-file --format env > .env.local

# Staging
kubectl create secret generic taptik-secrets \
  --from-env-file=.env.staging

# Production (AWS Secrets Manager)
aws secretsmanager create-secret \
  --name taptik/production \
  --secret-string file://.env.production
```

## Deployment Steps

### 1. Local Testing

```bash
# Test with local Supabase
supabase start
export $(cat .env.local | xargs)
pnpm run test:e2e

# Test production connection
export $(cat .env.production | xargs)
pnpm run test:integration
```

### 2. Build and Package

```bash
# Build application
pnpm run build

# Create Docker image
docker build -t taptik-cli:latest .

# Test Docker image
docker run --env-file .env.production taptik-cli:latest
```

### 3. Deploy to Cloud

#### Option A: Vercel/Netlify (Serverless)

```json
// vercel.json
{
  "functions": {
    "api/push.js": {
      "maxDuration": 30
    }
  },
  "env": {
    "SUPABASE_URL": "@supabase-url",
    "SUPABASE_ANON_KEY": "@supabase-anon-key"
  }
}
```

```bash
vercel --prod
```

#### Option B: AWS ECS

```yaml
# task-definition.json
{
  "family": "taptik-cli",
  "taskRoleArn": "arn:aws:iam::123456789:role/taptik-task-role",
  "executionRoleArn": "arn:aws:iam::123456789:role/taptik-execution-role",
  "containerDefinitions": [
    {
      "name": "taptik-cli",
      "image": "123456789.dkr.ecr.us-east-1.amazonaws.com/taptik-cli:latest",
      "memory": 512,
      "cpu": 256,
      "environment": [
        {"name": "NODE_ENV", "value": "production"}
      ],
      "secrets": [
        {
          "name": "SUPABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789:secret:taptik/production:SUPABASE_URL::"
        }
      ]
    }
  ]
}
```

#### Option C: Kubernetes

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: taptik-cli
spec:
  replicas: 3
  selector:
    matchLabels:
      app: taptik-cli
  template:
    metadata:
      labels:
        app: taptik-cli
    spec:
      containers:
      - name: taptik-cli
        image: taptik-cli:latest
        ports:
        - containerPort: 3000
        envFrom:
        - secretRef:
            name: taptik-secrets
        resources:
          limits:
            memory: "512Mi"
            cpu: "500m"
          requests:
            memory: "256Mi"
            cpu: "250m"
```

```bash
kubectl apply -f deployment.yaml
```

### 4. Post-Deployment Verification

```bash
# Health check
curl https://api.taptik.com/health

# Test upload
taptik push test.taptik --dry-run

# Check logs
kubectl logs -f deployment/taptik-cli

# Monitor metrics
open https://app.datadoghq.com/dashboard/taptik
```

## Monitoring

### 1. Application Monitoring

Configure Sentry for error tracking:

```typescript
// src/main.ts
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  integrations: [
    new Sentry.Integrations.Http({ tracing: true }),
  ],
});
```

### 2. Database Monitoring

Monitor database performance:

```sql
-- Check slow queries
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  max_time
FROM pg_stat_statements
WHERE mean_time > 100
ORDER BY mean_time DESC
LIMIT 10;

-- Monitor table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check index usage
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan;
```

### 3. Storage Monitoring

Monitor storage usage:

```typescript
// Monitor storage usage
async function monitorStorage() {
  const { data, error } = await supabase.storage
    .from('taptik-packages')
    .list('packages/', {
      limit: 1000,
      offset: 0,
    });

  const totalSize = data?.reduce((sum, file) => {
    return sum + (file.metadata?.size || 0);
  }, 0) || 0;

  console.log('Total storage used:', formatBytes(totalSize));
  
  // Alert if approaching limit
  const limitBytes = 10 * 1024 * 1024 * 1024; // 10GB
  if (totalSize > limitBytes * 0.8) {
    await sendAlert('Storage usage above 80%');
  }
}
```

### 4. Setup Alerts

Configure alerting:

```yaml
# prometheus-rules.yaml
groups:
  - name: taptik-alerts
    rules:
      - alert: HighErrorRate
        expr: rate(errors_total[5m]) > 0.05
        for: 5m
        annotations:
          summary: "High error rate detected"
          
      - alert: SlowUploads
        expr: histogram_quantile(0.95, upload_duration_seconds) > 30
        for: 10m
        annotations:
          summary: "Uploads taking longer than 30 seconds"
          
      - alert: RateLimitExceeded
        expr: rate(rate_limit_exceeded_total[1h]) > 10
        for: 5m
        annotations:
          summary: "Many users hitting rate limits"
```

## Troubleshooting

### Common Deployment Issues

#### 1. Database Connection Issues

```bash
# Test connection
psql postgresql://postgres:[password]@db.[project-id].supabase.co:5432/postgres

# Check connection pool
SELECT count(*) FROM pg_stat_activity;

# Kill idle connections
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE state = 'idle' 
AND state_change < NOW() - INTERVAL '10 minutes';
```

#### 2. Storage Upload Failures

```typescript
// Debug storage issues
async function debugStorage() {
  // Check bucket exists
  const { data: buckets } = await supabase.storage.listBuckets();
  console.log('Buckets:', buckets);

  // Test upload
  const testFile = new Blob(['test']);
  const { error } = await supabase.storage
    .from('taptik-packages')
    .upload('test/debug.txt', testFile);
    
  if (error) {
    console.error('Upload error:', error);
    // Check policies
    const { data: policies } = await supabase
      .from('storage.policies')
      .select('*');
    console.log('Policies:', policies);
  }
}
```

#### 3. Authentication Issues

```bash
# Verify JWT secret
echo $SUPABASE_JWT_SECRET | base64 -d

# Test authentication
curl -X POST https://[project-id].supabase.co/auth/v1/token?grant_type=password \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password"
  }'
```

#### 4. Rate Limiting Issues

```sql
-- Check rate limits
SELECT * FROM rate_limits 
WHERE user_id = 'user-uuid'
ORDER BY window_start DESC;

-- Reset rate limits (emergency)
DELETE FROM rate_limits 
WHERE user_id = 'user-uuid';

-- Adjust limits
UPDATE rate_limits 
SET count = 0 
WHERE action = 'upload' 
AND window_start = date_trunc('day', NOW());
```

### Performance Optimization

#### 1. Database Optimization

```sql
-- Analyze query performance
EXPLAIN ANALYZE
SELECT * FROM taptik_packages
WHERE user_id = 'uuid'
AND platform = 'claude-code'
ORDER BY created_at DESC
LIMIT 20;

-- Update statistics
ANALYZE taptik_packages;

-- Vacuum tables
VACUUM ANALYZE taptik_packages;

-- Create missing indexes
CREATE INDEX CONCURRENTLY idx_packages_user_platform 
ON taptik_packages(user_id, platform);
```

#### 2. Connection Pooling

```typescript
// Configure connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

#### 3. Caching Strategy

```typescript
// Implement Redis caching
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

async function getCachedPackages(userId: string) {
  const cacheKey = `packages:${userId}`;
  const cached = await redis.get(cacheKey);
  
  if (cached) {
    return JSON.parse(cached);
  }
  
  const packages = await fetchPackagesFromDB(userId);
  await redis.setex(cacheKey, 300, JSON.stringify(packages));
  
  return packages;
}
```

## Rollback Procedures

### Database Rollback

```sql
-- Create restore point before deployment
SELECT pg_create_restore_point('before_deploy_v2');

-- Rollback to restore point if needed
-- This requires WAL archiving to be enabled
ROLLBACK TO SAVEPOINT before_deploy_v2;

-- Or restore from backup
pg_restore -d postgres://[connection-string] backup.dump
```

### Application Rollback

```bash
# Rollback to previous version
kubectl rollout undo deployment/taptik-cli

# Or specify revision
kubectl rollout undo deployment/taptik-cli --to-revision=2

# Check rollout status
kubectl rollout status deployment/taptik-cli
```

## Security Checklist

- [ ] All environment variables secured
- [ ] Database RLS policies enabled
- [ ] Storage policies configured
- [ ] API rate limiting active
- [ ] Input validation enabled
- [ ] Sanitization active for Claude Code
- [ ] Audit logging configured
- [ ] SSL/TLS enforced
- [ ] Secrets rotated regularly
- [ ] Backup strategy implemented
- [ ] Monitoring and alerting active
- [ ] Security headers configured
- [ ] CORS properly configured
- [ ] Dependencies updated
- [ ] Penetration testing completed

## Support

For deployment support:
- Documentation: [docs.taptik.com](https://docs.taptik.com)
- GitHub Issues: [taptik-cli/issues](https://github.com/taptik/taptik-cli/issues)
- Discord: [discord.gg/taptik](https://discord.gg/taptik)
- Email: support@taptik.com