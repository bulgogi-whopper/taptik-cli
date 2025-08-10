# Auth Module Refactoring Design Document

## Overview

Refactor the auth module to improve type safety, separation of concerns, maintainability, and ensure consistent code quality through proper testing and formatting. The current auth module handles OAuth authentication, session management, and user state, but lacks proper type definitions and has mixed responsibilities.

## Architecture

### Layered Architecture Strategy

- **Main Approach**: Implement a layered architecture with clear separation between presentation (commands), business logic (services), and infrastructure (storage, clients)
- **Key Components**: 
  - Type definitions layer for strong typing
  - Authentication service layer for core business logic
  - Session management layer for persistence
  - OAuth provider abstraction layer
  - Command layer for CLI interactions
- **Integration Points**: NestJS dependency injection, Supabase client, file system storage
- **Extensibility**: Pluggable OAuth providers, configurable session storage backends, modular command structure

### Authentication Flow
```
CLI Command → AuthService → OAuth Provider → Callback Server
    ↓              ↓              ↓              ↓
User Input → Business Logic → External Auth → Session Creation
    ↓              ↓              ↓              ↓
Validation → State Management → Token Exchange → Local Storage
```

### Refactoring Flow
```
Current Auth Module → Type Definitions → Service Separation
        ↓                    ↓                   ↓
    Analysis Phase → Interface Design → Implementation Split
        ↓                    ↓                   ↓
   Issue Identification → Strong Typing → Clean Architecture
```

## Components and Interfaces

### 1. Type Definitions (src/modules/auth/types/)

**Purpose**: Centralize all auth-related type definitions for strong typing and consistency
**Key Features**:
- OAuth provider types and configurations
- Authentication result and error types
- Session management types
- Command parameter and response types

### 2. Authentication Service (src/modules/auth/services/auth.service.ts)

**Purpose**: Core business logic for authentication operations
**Key Features**:
- OAuth provider management
- User authentication state
- Session lifecycle management
- Error handling and validation

### 3. Session Management Service (src/modules/auth/services/session.service.ts)

**Purpose**: Handle session persistence and retrieval operations
**Key Features**:
- Session storage abstraction
- Session validation and expiry
- Secure session management
- Storage backend flexibility

### 4. OAuth Provider Service (src/modules/auth/services/oauth-provider.service.ts)

**Purpose**: Abstract OAuth provider interactions and callback handling
**Key Features**:
- Provider-specific OAuth flows
- Callback server management
- Token exchange and validation
- Provider configuration management

### 5. Auth Commands (src/modules/auth/commands/)

**Purpose**: CLI command handlers with minimal business logic
**Key Features**:
- Input validation and parsing
- Service orchestration
- User feedback and error display
- Command-specific parameter handling

## Data Models

### AuthProvider
```typescript
interface AuthProvider {
  name: 'google' | 'github';
  clientId?: string;
  scopes: string[];
  authUrl: string;
  tokenUrl: string;
}
```

### AuthenticationResult
```typescript
interface AuthenticationResult {
  success: boolean;
  session?: UserSession;
  error?: AuthError;
  metadata?: AuthMetadata;
}
```

### AuthError
```typescript
interface AuthError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  recoverable: boolean;
}
```

### SessionStorageOptions
```typescript
interface SessionStorageOptions {
  directory: string;
  filename: string;
  encryption?: boolean;
  expirationCheck: boolean;
}
```

### OAuthCallbackData
```typescript
interface OAuthCallbackData {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  state?: string;
  error?: string;
}
```

## Error Handling

### Authentication Errors

1. **Provider Connection Errors**: Network issues, invalid provider configuration
2. **OAuth Flow Errors**: Invalid redirects, callback failures, token exchange errors
3. **Session Errors**: Storage failures, invalid sessions, expired tokens
4. **Validation Errors**: Invalid input parameters, malformed responses

### Error Recovery Strategy

- **Graceful Degradation**: Provide meaningful error messages and recovery suggestions
- **Retry Logic**: Automatic retry for transient network errors
- **State Cleanup**: Ensure clean state on error conditions
- **User Guidance**: Clear instructions for manual error resolution

## Testing Strategy

### Unit Testing

1. **Service Layer Tests**: Mock external dependencies, test business logic isolation
2. **Type Validation Tests**: Ensure type safety and proper interface compliance  
3. **Error Handling Tests**: Verify proper error propagation and handling
4. **Storage Layer Tests**: Mock file system operations, test data persistence

### Integration Testing

Test OAuth flow end-to-end with mock providers, verify session management across service boundaries, validate command-to-service interactions

### End-to-End Testing

Full authentication flow with real OAuth providers in test environment, session persistence across CLI sessions, error scenarios and recovery paths

## Implementation Approach

### Phase 1: Type System Foundation

- Create comprehensive type definitions in `types/` directory
- Define interfaces for all auth-related operations
- Add type annotations to existing code
- Ensure TypeScript strict mode compliance

### Phase 2: Service Layer Separation

- Extract session management into dedicated service
- Create OAuth provider abstraction service  
- Refactor AuthService to focus on business logic
- Implement proper dependency injection

### Phase 3: Command Layer Refactoring

- Simplify command handlers to focus on CLI concerns
- Remove business logic from commands
- Improve error handling and user feedback
- Add comprehensive input validation

### Phase 4: Testing and Quality Assurance

- Add comprehensive unit test coverage
- Implement integration tests for service boundaries
- Add end-to-end authentication flow tests
- Ensure linting and formatting compliance
- Validate TypeScript compilation and type checking

### Phase 5: Documentation and Polish

- Update inline documentation and comments
- Create usage examples and troubleshooting guides
- Finalize API documentation
- Performance optimization and code review