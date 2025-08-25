-- Migration: Create Taptik Push Feature Tables
-- Description: Sets up all database tables for the Taptik cloud push functionality

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create teams table if it doesn't exist (for team collaboration support)
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create team_members table if it doesn't exist
CREATE TABLE IF NOT EXISTS team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT CHECK (role IN ('owner', 'admin', 'member')) DEFAULT 'member',
    joined_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(team_id, user_id)
);

-- Core package metadata table
CREATE TABLE IF NOT EXISTS taptik_packages (
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
CREATE TABLE IF NOT EXISTS upload_queue (
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
CREATE TABLE IF NOT EXISTS package_versions (
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
CREATE TABLE IF NOT EXISTS package_downloads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_id UUID REFERENCES taptik_packages(id) ON DELETE CASCADE,
    downloaded_by UUID REFERENCES auth.users(id), -- NULL for anonymous
    ip_address INET,
    user_agent TEXT,
    download_source TEXT CHECK (download_source IN ('web', 'cli', 'api')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Analytics tracking
CREATE TABLE IF NOT EXISTS package_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_id UUID REFERENCES taptik_packages(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- 'download', 'view', 'like', 'share'
    user_id UUID REFERENCES auth.users(id), -- NULL for anonymous
    metadata JSONB, -- Additional event data
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Audit logging for security
CREATE TABLE IF NOT EXISTS audit_logs (
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

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_packages_public ON taptik_packages(is_public) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_packages_checksum ON taptik_packages(checksum);
CREATE INDEX IF NOT EXISTS idx_packages_user ON taptik_packages(user_id) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_packages_team ON taptik_packages(team_id) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_packages_platform ON taptik_packages(platform) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_packages_tags ON taptik_packages USING GIN ((auto_tags || user_tags));
CREATE INDEX IF NOT EXISTS idx_queue_status ON upload_queue(status, next_retry_at);
CREATE INDEX IF NOT EXISTS idx_analytics_package ON package_analytics(package_id, event_type);
CREATE INDEX IF NOT EXISTS idx_downloads_package ON package_downloads(package_id);
CREATE INDEX IF NOT EXISTS idx_downloads_user ON package_downloads(downloaded_by) WHERE downloaded_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_logs(resource_type, resource_id);

-- Create update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add update triggers for tables with updated_at columns
CREATE TRIGGER update_taptik_packages_updated_at BEFORE UPDATE ON taptik_packages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE taptik_packages IS 'Main table storing Taptik package metadata for cloud storage';
COMMENT ON TABLE upload_queue IS 'Queue for offline upload processing with retry logic';
COMMENT ON TABLE package_versions IS 'Version history tracking for packages';
COMMENT ON TABLE package_downloads IS 'Download tracking for analytics and statistics';
COMMENT ON TABLE package_analytics IS 'General analytics events for packages';
COMMENT ON TABLE audit_logs IS 'Security audit trail for all package operations';
COMMENT ON COLUMN taptik_packages.config_id IS 'User-facing unique identifier for the package';
COMMENT ON COLUMN taptik_packages.checksum IS 'SHA256 hash for deduplication and integrity verification';
COMMENT ON COLUMN taptik_packages.sanitization_level IS 'Security level after sanitization: safe, warning, or blocked';
COMMENT ON COLUMN taptik_packages.archived_at IS 'Soft delete timestamp - non-null means package is deleted';