# Requirements Document

## Introduction

This feature involves implementing OAuth-based authentication for the Taptik CLI project using Supabase Auth with Google and GitHub providers. The goal is to replace email/password authentication with a modern OAuth flow that provides secure authentication, automatic browser integration, and persistent session management across CLI invocations.

## Requirements

### Requirement 1

**User Story:** As a developer, I want to authenticate with Google or GitHub OAuth providers, so that I can securely access Taptik CLI without managing passwords.

#### Acceptance Criteria

1. WHEN I run `taptik login` THEN I SHALL be able to choose between Google and GitHub OAuth providers
2. WHEN I specify `--provider google` or `--provider github` THEN the CLI SHALL use that provider directly without prompting
3. WHEN OAuth flow starts THEN my default browser SHALL open automatically to the provider's authentication page
4. WHEN I complete OAuth authentication THEN the CLI SHALL automatically receive the callback and create a session
5. IF I'm already logged in THEN the CLI SHALL detect existing session and offer to switch accounts

### Requirement 2

**User Story:** As a developer, I want my login session to persist across CLI invocations, so that I don't need to authenticate repeatedly.

#### Acceptance Criteria

1. WHEN I successfully authenticate THEN my session SHALL be stored locally in ~/.taptik/session.json
2. WHEN I run CLI commands after authentication THEN my session SHALL be automatically loaded and validated
3. WHEN my session expires THEN the CLI SHALL prompt me to re-authenticate
4. WHEN I run `taptik login` with an existing session THEN I SHALL be offered the option to keep or replace the current session
5. IF session storage fails THEN the CLI SHALL fall back to JWT token parsing for session reconstruction

### Requirement 3

**User Story:** As a developer, I want clear feedback and error handling during OAuth flow, so that I can troubleshoot authentication issues effectively.

#### Acceptance Criteria

1. WHEN OAuth flow starts THEN I SHALL see clear progress indicators and instructions
2. WHEN OAuth callback is received THEN I SHALL see confirmation with my user information and provider
3. WHEN OAuth flow times out (2 minutes) THEN I SHALL receive a clear timeout message with next steps
4. WHEN OAuth fails THEN I SHALL receive specific error messages with troubleshooting guidance
5. WHEN network issues occur THEN the CLI SHALL provide helpful error messages and retry suggestions

### Requirement 4

**User Story:** As a developer, I want the OAuth system to integrate seamlessly with the existing NestJS CLI architecture, so that authentication works reliably within the current project structure.

#### Acceptance Criteria

1. WHEN OAuth is implemented THEN it SHALL use NestJS dependency injection and module patterns
2. WHEN callback server starts THEN it SHALL use a temporary NestJS HTTP server on port 54321
3. WHEN OAuth flow completes THEN the callback server SHALL shut down automatically and cleanly
4. WHEN the system runs THEN it SHALL be compatible with existing TypeScript configuration and build processes
5. WHEN authentication completes THEN the CLI SHALL terminate properly with process.exit(0)

### Requirement 5

**User Story:** As a developer, I want comprehensive security measures in OAuth implementation, so that my authentication credentials are protected.

#### Acceptance Criteria

1. WHEN OAuth flow runs THEN it SHALL use PKCE (Proof Key for Code Exchange) automatically via Supabase
2. WHEN OAuth state parameters are used THEN they SHALL be validated to prevent CSRF attacks
3. WHEN tokens are processed THEN sensitive data SHALL NOT be logged or exposed
4. WHEN callback server runs THEN it SHALL bind to localhost only with no external access
5. WHEN session data is stored THEN it SHALL include proper expiration timestamps and validation
