import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { Session, User as SupabaseUser } from '@supabase/supabase-js';

import { User, UserSession, fromSupabaseUser } from '../../models/user.model';
import { getSupabaseClient } from '../../supabase/supabase-client';
import { AuthProviderType, AuthenticationResult, AuthErrorCode, AuthError } from './types';

import { SessionService } from './services/session.service';
import { OAuthProviderService } from './services/oauth-provider.service';

@Injectable()
export class AuthService {
  private supabase = getSupabaseClient();
  private sessionService = new SessionService();
  private oauthProviderService: OAuthProviderService;

  constructor(private readonly configService: ConfigService) {
    this.oauthProviderService = new OAuthProviderService(this.configService);
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
   * Login with OAuth provider (Google or GitHub)
   */
  async loginWithProvider(provider: AuthProviderType): Promise<AuthenticationResult> {
    try {
      console.log(`🔄 Starting ${provider} OAuth login...`);

      // Start OAuth flow using the provider service
      const callbackUrl = await this.oauthProviderService.startOAuthFlow(provider);

      // Handle the OAuth callback and get token data
      const oauthData = await this.oauthProviderService.handleOAuthCallback(callbackUrl);

      // Create session from OAuth data
      const session = await this.createSessionFromOAuthData(oauthData);

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
          duration: 0, // Will be calculated in real implementation
        },
      };
    } catch (error) {
      console.error('OAuth login failed:', error);

      const authError: AuthError = error instanceof Error && 'code' in error
        ? error as AuthError
        : {
            code: AuthErrorCode.OAUTH_FLOW_FAILED,
            message: `OAuth login failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            recoverable: true,
            suggestions: [
              'Check internet connection',
              'Verify OAuth provider configuration',
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
      // Always stop the callback server
      try {
        await this.oauthProviderService.stopCallbackServer();
      } catch (error) {
        console.warn('Warning: Failed to stop callback server cleanly:', error);
      }
    }
  }


  /**
   * Process OAuth callback URL manually (for CLI usage)
   * This method can be called when user provides the callback URL manually
   */
  async processOAuthCallbackUrl(callbackUrl: string): Promise<AuthenticationResult> {
    try {
      // Handle the OAuth callback using the provider service
      const oauthData = await this.oauthProviderService.handleOAuthCallback(callbackUrl);
      
      // Create session from OAuth data
      const session = await this.createSessionFromOAuthData(oauthData);
      
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
      const authError: AuthError = error instanceof Error && 'code' in error
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
   * Helper method to create UserSession from OAuth callback data
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
    } catch (error) {
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
