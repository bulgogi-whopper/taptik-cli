import { User as SupabaseUser } from '@supabase/supabase-js';

/**
 * User model interface extending Supabase User type
 * Provides type safety for user data throughout the application
 */
export interface User {
  id: string;
  email: string;
  username?: string;
  fullName?: string;
  avatarUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  lastSignInAt?: Date;
  emailConfirmedAt?: Date;
  phone?: string;
  phoneConfirmedAt?: Date;
  role?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Convert Supabase User to our User model
 */
export function fromSupabaseUser(supabaseUser: SupabaseUser): User {
  return {
    id: supabaseUser.id,
    email: supabaseUser.email ?? '',
    username: supabaseUser.user_metadata?.username,
    fullName: supabaseUser.user_metadata?.full_name,
    avatarUrl: supabaseUser.user_metadata?.avatar_url,
    createdAt: new Date(supabaseUser.created_at ?? ''),
    updatedAt: new Date(supabaseUser.updated_at ?? ''),
    lastSignInAt: supabaseUser.last_sign_in_at
      ? new Date(supabaseUser.last_sign_in_at)
      : undefined,
    emailConfirmedAt: supabaseUser.email_confirmed_at
      ? new Date(supabaseUser.email_confirmed_at)
      : undefined,
    phone: supabaseUser.phone,
    phoneConfirmedAt: supabaseUser.phone_confirmed_at
      ? new Date(supabaseUser.phone_confirmed_at)
      : undefined,
    role: supabaseUser.role,
    metadata: supabaseUser.user_metadata,
  };
}

/**
 * User session model
 */
export interface UserSession {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}
