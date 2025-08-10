import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import open from 'open';

import { OAuthCallbackServer } from '../oauth-callback-server';
import {
  IOAuthProviderService,
  AuthProviderType,
  AuthProvider,
  OAuthCallbackData,
  CallbackServerConfig,
  ProviderOAuthConfig,
  AuthError,
  AuthErrorCode,
} from '../types';

/**
 * OAuth provider service that handles provider-specific authentication flows,
 * configuration management, and callback server orchestration
 */
@Injectable()
export class OAuthProviderService implements IOAuthProviderService {
  private readonly logger = new Logger(OAuthProviderService.name);
  private callbackServer: OAuthCallbackServer;
  private readonly providerConfigs: Map<AuthProviderType, AuthProvider>;
  private readonly oauthConfigs: ProviderOAuthConfig;

  constructor(private readonly configService: ConfigService) {
    this.callbackServer = new OAuthCallbackServer();
    this.providerConfigs = new Map();
    this.oauthConfigs = this.getDefaultOAuthConfigs();
    
    this.initializeProviders();
  }

  /**
   * Start OAuth flow for specified provider
   */
  async startOAuthFlow(provider: AuthProviderType): Promise<string> {
    try {
      this.logger.log(`🔄 Starting ${provider} OAuth login...`);

      // Validate provider configuration
      if (!this.validateProviderConfig(provider)) {
        throw this.createAuthError(
          AuthErrorCode.PROVIDER_CONFIG_INVALID,
          `Invalid configuration for ${provider} provider`,
          [`Check ${provider} OAuth configuration`, 'Verify environment variables']
        );
      }

      // Start the callback server
      this.logger.log('🚀 Starting temporary callback server...');
      const callbackUrl = await this.startCallbackServer();

      // Get provider configuration
      const providerConfig = this.getProviderConfig(provider);
      const oauthConfig = this.oauthConfigs[provider];

      // Build OAuth authorization URL
      const authUrl = this.buildAuthorizationUrl(
        providerConfig,
        oauthConfig,
        callbackUrl
      );

      this.logger.log('🌐 Opening browser for authentication...');
      this.logger.log(`📡 Callback server listening on: ${callbackUrl}`);

      // Open the OAuth URL in the user's default browser
      await open(authUrl);

      this.logger.log('\n⏳ Waiting for you to complete authentication in the browser...');
      this.logger.log('💡 The browser will automatically redirect back to complete the process.');

      return callbackUrl;
    } catch (error) {
      // Clean up callback server if it was started
      if (this.callbackServer.isRunning()) {
        await this.stopCallbackServer();
      }

      if (error instanceof Error && 'code' in error) {
        throw error; // Already an AuthError
      }

      throw this.createAuthError(
        AuthErrorCode.OAUTH_FLOW_FAILED,
        `Failed to start OAuth flow: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ['Check internet connection', 'Verify OAuth provider configuration', 'Try again']
      );
    }
  }

  /**
   * Handle OAuth callback and extract token data
   */
  async handleOAuthCallback(callbackUrl: string): Promise<OAuthCallbackData> {
    try {
      this.logger.log('🔄 Processing OAuth callback...');

      // Wait for the callback to be received
      const callbackData = await this.callbackServer.waitForCallback();
      this.logger.log('✅ OAuth callback received!');

      // Parse and validate callback data - this might throw AuthError
      const parsedData = this.parseCallbackData(callbackUrl, callbackData);

      this.logger.log('✅ OAuth tokens extracted successfully');
      return parsedData;
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error; // Already an AuthError
      }

      throw this.createAuthError(
        AuthErrorCode.OAUTH_FLOW_FAILED,
        `Failed to handle OAuth callback: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ['Check callback URL format', 'Verify OAuth response structure']
      );
    }
  }

  /**
   * Get provider configuration for specified provider
   */
  getProviderConfig(provider: AuthProviderType): AuthProvider {
    const config = this.providerConfigs.get(provider);
    if (!config) {
      throw this.createAuthError(
        AuthErrorCode.PROVIDER_CONFIG_INVALID,
        `Provider configuration not found: ${provider}`,
        [`Add ${provider} provider configuration`, 'Check supported providers']
      );
    }
    return config;
  }

  /**
   * Validate provider configuration
   */
  validateProviderConfig(provider: AuthProviderType): boolean {
    try {
      const config = this.providerConfigs.get(provider);
      if (!config) {
        return false;
      }

      // Validate required fields
      if (!config.name || !config.authUrl || !config.tokenUrl) {
        return false;
      }

      // Validate client ID is present
      if (!config.clientId) {
        return false;
      }

      // Validate scopes
      if (!config.scopes || config.scopes.length === 0) {
        return false;
      }

      // Provider-specific validation
      return this.validateProviderSpecificConfig(provider, config);
    } catch (error) {
      this.logger.error(`Provider validation failed for ${provider}:`, error);
      return false;
    }
  }

  /**
   * Start callback server with optional configuration
   */
  async startCallbackServer(config?: Partial<CallbackServerConfig>): Promise<string> {
    try {
      const port = config?.port || 54_321;

      return await this.callbackServer.start(port);
    } catch (error) {
      throw this.createAuthError(
        AuthErrorCode.CALLBACK_SERVER_ERROR,
        `Failed to start callback server: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ['Check port availability', 'Verify firewall settings', 'Try a different port']
      );
    }
  }

  /**
   * Stop callback server and clean up resources
   */
  async stopCallbackServer(): Promise<void> {
    try {
      if (this.callbackServer.isRunning()) {
        this.logger.log('🛑 Stopping callback server...');
        await this.callbackServer.stop();
      }
    } catch (error) {
      this.logger.warn('Warning: Failed to stop callback server cleanly:', error);
      throw this.createAuthError(
        AuthErrorCode.CALLBACK_SERVER_ERROR,
        `Failed to stop callback server: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ['Force quit the application', 'Check running processes']
      );
    }
  }

  /**
   * Get supported providers list
   */
  getSupportedProviders(): AuthProviderType[] {
    return [...this.providerConfigs.keys()];
  }

  /**
   * Check if provider is supported
   */
  isProviderSupported(provider: string): provider is AuthProviderType {
    return this.providerConfigs.has(provider as AuthProviderType);
  }

  /**
   * Get OAuth configuration for provider
   */
  getOAuthConfig(provider: AuthProviderType): ProviderOAuthConfig[AuthProviderType] {
    return this.oauthConfigs[provider];
  }

  /**
   * Update provider configuration
   */
  updateProviderConfig(provider: AuthProviderType, config: Partial<AuthProvider>): void {
    const existingConfig = this.providerConfigs.get(provider);
    if (!existingConfig) {
      throw new Error(`Provider ${provider} not found`);
    }

    const updatedConfig: AuthProvider = {
      ...existingConfig,
      ...config,
    };

    this.providerConfigs.set(provider, updatedConfig);
    this.logger.log(`Updated configuration for ${provider} provider`);
  }

  /**
   * Private helper methods
   */

  private initializeProviders(): void {
    // Initialize Google OAuth provider
    const googleClientId = this.configService.get('GOOGLE_CLIENT_ID');
    this.providerConfigs.set('google', {
      name: 'google',
      clientId: googleClientId,
      scopes: ['openid', 'profile', 'email'],
      authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      config: {
        response_type: 'code',
        access_type: 'offline',
        prompt: 'consent',
      },
    });

    // Initialize GitHub OAuth provider
    const githubClientId = this.configService.get('GITHUB_CLIENT_ID');
    this.providerConfigs.set('github', {
      name: 'github',
      clientId: githubClientId,
      scopes: ['user:email', 'read:user'],
      authUrl: 'https://github.com/login/oauth/authorize',
      tokenUrl: 'https://github.com/login/oauth/access_token',
      config: {
        response_type: 'code',
        allow_signup: 'true',
      },
    });

    this.logger.log(`Initialized ${this.providerConfigs.size} OAuth providers`);
  }

  private getDefaultOAuthConfigs(): ProviderOAuthConfig {
    return {
      google: {
        scopes: ['openid', 'profile', 'email'],
        accessType: 'offline',
        prompt: 'consent',
        includeGrantedScopes: false,
      },
      github: {
        scopes: ['user:email', 'read:user'],
        allowSignup: true,
      },
    };
  }

  private buildAuthorizationUrl(
    provider: AuthProvider,
    oauthConfig: ProviderOAuthConfig[AuthProviderType],
    callbackUrl: string
  ): string {
    const parameters = new URLSearchParams({
      client_id: provider.clientId || '',
      redirect_uri: callbackUrl,
      response_type: 'code',
      scope: provider.scopes.join(' '),
    });

    // Add provider-specific parameters
    if (provider.name === 'google') {
      const googleConfig = oauthConfig as ProviderOAuthConfig['google'];
      parameters.set('access_type', googleConfig.accessType);
      parameters.set('prompt', googleConfig.prompt);
      if (googleConfig.includeGrantedScopes) {
        parameters.set('include_granted_scopes', 'true');
      }
    } else if (provider.name === 'github') {
      const githubConfig = oauthConfig as ProviderOAuthConfig['github'];
      if (githubConfig.allowSignup) {
        parameters.set('allow_signup', 'true');
      }
    }

    // Add any additional config parameters (but don't duplicate existing ones)
    if (provider.config) {
      Object.entries(provider.config).forEach(([key, value]) => {
        if (typeof value === 'string' && !parameters.has(key)) {
          parameters.set(key, value);
        }
      });
    }

    return `${provider.authUrl}?${parameters.toString()}`;
  }

  private parseCallbackData(
    callbackUrl: string,
    serverCallbackData: Record<string, string>
  ): OAuthCallbackData {
    // Parse URL fragments to extract OAuth tokens (for implicit flow)
    const urlParts = callbackUrl.split('#');
    let fragmentParameters: URLSearchParams | null = null;
    
    if (urlParts.length > 1) {
      fragmentParameters = new URLSearchParams(urlParts[1]);
    }

    // Parse query parameters (for authorization code flow) from serverCallbackData
    const queryParameters = new URLSearchParams();
    Object.entries(serverCallbackData).forEach(([key, value]) => {
      queryParameters.set(key, value);
    });

    // Extract tokens from either fragments or query params
    const accessToken = fragmentParameters?.get('access_token') || queryParameters.get('access_token') || '';
    const refreshToken = fragmentParameters?.get('refresh_token') || queryParameters.get('refresh_token');
    const expiresAt = fragmentParameters?.get('expires_at') || queryParameters.get('expires_at');
    const state = fragmentParameters?.get('state') || queryParameters.get('state');
    const error = fragmentParameters?.get('error') || queryParameters.get('error') || serverCallbackData.error;
    const errorDescription = fragmentParameters?.get('error_description') || queryParameters.get('error_description') || serverCallbackData.error_description;

    // Check for OAuth errors first
    if (error) {
      throw this.createAuthError(
        AuthErrorCode.OAUTH_FLOW_FAILED,
        `OAuth provider error: ${error}${errorDescription ? ` - ${errorDescription}` : ''}`,
        ['Check OAuth provider settings', 'Verify application permissions', 'Try authenticating again']
      );
    }

    // Check if we have no access token (but also no error)
    if (!accessToken) {
      throw this.createAuthError(
        AuthErrorCode.INVALID_OAUTH_RESPONSE,
        'No access token found in OAuth callback',
        ['Check OAuth provider configuration', 'Verify callback URL format']
      );
    }

    return {
      accessToken,
      refreshToken: refreshToken || undefined,
      expiresAt: expiresAt ? Number.parseInt(expiresAt, 10) : undefined,
      state: state || undefined,
      error: error || undefined,
      errorDescription: errorDescription || undefined,
      additionalParams: Object.fromEntries(
        [...queryParameters.entries()].filter(([key]) => 
          !['access_token', 'refresh_token', 'expires_at', 'state', 'error', 'error_description'].includes(key)
        )
      ),
    };
  }

  private validateProviderSpecificConfig(
    provider: AuthProviderType,
    config: AuthProvider
  ): boolean {
    switch (provider) {
      case 'google':
        // Google requires openid scope for proper user info
        return config.scopes.includes('openid') || 
               config.scopes.includes('profile') || 
               config.scopes.includes('email');
      
      case 'github':
        // GitHub requires user scope for user info
        return config.scopes.some(scope => 
          scope.includes('user') || scope.includes('read:user')
        );
      
      default:
        return true;
    }
  }

  private createAuthError(
    code: AuthErrorCode,
    message: string,
    suggestions: string[] = []
  ): AuthError {
    return {
      code,
      message,
      recoverable: true,
      suggestions,
      details: {
        provider: 'oauth',
        timestamp: new Date().toISOString(),
      },
    };
  }
}