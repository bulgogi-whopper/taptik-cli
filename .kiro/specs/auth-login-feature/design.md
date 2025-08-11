# Design Document

## Overview

This design outlines the implementation of OAuth-based authentication for Taptik CLI using Supabase Auth with Google and GitHub as identity providers. The system replaces email/password authentication with a modern OAuth flow that includes automatic browser launching, local callback handling, and persistent session management across CLI invocations.

## Architecture

### Authentication Strategy

- **OAuth-Only Flow**: Complete removal of email/password authentication in favor of OAuth providers
- **Provider Support**: Google and GitHub OAuth 2.0 with extensible architecture for additional providers
- **Local Callback Server**: Temporary NestJS HTTP server for OAuth callback handling
- **Session Persistence**: Local file-based storage for maintaining login state across CLI sessions

### OAuth Integration Flow

```
CLI Command → Provider Selection → Browser Launch → OAuth Flow → Callback Server → Session Storage
     ↓
Provider Selection (Interactive/Flag) → Supabase OAuth → User Authentication → Token Processing
```

## Components and Interfaces

### 1. AuthService (src/modules/auth/auth.service.ts)

**Purpose**: Core OAuth authentication business logic **Key Features**:

- OAuth provider login with automatic browser launching
- Session creation and management via Supabase Auth
- JWT token parsing and validation
- User session persistence and loading

### 2. OAuthCallbackServer (src/modules/auth/oauth-callback-server.ts)

**Purpose**: Temporary HTTP server for OAuth callback handling **Key Features**:

- NestJS-based HTTP server on port 54321
- JavaScript-based URL fragment to query parameter conversion
- Automatic timeout handling (2 minutes)
- Clean server shutdown after callback processing

### 3. SessionStorage (src/modules/auth/session-storage.ts)

**Purpose**: Local session persistence across CLI invocations **Key Features**:

- File-based storage in ~/.taptik/session.json
- JWT token parsing for session reconstruction
- Session validation and expiration handling

### 4. LoginCommand (src/modules/auth/commands/login.command.ts)

**Purpose**: CLI command interface for OAuth authentication **Key Features**:

- Interactive provider selection (Google/GitHub)
- --provider/-p flag for direct provider specification
- Duplicate login detection and handling
- Comprehensive error messaging and user feedback

## Data Models

### UserSession Interface

```typescript
interface UserSession {
  user: {
    id: string;
    email: string;
    fullName?: string;
  };
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  provider: 'google' | 'github';
}
```

### OAuth Flow Data Structure

```typescript
interface OAuthCallbackData {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  user: {
    id: string;
    email: string;
    [key: string]: any;
  };
}
```

## Error Handling

### OAuth Error Categories

1. **Provider Errors**: OAuth provider unavailable, invalid credentials
2. **Network Errors**: Connection failures, timeout issues
3. **Configuration Errors**: Missing OAuth setup, invalid redirect URIs
4. **Session Errors**: Token parsing failures, session corruption

### Error Resolution Strategy

- Clear error messages with provider context and troubleshooting guidance
- Automatic fallback for Supabase setSession failures using JWT parsing
- Timeout handling for OAuth callback waiting (2 minutes)
- Graceful cleanup of callback server on errors

## Testing Strategy

### OAuth Flow Validation

1. **Provider Integration**: Test Google and GitHub OAuth flows end-to-end
2. **Session Persistence**: Verify session storage survives CLI restarts
3. **Error Scenarios**: Test timeout, network failures, and invalid responses
4. **Browser Integration**: Validate automatic browser launching and callback handling

### Integration Testing

1. **CLI Commands**: Test interactive and flag-based provider selection
2. **Session Management**: Verify duplicate login detection and session clearing
3. **Callback Server**: Test server startup, shutdown, and timeout scenarios

### Unit Testing

1. **AuthService Methods**: Mock OAuth providers and test authentication logic
2. **Session Storage**: Test file operations and JWT parsing
3. **Callback Server**: Mock HTTP requests and test callback processing

## Implementation Approach

### Phase 1: Core OAuth Infrastructure

- Remove existing email/password authentication code
- Install required dependencies (@inquirer/prompts, open)
- Implement AuthService OAuth methods with Supabase integration

### Phase 2: Callback Handling System

- Create OAuthCallbackServer with NestJS framework
- Implement JavaScript-based fragment-to-query conversion
- Add timeout handling and error recovery

### Phase 3: Session Management

- Implement SessionStorage for local file persistence
- Add JWT token parsing for session reconstruction
- Create session validation and loading mechanisms

### Phase 4: CLI Integration

- Update LoginCommand for OAuth-only flow
- Add provider selection with interactive prompts and flags
- Implement comprehensive error handling and user feedback

### Phase 5: Testing and Documentation

- Create comprehensive unit and integration tests
- Add OAuth setup documentation and troubleshooting guides
- Validate system with real OAuth providers
