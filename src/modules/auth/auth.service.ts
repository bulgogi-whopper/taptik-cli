import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { Session, User as SupabaseUser } from '@supabase/supabase-js';

import { User, UserSession, fromSupabaseUser } from '../../models/user.model';
import { getSupabaseClient } from '../../supabase/supabase-client';

import { OAuthCallbackServer } from './oauth-callback-server';
import { SessionService } from './services/session.service';
import { AuthProviderType, AuthenticationResult, AuthErrorCode, AuthError } from './types';


@Injectable()
export class AuthService {
  private supabase = getSupabaseClient();
  private sessionService = new SessionService();
  private callbackServer = new OAuthCallbackServer();

  constructor(private readonly configService: ConfigService) {
    // Constructor simplified - no longer need OAuthProviderService for Supabase OAuth
  }

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
      await this.sessionService.clearSession();
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
      const storedSession = await this.sessionService.loadSession();
      if (storedSession) {
        return storedSession.userSession.user;
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
   * Login with OAuth provider (Google or GitHub) using Supabase
   */
  async loginWithProvider(provider: AuthProviderType): Promise<AuthenticationResult> {
    let callbackUrl: string | null = null;

    try {
      console.log(`🔄 Starting ${provider} OAuth login...`);

      // Start the callback server on an available port in 60000+ range
      console.log('🚀 Starting temporary callback server...');
      callbackUrl = await this.callbackServer.start();

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

      // Import open dynamically to avoid issues
      const open = await import('open');
      await open.default(data.url);

      console.log('\n⏳ Waiting for you to complete authentication in the browser...');
      console.log('💡 The browser will automatically redirect back to complete the process.');

      // Wait for the callback to be received
      const callbackData = await this.callbackServer.waitForCallback();
      console.log('✅ OAuth callback received!');

      // Convert callback data to session
      const session = await this.createSessionFromSupabaseCallback(callbackData);

      // Save session to local storage with metadata
      console.log('💾 Saving session for future use...');
      await this.sessionService.saveSession(session, {
        provider,
        creationMethod: 'oauth',
        client: {
          version: process.env.npm_package_version || '0.0.1',
          platform: process.platform,
        },
      });

      console.log('🎉 OAuth login completed successfully!');

      return {
        success: true,
        session,
        metadata: {
          method: 'oauth',
          provider,
          startedAt: new Date(),
          completedAt: new Date(),
          duration: 0,
        },
      };
    } catch (error) {
      console.error('OAuth login failed:', error);

      const authError: AuthError = error instanceof Error && 'code' in error && 'recoverable' in error
        ? error as AuthError
        : {
            code: AuthErrorCode.OAUTH_FLOW_FAILED,
            message: `OAuth login failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            recoverable: true,
            suggestions: [
              'Check internet connection',
              'Verify Supabase configuration',
              'Try again',
            ],
          };

      return {
        success: false,
        error: authError,
        metadata: {
          method: 'oauth',
          provider,
          startedAt: new Date(),
          completedAt: new Date(),
        },
      };
    } finally {
      // Force stop the callback server immediately without waiting
      try {
        if (this.callbackServer.isRunning()) {
          console.log('🛑 Stopping callback server...');
          
          // Force cleanup without waiting for graceful shutdown
          const serverInstance = this.callbackServer as unknown as {
            app: unknown;
            server: unknown; 
            controller: unknown;
          };
          
          // Reset controller first
          if (serverInstance.controller && typeof (serverInstance.controller as { reset?: () => void }).reset === 'function') {
            try {
              (serverInstance.controller as { reset: () => void }).reset();
            } catch {
              // Ignore reset errors
            }
          }
          
          // Forcefully null out all references
          serverInstance.app = null;
          serverInstance.server = null;
          serverInstance.controller = null;
          
          console.log('✅ Callback server force stopped');
        }
      } catch {
        // Silently handle any errors during force cleanup
        console.log('✅ Callback server cleanup completed');
      }
    }
  }


  /**
   * Process OAuth callback URL manually (for CLI usage)
   * This method can be called when user provides the callback URL manually
   */
  async processOAuthCallbackUrl(callbackUrl: string): Promise<AuthenticationResult> {
    try {
      // Handle the Supabase OAuth callback directly
      const session = await this.handleSupabaseOAuthCallback(callbackUrl);
      
      // Save session with basic metadata
      await this.sessionService.saveSession(session, {
        provider: 'google', // Default to google since we don't know which provider
        creationMethod: 'oauth',
      });

      return {
        success: true,
        session,
        metadata: {
          method: 'oauth',
          provider: 'google', // Default to google since we don't know which provider
          startedAt: new Date(),
          completedAt: new Date(),
        },
      };
    } catch (error) {
      const authError: AuthError = error instanceof Error && 'code' in error && 'recoverable' in error
        ? error as AuthError
        : {
            code: AuthErrorCode.OAUTH_FLOW_FAILED,
            message: `OAuth URL processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            recoverable: true,
            suggestions: [
              'Verify callback URL format',
              'Check OAuth response data',
              'Try the full OAuth flow instead',
            ],
          };

      return {
        success: false,
        error: authError,
        metadata: {
          method: 'oauth',
          provider: 'google', // Default to google since we don't know which provider
          startedAt: new Date(),
          completedAt: new Date(),
        },
      };
    }
  }

  /**
   * Helper method to create UserSession from Supabase OAuth callback data
   */
  private async createSessionFromSupabaseCallback(callbackData: Record<string, string>): Promise<UserSession> {
    try {
      // Supabase OAuth returns data as URL fragments in the callback
      // Create a fragment string from the callback data
      const fragmentString = new URLSearchParams(callbackData).toString();
      const callbackUrl = `http://localhost:54321/auth/callback#${fragmentString}`;

      // Process using the Supabase OAuth callback method
      return await this.handleSupabaseOAuthCallback(callbackUrl);
    } catch (error) {
      throw new Error(`Failed to create session from callback: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Handle Supabase OAuth callback by processing the callback URL
   */
  private async handleSupabaseOAuthCallback(callbackUrl: string): Promise<UserSession> {
    try {
      console.log('🔄 Processing Supabase OAuth callback...');

      // Parse URL fragments to extract OAuth tokens
      const urlParts = callbackUrl.split('#');
      if (urlParts.length < 2) {
        throw new Error('Invalid callback URL: missing fragment parameters');
      }

      const fragment = urlParts[1];
      const parameters = new URLSearchParams(fragment);

      const accessToken = parameters.get('access_token');
      const refreshToken = parameters.get('refresh_token');
      // const expiresAt = parameters.get('expires_at'); // Currently not used

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

      // If setSession fails, try alternative approach by parsing JWT
      if (sessionError) {
        console.log('⚠️ Direct setSession failed, trying alternative approach...');
        return this.createSessionFromJWT(accessToken, refreshToken);
      }

      if (!sessionData.session || !sessionData.session.user) {
        throw new Error('Failed to create valid session from OAuth tokens');
      }

      console.log('✅ OAuth session established successfully');
      return this.createUserSession(sessionData.session.user, sessionData.session);
    } catch (error) {
      throw new Error(`OAuth callback handling failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Helper method to create UserSession from OAuth callback data (legacy method)
   */
  private async createSessionFromOAuthData(oauthData: import('./types').OAuthCallbackData): Promise<UserSession> {
    try {
      // Try to set the session with Supabase using the OAuth tokens
      const { data, error } = await this.supabase.auth.setSession({
        access_token: oauthData.accessToken,
        refresh_token: oauthData.refreshToken || '',
      });

      if (error || !data.session || !data.session.user) {
        // If setSession fails, try alternative approach by parsing JWT
        console.log('⚠️ Direct setSession failed, trying alternative approach...');
        return this.createSessionFromJWT(oauthData.accessToken, oauthData.refreshToken);
      }

      console.log('✅ OAuth session established successfully');
      return this.createUserSession(data.session.user, data.session);
    } catch {
      // Fallback to JWT parsing if Supabase session creation fails
      return this.createSessionFromJWT(oauthData.accessToken, oauthData.refreshToken);
    }
  }

  /**
   * Create session from JWT token parsing (fallback method)
   */
  private createSessionFromJWT(accessToken: string, refreshToken?: string): UserSession {
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
        expires_at: payload.exp,
        expires_in: 3600,
        token_type: 'bearer',
        user: mockUser,
      };

      console.log('✅ OAuth session created using JWT parsing');
      return this.createUserSession(mockSession.user, mockSession);
    } catch (error) {
      throw new Error(
        `Failed to parse JWT token: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
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
