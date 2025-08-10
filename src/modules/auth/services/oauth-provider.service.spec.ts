import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConfigService } from '@nestjs/config';

import { OAuthProviderService } from './oauth-provider.service';
import { AuthErrorCode } from '../types';

// Mock dependencies
const mockConfigService = {
  get: vi.fn(),
};

const mockCallbackServer = {
  start: vi.fn(),
  stop: vi.fn(),
  isRunning: vi.fn(),
  waitForCallback: vi.fn(),
};

// Use vi.hoisted to properly declare mocked variables
const mockOpen = vi.hoisted(() => vi.fn());

// Mock modules
vi.mock('@nestjs/config');
vi.mock('../oauth-callback-server', () => ({
  OAuthCallbackServer: vi.fn(() => mockCallbackServer),
}));
vi.mock('open', () => ({ default: mockOpen }));

describe('OAuthProviderService', () => {
  let oauthProviderService: OAuthProviderService;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup config service defaults
    mockConfigService.get.mockImplementation((key: string) => {
      const configs: Record<string, string> = {
        GOOGLE_CLIENT_ID: 'google-client-id',
        GITHUB_CLIENT_ID: 'github-client-id',
      };
      return configs[key];
    });

    oauthProviderService = new OAuthProviderService(
      mockConfigService as unknown as ConfigService
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default provider configurations', () => {
      const providers = oauthProviderService.getSupportedProviders();
      
      expect(providers).toContain('google');
      expect(providers).toContain('github');
      expect(providers).toHaveLength(2);
    });
  });

  describe('getProviderConfig', () => {
    it('should return configuration for supported provider', () => {
      const googleConfig = oauthProviderService.getProviderConfig('google');
      
      expect(googleConfig.name).toBe('google');
      expect(googleConfig.clientId).toBe('google-client-id');
      expect(googleConfig.scopes).toContain('openid');
      expect(googleConfig.authUrl).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    });

    it('should throw error for unsupported provider', () => {
      expect(() => {
        oauthProviderService.getProviderConfig('unsupported' as any);
      }).toThrow();
    });
  });

  describe('validateProviderConfig', () => {
    it('should return true for valid Google provider config', () => {
      const isValid = oauthProviderService.validateProviderConfig('google');
      expect(isValid).toBe(true);
    });

    it('should return true for valid GitHub provider config', () => {
      const isValid = oauthProviderService.validateProviderConfig('github');
      expect(isValid).toBe(true);
    });

    it('should return false for provider with missing configuration', () => {
      // Create service without config
      mockConfigService.get.mockReturnValue(undefined);
      const serviceWithoutConfig = new OAuthProviderService(
        mockConfigService as unknown as ConfigService
      );
      
      const isValid = serviceWithoutConfig.validateProviderConfig('google');
      expect(isValid).toBe(false);
    });
  });

  describe('startOAuthFlow', () => {
    it('should start OAuth flow successfully', async () => {
      const callbackUrl = 'http://localhost:54321/auth/callback';
      mockCallbackServer.start.mockResolvedValue(callbackUrl);
      mockOpen.mockResolvedValue(undefined);

      const result = await oauthProviderService.startOAuthFlow('google');

      expect(result).toBe(callbackUrl);
      expect(mockCallbackServer.start).toHaveBeenCalledWith(54321);
      expect(mockOpen).toHaveBeenCalled();
    });

    it('should throw error when provider config is invalid', async () => {
      // Create a service with empty config to force validation failure
      mockConfigService.get.mockReturnValue(undefined);
      const invalidConfigService = new OAuthProviderService(
        mockConfigService as unknown as ConfigService
      );

      await expect(invalidConfigService.startOAuthFlow('google')).rejects.toMatchObject({
        code: AuthErrorCode.PROVIDER_CONFIG_INVALID,
        message: expect.stringContaining('Invalid configuration for google'),
        recoverable: true,
      });
    });

    it('should clean up callback server on error', async () => {
      mockCallbackServer.start.mockResolvedValue('http://localhost:54321/auth/callback');
      mockCallbackServer.isRunning.mockReturnValue(true);
      mockOpen.mockRejectedValue(new Error('Browser not available'));

      await expect(oauthProviderService.startOAuthFlow('google')).rejects.toThrow();
      expect(mockCallbackServer.stop).toHaveBeenCalled();
    });

    it('should generate correct authorization URL for Google', async () => {
      const callbackUrl = 'http://localhost:54321/auth/callback';
      mockCallbackServer.start.mockResolvedValue(callbackUrl);
      mockOpen.mockResolvedValue(undefined);

      await oauthProviderService.startOAuthFlow('google');

      const openCall = mockOpen.mock.calls[0][0] as string;
      expect(openCall).toContain('accounts.google.com/o/oauth2/v2/auth');
      expect(openCall).toContain('client_id=google-client-id');
      expect(openCall).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A54321%2Fauth%2Fcallback');
      expect(openCall).toContain('response_type=code');
      expect(openCall).toContain('scope=openid+profile+email');
      expect(openCall).toContain('access_type=offline');
      expect(openCall).toContain('prompt=consent');
    });

    it('should generate correct authorization URL for GitHub', async () => {
      const callbackUrl = 'http://localhost:54321/auth/callback';
      mockCallbackServer.start.mockResolvedValue(callbackUrl);
      mockOpen.mockResolvedValue(undefined);

      await oauthProviderService.startOAuthFlow('github');

      const openCall = mockOpen.mock.calls[0][0] as string;
      expect(openCall).toContain('github.com/login/oauth/authorize');
      expect(openCall).toContain('client_id=github-client-id');
      expect(openCall).toContain('scope=user%3Aemail+read%3Auser');
      expect(openCall).toContain('allow_signup=true');
    });
  });

  describe('handleOAuthCallback', () => {
    it('should handle OAuth callback successfully', async () => {
      const mockCallbackData = {
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        expires_at: '3600',
        state: 'test-state',
      };

      mockCallbackServer.waitForCallback.mockResolvedValue(mockCallbackData);

      const callbackUrl = 'http://localhost:54321/auth/callback#access_token=test-access-token&refresh_token=test-refresh-token';
      const result = await oauthProviderService.handleOAuthCallback(callbackUrl);

      expect(result).toMatchObject({
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresAt: 3600,
        state: 'test-state',
      });
    });

    it('should handle callback with query parameters', async () => {
      const mockCallbackData = {
        access_token: 'query-access-token',
        code: 'auth-code',
      };

      mockCallbackServer.waitForCallback.mockResolvedValue(mockCallbackData);

      const callbackUrl = 'http://localhost:54321/auth/callback?code=auth-code';
      const result = await oauthProviderService.handleOAuthCallback(callbackUrl);

      expect(result).toMatchObject({
        accessToken: 'query-access-token',
        additionalParams: {
          code: 'auth-code',
        },
      });
    });

    it('should throw error when no access token is found', async () => {
      const mockCallbackData = {
        error: 'access_denied',
        error_description: 'User denied access',
      };

      mockCallbackServer.waitForCallback.mockResolvedValue(mockCallbackData);

      const callbackUrl = 'http://localhost:54321/auth/callback';
      
      await expect(oauthProviderService.handleOAuthCallback(callbackUrl)).rejects.toMatchObject({
        code: AuthErrorCode.OAUTH_FLOW_FAILED,
        message: expect.stringContaining('OAuth provider error: access_denied'),
      });
    });

    it('should throw error when callback server fails', async () => {
      mockCallbackServer.waitForCallback.mockRejectedValue(new Error('Callback timeout'));

      const callbackUrl = 'http://localhost:54321/auth/callback';
      
      await expect(oauthProviderService.handleOAuthCallback(callbackUrl)).rejects.toMatchObject({
        code: AuthErrorCode.OAUTH_FLOW_FAILED,
        message: expect.stringContaining('Failed to handle OAuth callback'),
      });
    });
  });

  describe('startCallbackServer', () => {
    it('should start callback server with default config', async () => {
      const callbackUrl = 'http://localhost:54321/auth/callback';
      mockCallbackServer.start.mockResolvedValue(callbackUrl);

      const result = await oauthProviderService.startCallbackServer();

      expect(result).toBe(callbackUrl);
      expect(mockCallbackServer.start).toHaveBeenCalledWith(54321);
    });

    it('should start callback server with custom config', async () => {
      const callbackUrl = 'http://localhost:8080/auth/callback';
      mockCallbackServer.start.mockResolvedValue(callbackUrl);

      const customConfig = { port: 8080, host: 'localhost' };
      const result = await oauthProviderService.startCallbackServer(customConfig);

      expect(result).toBe(callbackUrl);
      expect(mockCallbackServer.start).toHaveBeenCalledWith(8080);
    });

    it('should throw error when callback server fails to start', async () => {
      mockCallbackServer.start.mockRejectedValue(new Error('Port already in use'));

      await expect(oauthProviderService.startCallbackServer()).rejects.toMatchObject({
        code: AuthErrorCode.CALLBACK_SERVER_ERROR,
        message: expect.stringContaining('Failed to start callback server'),
      });
    });
  });

  describe('stopCallbackServer', () => {
    it('should stop callback server successfully', async () => {
      mockCallbackServer.isRunning.mockReturnValue(true);
      mockCallbackServer.stop.mockResolvedValue(undefined);

      await oauthProviderService.stopCallbackServer();

      expect(mockCallbackServer.stop).toHaveBeenCalled();
    });

    it('should not attempt to stop if server is not running', async () => {
      mockCallbackServer.isRunning.mockReturnValue(false);

      await oauthProviderService.stopCallbackServer();

      expect(mockCallbackServer.stop).not.toHaveBeenCalled();
    });

    it('should throw error when server fails to stop', async () => {
      mockCallbackServer.isRunning.mockReturnValue(true);
      mockCallbackServer.stop.mockRejectedValue(new Error('Failed to stop server'));

      await expect(oauthProviderService.stopCallbackServer()).rejects.toMatchObject({
        code: AuthErrorCode.CALLBACK_SERVER_ERROR,
        message: expect.stringContaining('Failed to stop callback server'),
      });
    });
  });

  describe('provider management', () => {
    it('should return list of supported providers', () => {
      const providers = oauthProviderService.getSupportedProviders();
      
      expect(providers).toEqual(['google', 'github']);
    });

    it('should check if provider is supported', () => {
      expect(oauthProviderService.isProviderSupported('google')).toBe(true);
      expect(oauthProviderService.isProviderSupported('github')).toBe(true);
      expect(oauthProviderService.isProviderSupported('facebook')).toBe(false);
    });

    it('should get OAuth configuration for provider', () => {
      const googleConfig = oauthProviderService.getOAuthConfig('google');
      
      expect(googleConfig).toMatchObject({
        scopes: ['openid', 'profile', 'email'],
        accessType: 'offline',
        prompt: 'consent',
        includeGrantedScopes: false,
      });
    });

    it('should update provider configuration', () => {
      const newScopes = ['openid', 'profile', 'email', 'calendar'];
      
      oauthProviderService.updateProviderConfig('google', {
        scopes: newScopes,
      });

      const updatedConfig = oauthProviderService.getProviderConfig('google');
      expect(updatedConfig.scopes).toEqual(newScopes);
    });

    it('should throw error when updating non-existent provider', () => {
      expect(() => {
        oauthProviderService.updateProviderConfig('nonexistent' as any, {
          scopes: ['test'],
        });
      }).toThrow('Provider nonexistent not found');
    });
  });

  describe('error handling', () => {
    it('should create proper AuthError structure', async () => {
      mockCallbackServer.start.mockRejectedValue(new Error('Test error'));

      await expect(oauthProviderService.startCallbackServer()).rejects.toMatchObject({
        code: AuthErrorCode.CALLBACK_SERVER_ERROR,
        message: expect.stringContaining('Failed to start callback server'),
        recoverable: true,
        suggestions: expect.arrayContaining([
          'Check port availability',
          'Verify firewall settings',
          'Try a different port',
        ]),
        details: {
          provider: 'oauth',
          timestamp: expect.any(String),
        },
      });
    });

    it('should handle OAuth error responses correctly', async () => {
      const mockErrorData = {
        error: 'invalid_request',
        error_description: 'Invalid client ID',
      };

      mockCallbackServer.waitForCallback.mockResolvedValue(mockErrorData);

      await expect(
        oauthProviderService.handleOAuthCallback('http://localhost:54321/auth/callback')
      ).rejects.toMatchObject({
        code: AuthErrorCode.OAUTH_FLOW_FAILED,
        message: 'OAuth provider error: invalid_request - Invalid client ID',
        suggestions: expect.arrayContaining([
          'Check OAuth provider settings',
          'Verify application permissions',
          'Try authenticating again',
        ]),
      });
    });
  });

  describe('URL building', () => {
    it('should build correct authorization URL with all parameters', async () => {
      // Update provider config with custom parameters
      oauthProviderService.updateProviderConfig('google', {
        config: {
          custom_param: 'test_value',
          another_param: 'another_value',
        },
      });

      const callbackUrl = 'http://localhost:54321/auth/callback';
      mockCallbackServer.start.mockResolvedValue(callbackUrl);
      mockOpen.mockResolvedValue(undefined);

      await oauthProviderService.startOAuthFlow('google');

      const authUrl = mockOpen.mock.calls[0][0] as string;
      expect(authUrl).toContain('custom_param=test_value');
      expect(authUrl).toContain('another_param=another_value');
    });

    it('should handle URL encoding properly', async () => {
      const callbackUrl = 'http://localhost:54321/auth/callback?test=value&other=data';
      mockCallbackServer.start.mockResolvedValue(callbackUrl);
      mockOpen.mockResolvedValue(undefined);

      await oauthProviderService.startOAuthFlow('google');

      const authUrl = mockOpen.mock.calls[0][0] as string;
      // Check that the redirect_uri is properly encoded
      expect(authUrl).toContain(encodeURIComponent(callbackUrl));
    });
  });
});