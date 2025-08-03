import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | null = null;

// Lazy initialization of Supabase client
export const getSupabaseClient = (): SupabaseClient => {
  if (!supabaseClient) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    // Validate environment variables
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error(
        'Missing Supabase environment variables. Please ensure SUPABASE_URL and SUPABASE_ANON_KEY are set in your .env file.',
      );
    }

    // Create Supabase client instance
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }

  return supabaseClient;
};

// Export for convenience
export const supabase = getSupabaseClient;

// Export types for use in other parts of the application
export type { User, Session, AuthError } from '@supabase/supabase-js';
