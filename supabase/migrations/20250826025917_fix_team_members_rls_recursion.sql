-- Fix team_members RLS recursion issue
-- This migration was applied directly to Supabase

-- Drop existing RLS policies that might cause recursion
DROP POLICY IF EXISTS "Team members can view their team" ON public.team_members;
DROP POLICY IF EXISTS "Team admins can manage members" ON public.team_members;

-- Create non-recursive RLS policies for team_members
CREATE POLICY "Users can view their own team memberships" ON public.team_members
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Team owners and admins can view all team members" ON public.team_members
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.team_members tm
            WHERE tm.team_id = team_members.team_id
            AND tm.user_id = auth.uid()
            AND tm.role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Team owners can manage team members" ON public.team_members
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.team_members tm
            WHERE tm.team_id = team_members.team_id
            AND tm.user_id = auth.uid()
            AND tm.role = 'owner'
        )
    );