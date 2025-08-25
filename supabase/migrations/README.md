# Supabase Migrations

This directory contains database migrations for the Taptik CLI push feature.

## Migration Files

1. **20250125000000_create_taptik_push_tables.sql**
   - Creates core tables for package storage metadata
   - Sets up teams and team_members tables for collaboration
   - Creates audit_logs for security tracking

2. **20250125000001_add_rls_policies.sql**
   - Implements Row Level Security policies
   - Ensures data isolation between users
   - Manages team-based access control

3. **20250125000002_create_storage_buckets.sql**
   - Creates Supabase Storage bucket for package files
   - Sets up storage policies for secure access
   - Adds helper functions for path generation

4. **20250125000003_create_user_tiers.sql**
   - Implements user tier system (free, pro, premium)
   - Creates rate limiting infrastructure
   - Sets up quota management functions

5. **20250125000004_rollback_taptik_push_tables.sql.rollback**
   - Rollback script (not auto-executed due to .rollback extension)
   - Removes all push feature database objects
   - Use only if complete rollback is needed

## How to Apply Migrations

### Using Supabase CLI

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Initialize Supabase project (if not done)
supabase init

# Link to your Supabase project
supabase link --project-ref your-project-ref

# Apply migrations
supabase db push

# Or apply specific migration
supabase db push --file supabase/migrations/20250125000000_create_taptik_push_tables.sql
```

### Using Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste migration content
4. Execute in order (important!)

### Direct Database Connection

```bash
# Set your database URL
export DATABASE_URL="postgresql://postgres:password@db.project.supabase.co:5432/postgres"

# Apply migrations
psql $DATABASE_URL -f supabase/migrations/20250125000000_create_taptik_push_tables.sql
psql $DATABASE_URL -f supabase/migrations/20250125000001_add_rls_policies.sql
psql $DATABASE_URL -f supabase/migrations/20250125000002_create_storage_buckets.sql
psql $DATABASE_URL -f supabase/migrations/20250125000003_create_user_tiers.sql
```

## Important Notes

1. **Order Matters**: Apply migrations in numerical order
2. **Storage Bucket**: The storage bucket creation requires proper Supabase permissions
3. **RLS Policies**: Ensure RLS is enabled on auth.users table
4. **Rollback**: The rollback file has `.rollback` extension to prevent accidental execution

## Testing Migrations

```sql
-- Test package creation
INSERT INTO taptik_packages (
    config_id, name, title, version, platform,
    is_public, checksum, storage_url, package_size, user_id
) VALUES (
    'test-123-456', 'test-package', 'Test Package', '1.0.0', 'claude-code',
    true, 'abc123checksum', 'packages/test/path', 1024, auth.uid()
);

-- Test rate limiting
SELECT * FROM get_user_quota(auth.uid());

-- Test storage path generation
SELECT generate_storage_path(auth.uid(), 'test-config', '1.0.0');
```

## Environment Variables

Ensure these are set in your `.env` file:

```env
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key  # For admin operations
```

## Troubleshooting

### Migration Fails

- Check if tables already exist
- Verify user has proper permissions
- Ensure extensions are enabled (uuid-ossp)

### RLS Policy Issues

- Verify auth.users table exists
- Check if RLS is enabled on base tables
- Ensure service_role key is used for admin operations

### Storage Bucket Issues

- Verify storage.buckets table exists
- Check Supabase Storage is enabled in project
- Ensure proper CORS configuration for uploads

## Migration Status

- [x] Core tables created
- [x] RLS policies implemented
- [x] Storage bucket configured
- [x] Rate limiting infrastructure
- [x] Rollback script available

For more information, see the [Push Feature Design Document](../../.kiro/specs/supabase-push-feature/design.md).
