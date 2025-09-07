-- Temporarily disable team RLS for development
-- This migration was applied directly to Supabase

-- Disable RLS on team-related tables temporarily
ALTER TABLE public.teams DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members DISABLE ROW LEVEL SECURITY;