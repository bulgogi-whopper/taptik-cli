/**
 * @fileoverview Comprehensive type definitions for the authentication module
 *
 * This file contains all type definitions, interfaces, and enums used throughout
 * the auth module to ensure type safety and consistency across the codebase.
 *
 * @author Kiro Agent
 * @version 1.0.0
 */

import { User, UserSession } from '../../../models/user.model';

/**
 * Supported OAuth provider types
 * Currently supports Google and GitHub OAuth providers
 */
export type AuthProviderType = 'google' | 'github';

/**
 * OAuth provider configuration interface
 */
export interface AuthProvider {
  /** Provider name */
  name: AuthProviderType;
  /** OAuth client ID (optional, can be from env) */
  clientId?: string;
  /** Required OAuth scopes */
  scopes: string[];
  /** Authorization URL endpoint */
  authUrl: string;
  /** Token exchange URL endpoint */
  tokenUrl: string;
  /** Additional provider-specific configuration */
  config?: Record<string, unknown>;
}

/**
 * Authentication operation result
 */
export interface AuthenticationResult {
  /** Whether authentication was successful */
  success: boolean;
  /** User session if authentication succeeded */
  session?: UserSession;
  /** Error information if authentication failed */
  error?: AuthError;
  /** Additional metadata about the authentication */
  metadata?: AuthMetadata;
}

/**
 * Authentication error details
 */
export interface AuthError {
  /** Error code for programmatic handling */
  code: AuthErrorCode;
  /** Human-readable error message */
  message: string;
  /** Additional error details */
  details?: Record<string, unknown>;
  /** Whether this error is recoverable */
  recoverable: boolean;
  /** Suggested recovery actions */
  suggestions?: string[];
}

/**
 * Authentication error codes
 */
export enum AuthErrorCode {
  // Network and connectivity errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  PROVIDER_UNAVAILABLE = 'PROVIDER_UNAVAILABLE',
  CALLBACK_SERVER_ERROR = 'CALLBACK_SERVER_ERROR',

  // OAuth flow errors
  OAUTH_FLOW_FAILED = 'OAUTH_FLOW_FAILED',
  INVALID_OAUTH_RESPONSE = 'INVALID_OAUTH_RESPONSE',
  TOKEN_EXCHANGE_FAILED = 'TOKEN_EXCHANGE_FAILED',
  CALLBACK_TIMEOUT = 'CALLBACK_TIMEOUT',

  // Session management errors
  SESSION_STORAGE_ERROR = 'SESSION_STORAGE_ERROR',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  SESSION_INVALID = 'SESSION_INVALID',
  SESSION_CLEANUP_FAILED = 'SESSION_CLEANUP_FAILED',

  // Configuration errors
  PROVIDER_CONFIG_INVALID = 'PROVIDER_CONFIG_INVALID',
  MISSING_ENVIRONMENT_VARIABLES = 'MISSING_ENVIRONMENT_VARIABLES',

  // User interaction errors
  USER_CANCELLED = 'USER_CANCELLED',
  BROWSER_NOT_AVAILABLE = 'BROWSER_NOT_AVAILABLE',

  // Unknown errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Authentication metadata for additional context
 */
export interface AuthMetadata {
  /** Authentication method used */
  method: 'oauth';
  /** Provider used for authentication */
  provider: AuthProviderType;
  /** Timestamp when authentication started */
  startedAt: Date;
  /** Timestamp when authentication completed */
  completedAt?: Date;
  /** Duration of authentication process in milliseconds */
  duration?: number;
  /** Additional provider-specific metadata */
  providerMetadata?: Record<string, unknown>;
}

/**
 * OAuth callback data received from provider
 */
export interface OAuthCallbackData {
  /** OAuth access token */
  accessToken: string;
  /** OAuth refresh token (optional) */
  refreshToken?: string;
  /** Token expiration timestamp */
  expiresAt?: number;
  /** OAuth state parameter for CSRF protection */
  state?: string;
  /** Error code if OAuth failed */
  error?: string;
  /** Error description if OAuth failed */
  errorDescription?: string;
  /** Additional query parameters */
  additionalParams?: Record<string, string>;
}

/**
 * Session storage configuration options
 */
export interface SessionStorageOptions {
  /** Directory to store session files */
  directory: string;
  /** Session file name */
  filename: string;
  /** Whether to encrypt session data */
  encryption?: boolean;
  /** Encryption key (required if encryption is true) */
  encryptionKey?: string;
  /** Whether to check session expiration on load */
  expirationCheck: boolean;
  /** Session TTL in milliseconds */
  ttl?: number;
  /** File permissions for session file */
  fileMode?: number;
}

/**
 * Stored session data structure
 */
export interface StoredSession {
  /** The user session data */
  userSession: UserSession;
  /** When the session was stored */
  storedAt: string;
  /** Session expiration timestamp */
  expiresAt?: string;
  /** Session metadata */
  metadata?: SessionMetadata;
}

/**
 * Session metadata for tracking and analytics
 */
export interface SessionMetadata {
  /** Authentication provider used */
  provider: AuthProviderType;
  /** Session creation method */
  creationMethod: 'oauth' | 'refresh';
  /** Client information */
  client?: {
    version: string;
    platform: string;
  };
  /** Last access timestamp */
  lastAccessedAt?: Date;
  /** Access count */
  accessCount?: number;
}

/**
 * OAuth callback server configuration
 */
export interface CallbackServerConfig {
  /** Port for callback server */
  port: number;
  /** Host for callback server */
  host?: string;
  /** Callback path */
  path: string;
  /** Server timeout in milliseconds */
  timeout?: number;
  /** Whether to use HTTPS */
  secure?: boolean;
  /** SSL options if secure is true */
  ssl?: {
    key: string;
    cert: string;
  };
}

/**
 * Provider-specific OAuth configuration
 */
export interface ProviderOAuthConfig {
  /** Google OAuth configuration */
  google: {
    scopes: string[];
    accessType: 'offline' | 'online';
    prompt: 'none' | 'consent' | 'select_account';
    includeGrantedScopes?: boolean;
  };
  /** GitHub OAuth configuration */
  github: {
    scopes: string[];
    allowSignup?: boolean;
  };
}

/**
 * Authentication service interface
 */
export interface IAuthService {
  /** Login with OAuth provider */
  loginWithProvider(provider: AuthProviderType): Promise<AuthenticationResult>;
  /** Logout current user */
  logout(): Promise<void>;
  /** Get current authenticated user */
  getCurrentUser(): Promise<User | null>;
  /** Get current session */
  getSession(): Promise<UserSession | null>;
  /** Refresh current session */
  refreshSession(): Promise<UserSession | null>;
  /** Process OAuth callback URL */
  processOAuthCallbackUrl(callbackUrl: string): Promise<AuthenticationResult>;
}

/**
 * Session storage service interface
 */
export interface ISessionStorage {
  /** Save user session */
  saveSession(session: UserSession, metadata?: SessionMetadata): Promise<void>;
  /** Load stored session */
  loadSession(): Promise<StoredSession | null>;
  /** Clear stored session */
  clearSession(): Promise<void>;
  /** Check if session exists */
  hasSession(): Promise<boolean>;
  /** Validate session expiration */
  isSessionValid(session: StoredSession): Promise<boolean>;
}

/**
 * OAuth provider service interface
 */
export interface IOAuthProviderService {
  /** Start OAuth flow for provider */
  startOAuthFlow(provider: AuthProviderType): Promise<string>;
  /** Handle OAuth callback */
  handleOAuthCallback(callbackUrl: string): Promise<OAuthCallbackData>;
  /** Get provider configuration */
  getProviderConfig(provider: AuthProviderType): AuthProvider;
  /** Validate provider configuration */
  validateProviderConfig(provider: AuthProviderType): boolean;
  /** Start callback server */
  startCallbackServer(config?: Partial<CallbackServerConfig>): Promise<string>;
  /** Stop callback server */
  stopCallbackServer(): Promise<void>;
}

/**
 * Command parameter types
 */
export interface LoginCommandOptions {
  /** OAuth provider to use */
  provider?: AuthProviderType;
  /** Custom callback URL */
  callbackUrl?: string;
  /** Skip browser opening */
  skipBrowser?: boolean;
}

export interface LogoutCommandOptions {
  /** Force logout even if session is invalid */
  force?: boolean;
  /** Clear all stored data */
  clearAll?: boolean;
}

export interface OAuthCallbackCommandOptions {
  /** Callback URL from OAuth provider */
  url: string;
  /** Provider that initiated the callback */
  provider?: AuthProviderType;
}

/**
 * Type guards for runtime type checking
 */
export const isAuthProvider = (value: unknown): value is AuthProviderType =>
  typeof value === 'string' && ['google', 'github'].includes(value);

export const isAuthError = (value: unknown): value is AuthError =>
  typeof value === 'object' &&
  value !== null &&
  'code' in value &&
  'message' in value &&
  'recoverable' in value;

export const isOAuthCallbackData = (
  value: unknown,
): value is OAuthCallbackData =>
  typeof value === 'object' &&
  value !== null &&
  'accessToken' in value &&
  typeof (value as Record<string, unknown>).accessToken === 'string';

export const isStoredSession = (value: unknown): value is StoredSession =>
  typeof value === 'object' &&
  value !== null &&
  'userSession' in value &&
  'storedAt' in value;

/**
 * Utility types for auth operations
 */
export type AuthOperationResult<T = void> = Promise<
  { success: true; data: T } | { success: false; error: AuthError }
>;

export type PartialAuthProvider = Partial<AuthProvider> &
  Pick<AuthProvider, 'name'>;

export type RequiredSessionStorageOptions = Required<
  Pick<SessionStorageOptions, 'directory' | 'filename' | 'expirationCheck'>
> &
  Partial<SessionStorageOptions>;

/**
 * Re-export commonly used types from user model
 */
export type { User, UserSession } from '../../../models/user.model';
