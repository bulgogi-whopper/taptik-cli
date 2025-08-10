import { Injectable } from '@nestjs/common';

import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import open from 'open';

import { User, UserSession, fromSupabaseUser } from '../../models/user.model';
import { getSupabaseClient } from '../../supabase/supabase-client';

import { OAuthCallbackServer } from './oauth-callback-server';
import { SessionStorage } from './session-storage';

@Injectable()
export class AuthService {
  private supabase = getSupabaseClient();
  private callbackServer = new OAuthCallbackServer();
  private sessionStorage = new SessionStorage();

  /**
   * Logout the current user
   */
  async logout(): Promise<void> {
    try {
      const { error } = await this.supabase.auth.signOut();

      if (error) {
        throw new Error(`Logout failed: ${error.message}`);
      }

      // Clear stored session
      await this.sessionStorage.clearSession();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Logout failed: Unknown error occurred');
    }
  }

  /**
   * Get the current authenticated user
   */
  async getCurrentUser(): Promise<User | null> {
    try {
      // First check if we have a stored session
      const storedSession = await this.sessionStorage.loadSession();
      if (storedSession) {
        return storedSession.user;
      }

      // If no stored session, check Supabase
      const {
        data: { user },
        error,
      } = await this.supabase.auth.getUser();
      if (error) {
        return null;
      }

      if (!user) {
        return null;
      }

      return fromSupabaseUser(user);
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to get user: Unknown error occurred');
    }
  }

  /**
   * Get the current session
   */
  async getSession(): Promise<UserSession | null> {
    try {
      const {
        data: { session },
        error,
      } = await this.supabase.auth.getSession();

      if (error) {
        throw new Error(`Failed to get session: ${error.message}`);
      }

      if (!session || !session.user) {
        return null;
      }

      return this.createUserSession(session.user, session);
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to get session: Unknown error occurred');
    }
  }

  /**
   * Refresh the current session
   */
  async refreshSession(): Promise<UserSession | null> {
    try {
      const {
        data: { session },
        error,
      } = await this.supabase.auth.refreshSession();

      if (error) {
        throw new Error(`Failed to refresh session: ${error.message}`);
      }

      if (!session || !session.user) {
        return null;
      }

      return this.createUserSession(session.user, session);
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to refresh session: Unknown error occurred');
    }
  }

  /**
   * Login with OAuth provider (Google or GitHub)
   */
  async loginWithProvider(provider: 'google' | 'github'): Promise<UserSession> {
    let callbackUrl: string | null = null;

    try {
      console.log(`🔄 Starting ${provider} OAuth login...`);

      // Start the callback server
      console.log('🚀 Starting temporary callback server...');
      callbackUrl = await this.callbackServer.start(54_321);

      // Use Supabase's signInWithOAuth method with our callback server
      const { data, error } = await this.supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: callbackUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        throw new Error(`OAuth login failed: ${error.message}`);
      }

      if (!data.url) {
        throw new Error('No OAuth URL provided by Supabase');
      }

      console.log('🌐 Opening browser for authentication...');
      console.log(`📡 Callback server listening on: ${callbackUrl}`);

      // Open the OAuth URL in the user's default browser
      await open(data.url);

      console.log(
        '\n⏳ Waiting for you to complete authentication in the browser...',
      );
      console.log(
        '💡 The browser will automatically redirect back to complete the process.',
      );

      // Wait for the callback to be received
      const callbackData = await this.callbackServer.waitForCallback();
      console.log('✅ OAuth callback received!');

      // Supabase OAuth returns data as URL fragments, not query params
      // Convert query params back to fragments for our existing handler
      const fragmentString = new URLSearchParams(callbackData).toString();
      const fullCallbackUrl = `${callbackUrl}#${fragmentString}`;

      // Process the callback data
      const session = await this.handleOAuthCallback(fullCallbackUrl);

      // Save session to local storage
      console.log('💾 Saving session for future use...');
      await this.sessionStorage.saveSession(session);

      console.log('🎉 OAuth login completed successfully!');
      return session;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('OAuth login failed: Unknown error occurred');
    } finally {
      // Always stop the callback server
      if (this.callbackServer.isRunning()) {
        console.log('🛑 Stopping callback server...');
        try {
          await this.callbackServer.stop();
        } catch {
          console.warn('Warning: Failed to stop callback server cleanly');
        }
      }
    }
  }

  /**
   * Handle OAuth callback by processing the callback URL
   * Extracts session data from URL fragments (access_token, refresh_token, etc.)
   */
  async handleOAuthCallback(callbackUrl: string): Promise<UserSession> {
    try {
      console.log('🔄 Processing OAuth callback...');

      // Parse URL fragments to extract OAuth tokens
      const urlParts = callbackUrl.split('#');
      if (urlParts.length < 2) {
        throw new Error('Invalid callback URL: missing fragment parameters');
      }

      const fragment = urlParts[1];
      const parameters = new URLSearchParams(fragment);

      const accessToken = parameters.get('access_token');
      const refreshToken = parameters.get('refresh_token');
      const expiresAt = parameters.get('expires_at');

      if (!accessToken) {
        throw new Error('No access token found in callback URL');
      }

      console.log('✅ OAuth tokens extracted successfully');

      // Try to set the session with both tokens
      let sessionData;
      let sessionError;

      try {
        const { data, error } = await this.supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || '',
        });
        sessionData = data;
        sessionError = error;
      } catch (error) {
        sessionError = error;
      }

      // If setSession fails (e.g., refresh token expired), try alternative approach
      if (sessionError) {
        console.log(
          '⚠️ Direct setSession failed, trying alternative approach...',
        );

        // Parse JWT to get user info directly
        try {
          const parts = accessToken.split('.');
          if (parts.length !== 3) {
            throw new Error('Invalid JWT format');
          }

          const payload = JSON.parse(
            Buffer.from(parts[1], 'base64').toString(),
          );

          // Create a mock session from the JWT data with proper Supabase User structure
          const mockUser: SupabaseUser = {
            id: payload.sub,
            aud: payload.aud,
            role: payload.role,
            email: payload.user_metadata?.email || '',
            email_confirmed_at: null,
            phone: null,
            phone_confirmed_at: null,
            confirmed_at: null,
            last_sign_in_at: new Date().toISOString(),
            app_metadata: payload.app_metadata || {},
            user_metadata: payload.user_metadata || {},
            identities: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            is_anonymous: false,
          };

          const mockSession = {
            access_token: accessToken,
            refresh_token: refreshToken || '',
            expires_at: expiresAt ? Number.parseInt(expiresAt) : payload.exp,
            expires_in: 3600,
            token_type: 'bearer',
            user: mockUser,
          };

          console.log('✅ OAuth session created using JWT parsing');

          // Create and return our UserSession from the parsed data
          return this.createUserSession(mockSession.user, mockSession);
        } catch (jwtError) {
          throw new Error(
            `Failed to parse JWT token: ${jwtError instanceof Error ? jwtError.message : 'Unknown error'}`,
          );
        }
      }

      if (!sessionData.session || !sessionData.session.user) {
        throw new Error('Failed to create valid session from OAuth tokens');
      }

      console.log('✅ OAuth session established successfully');

      // Create and return our UserSession from the Supabase session
      return this.createUserSession(
        sessionData.session.user,
        sessionData.session,
      );
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('OAuth callback handling failed: Unknown error occurred');
    }
  }

  /**
   * Process OAuth callback URL manually (for CLI usage)
   * This method can be called when user provides the callback URL manually
   */
  async processOAuthCallbackUrl(callbackUrl: string): Promise<UserSession> {
    try {
      // Parse the callback URL and handle the OAuth response
      return await this.handleOAuthCallback(callbackUrl);
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('OAuth URL processing failed: Unknown error occurred');
    }
  }

  /**
   * Helper method to create UserSession from Supabase data
   */
  private createUserSession(user: SupabaseUser, session: Session): UserSession {
    return {
      user: fromSupabaseUser(user),
      accessToken: session.access_token,
      refreshToken: session.refresh_token || '',
      expiresAt: new Date(session.expires_at! * 1000),
    };
  }
}
