-- Migration: Add Row Level Security Policies
-- Description: Sets up RLS policies for data isolation and security

-- Enable RLS on all tables
ALTER TABLE taptik_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE upload_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE package_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE package_downloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE package_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- ===========================
-- Package Access Policies
-- ===========================

-- Public packages are viewable by everyone
CREATE POLICY "Public packages are viewable by everyone" ON taptik_packages
    FOR SELECT USING (is_public = true AND archived_at IS NULL);

-- Users can view their own packages
CREATE POLICY "Users can view their own packages" ON taptik_packages
    FOR SELECT USING (auth.uid() = user_id);

-- Team members can view team packages
CREATE POLICY "Team members can view team packages" ON taptik_packages
    FOR SELECT USING (
        team_id IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM team_members
            WHERE team_id = taptik_packages.team_id
            AND user_id = auth.uid()
        )
    );

-- Users can manage their own packages
CREATE POLICY "Users can manage their own packages" ON taptik_packages
    FOR ALL USING (auth.uid() = user_id);

-- Team admins can manage team packages
CREATE POLICY "Team admins can manage team packages" ON taptik_packages
    FOR ALL USING (
        team_id IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM team_members
            WHERE team_id = taptik_packages.team_id
            AND user_id = auth.uid()
            AND role IN ('owner', 'admin')
        )
    );

-- ===========================
-- Upload Queue Policies
-- ===========================

-- Users can manage their own queue
CREATE POLICY "Users can manage their own queue" ON upload_queue
    FOR ALL USING (auth.uid() = user_id);

-- ===========================
-- Analytics Policies
-- ===========================

-- Package owners can view analytics
CREATE POLICY "Package owners can view analytics" ON package_analytics
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM taptik_packages
            WHERE id = package_analytics.package_id
            AND user_id = auth.uid()
        )
    );

-- Team members can view team package analytics
CREATE POLICY "Team members can view team package analytics" ON package_analytics
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM taptik_packages tp
            JOIN team_members tm ON tm.team_id = tp.team_id
            WHERE tp.id = package_analytics.package_id
            AND tm.user_id = auth.uid()
        )
    );

-- System can insert analytics (for tracking)
CREATE POLICY "System can insert analytics" ON package_analytics
    FOR INSERT WITH CHECK (true);

-- ===========================
-- Download Tracking Policies
-- ===========================

-- Anyone can insert download records (for tracking)
CREATE POLICY "Anyone can insert download records" ON package_downloads
    FOR INSERT WITH CHECK (true);

-- Package owners can view download records
CREATE POLICY "Package owners can view downloads" ON package_downloads
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM taptik_packages
            WHERE id = package_downloads.package_id
            AND user_id = auth.uid()
        )
    );

-- ===========================
-- Version History Policies
-- ===========================

-- View policies follow package visibility
CREATE POLICY "View versions for public packages" ON package_versions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM taptik_packages
            WHERE id = package_versions.package_id
            AND is_public = true
            AND archived_at IS NULL
        )
    );

CREATE POLICY "Users can view own package versions" ON package_versions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM taptik_packages
            WHERE id = package_versions.package_id
            AND user_id = auth.uid()
        )
    );

-- Users can manage versions of their own packages
CREATE POLICY "Users can manage own package versions" ON package_versions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM taptik_packages
            WHERE id = package_versions.package_id
            AND user_id = auth.uid()
        )
    );

-- ===========================
-- Audit Log Policies
-- ===========================

-- Users can view their own audit logs
CREATE POLICY "Users can view own audit logs" ON audit_logs
    FOR SELECT USING (auth.uid() = user_id);

-- System can insert audit logs
CREATE POLICY "System can insert audit logs" ON audit_logs
    FOR INSERT WITH CHECK (true);

-- ===========================
-- Team Policies
-- ===========================

-- Anyone can view public team information
CREATE POLICY "Public team information is viewable" ON teams
    FOR SELECT USING (true);

-- Team owners can manage teams
CREATE POLICY "Team owners can manage teams" ON teams
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM team_members
            WHERE team_id = teams.id
            AND user_id = auth.uid()
            AND role = 'owner'
        )
    );

-- ===========================
-- Team Member Policies
-- ===========================

-- Team members can view team membership
CREATE POLICY "Team members can view membership" ON team_members
    FOR SELECT USING (
        team_id IN (
            SELECT team_id FROM team_members
            WHERE user_id = auth.uid()
        )
    );

-- Team admins can manage membership
CREATE POLICY "Team admins can manage membership" ON team_members
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM team_members tm
            WHERE tm.team_id = team_members.team_id
            AND tm.user_id = auth.uid()
            AND tm.role IN ('owner', 'admin')
        )
    );

-- Users can leave teams (delete their own membership)
CREATE POLICY "Users can leave teams" ON team_members
    FOR DELETE USING (auth.uid() = user_id);

-- Comments for documentation
COMMENT ON POLICY "Public packages are viewable by everyone" ON taptik_packages IS 
    'Allows all users to view packages marked as public';
COMMENT ON POLICY "Users can manage their own packages" ON taptik_packages IS 
    'Allows users full control over their own packages';
COMMENT ON POLICY "Team members can view team packages" ON taptik_packages IS 
    'Allows team members to view packages owned by their team';