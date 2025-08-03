import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';

// Mock the @supabase/supabase-js module
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

describe('SupabaseClient', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset modules before each test
    vi.resetModules();
    // Reset environment variables
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  it('should create a Supabase client with valid environment variables', async () => {
    // Arrange
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'test-anon-key';

    const mockClient = {
      auth: {
        getSession: vi
          .fn()
          .mockResolvedValue({ data: { session: null }, error: null }),
      },
    };
    (createClient as any).mockReturnValue(mockClient);

    // Act - Dynamically import after setting env vars
    const { getSupabaseClient } = await import('./supabase-client');
    const client = getSupabaseClient();

    // Assert
    expect(createClient).toHaveBeenCalledWith(
      'https://test.supabase.co',
      'test-anon-key',
      expect.objectContaining({
        auth: expect.objectContaining({
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        }),
      }),
    );
    expect(client).toBe(mockClient);
  });

  it('should throw an error when SUPABASE_URL is missing', async () => {
    // Arrange
    delete process.env.SUPABASE_URL;
    process.env.SUPABASE_ANON_KEY = 'test-anon-key';

    // Act & Assert
    const { getSupabaseClient } = await import('./supabase-client');
    expect(() => getSupabaseClient()).toThrow(
      'Missing Supabase environment variables. Please ensure SUPABASE_URL and SUPABASE_ANON_KEY are set in your .env file.',
    );
  });

  it('should throw an error when SUPABASE_ANON_KEY is missing', async () => {
    // Arrange
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    delete process.env.SUPABASE_ANON_KEY;

    // Act & Assert
    const { getSupabaseClient } = await import('./supabase-client');
    expect(() => getSupabaseClient()).toThrow(
      'Missing Supabase environment variables. Please ensure SUPABASE_URL and SUPABASE_ANON_KEY are set in your .env file.',
    );
  });

  it('should return the same client instance on multiple calls (singleton)', async () => {
    // Arrange
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'test-anon-key';

    const mockClient = {
      auth: {
        getSession: vi
          .fn()
          .mockResolvedValue({ data: { session: null }, error: null }),
      },
    };
    (createClient as any).mockReturnValue(mockClient);

    // Act
    const { getSupabaseClient } = await import('./supabase-client');
    const client1 = getSupabaseClient();
    const client2 = getSupabaseClient();

    // Assert
    expect(client1).toBe(client2);
    expect(createClient).toHaveBeenCalledTimes(1); // Should only be called once
  });

  it('should export convenience function', async () => {
    // Arrange
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'test-anon-key';

    const mockClient = {
      auth: {
        getSession: vi
          .fn()
          .mockResolvedValue({ data: { session: null }, error: null }),
      },
    };
    (createClient as any).mockReturnValue(mockClient);

    // Act
    const { supabase } = await import('./supabase-client');

    // Assert
    expect(typeof supabase).toBe('function');
    expect(supabase()).toBe(mockClient);
  });
});
