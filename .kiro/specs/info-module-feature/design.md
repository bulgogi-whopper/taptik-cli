# Design Document

## Overview

The InfoModule feature provides a comprehensive information display system for the Taptik CLI application. It implements a modular architecture that separates concerns between command handling, business logic, and data retrieval. The design follows NestJS patterns with dependency injection, proper error handling, and extensive testing coverage.

## Architecture

### High-Level Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   InfoCommand   │───▶│   InfoService   │───▶│ External APIs   │
│   (CLI Layer)   │    │ (Business Logic)│    │ (Supabase, FS)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ User Interface  │    │ Data Processing │    │ Data Sources    │
│ - Formatting    │    │ - Aggregation   │    │ - Auth Status   │
│ - Error Display │    │ - Validation    │    │ - Tool Detection│
│ - Status Colors │    │ - Caching       │    │ - Sync History  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Module Integration

The InfoModule integrates with existing application modules:

- **AuthModule**: Retrieves authentication status and user information
- **ConfigModule**: Accesses configuration settings and environment variables
- **SharedModule**: Uses common utilities for file operations and logging

## Components and Interfaces

### InfoCommand

**Purpose**: CLI interface layer that handles user interaction and output formatting

**Key Responsibilities**:
- Parse command-line arguments and options
- Coordinate information retrieval through InfoService
- Format and display information with appropriate styling
- Handle command-level errors and provide user feedback

**Interface**:
```typescript
@Command({
  name: 'info',
  description: 'Display current authentication status and configuration information'
})
export class InfoCommand extends CommandRunner {
  constructor(private readonly infoService: InfoService) {}
  
  async run(passedParams: string[], options?: InfoCommandOptions): Promise<void>
}

interface InfoCommandOptions {
  verbose?: boolean;
  json?: boolean;
  offline?: boolean;
}
```

### InfoService

**Purpose**: Business logic layer that aggregates information from various sources

**Key Responsibilities**:
- Retrieve authentication status from Supabase Auth
- Detect current development tools and environments
- Gather synchronization history and status
- Provide system diagnostic information
- Handle caching and offline scenarios

**Interface**:
```typescript
@Injectable()
export class InfoService {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly supabaseClient: SupabaseClient
  ) {}

  async getAuthenticationInfo(): Promise<AuthInfo>
  async getToolInfo(): Promise<ToolInfo>
  async getSyncInfo(): Promise<SyncInfo>
  async getSystemInfo(): Promise<SystemInfo>
  async getComprehensiveInfo(): Promise<ComprehensiveInfo>
}
```

### Data Transfer Objects

**AuthInfo**:
```typescript
interface AuthInfo {
  isAuthenticated: boolean;
  user?: {
    email: string;
    provider: 'google' | 'github';
    lastLogin: Date;
  };
  session?: {
    expiresAt: Date;
    isExpired: boolean;
  };
  error?: string;
}
```

**ToolInfo**:
```typescript
interface ToolInfo {
  currentTool?: {
    name: string;
    version: string;
    path: string;
  };
  detectedTools: DetectedTool[];
  lastConfigUpdate?: Date;
  supportedTools: string[];
}

interface DetectedTool {
  name: string;
  version?: string;
  path: string;
  isActive: boolean;
}
```

**SyncInfo**:
```typescript
interface SyncInfo {
  lastSync?: {
    timestamp: Date;
    operation: 'push' | 'pull';
    status: 'success' | 'error';
  };
  configCount: number;
  recentOperations: SyncOperation[];
  errors?: SyncError[];
}

interface SyncOperation {
  id: string;
  timestamp: Date;
  operation: 'push' | 'pull';
  configName: string;
  status: 'success' | 'error';
  error?: string;
}
```

**SystemInfo**:
```typescript
interface SystemInfo {
  cli: {
    version: string;
    buildDate: string;
    installPath: string;
  };
  runtime: {
    nodeVersion: string;
    platform: string;
    architecture: string;
  };
  connectivity: {
    supabaseStatus: 'connected' | 'disconnected' | 'error';
    lastCheck: Date;
  };
  dependencies: DependencyStatus[];
}

interface DependencyStatus {
  name: string;
  required: string;
  installed?: string;
  status: 'ok' | 'missing' | 'outdated';
}
```

## Data Models

### Information Aggregation Model

The InfoService uses an aggregation pattern to collect information from multiple sources:

```typescript
class InfoAggregator {
  private cache: Map<string, CachedInfo> = new Map();
  private readonly CACHE_TTL = 30000; // 30 seconds

  async aggregate(): Promise<ComprehensiveInfo> {
    const [authInfo, toolInfo, syncInfo, systemInfo] = await Promise.allSettled([
      this.getAuthInfo(),
      this.getToolInfo(),
      this.getSyncInfo(),
      this.getSystemInfo()
    ]);

    return {
      auth: this.handleResult(authInfo),
      tool: this.handleResult(toolInfo),
      sync: this.handleResult(syncInfo),
      system: this.handleResult(systemInfo),
      timestamp: new Date()
    };
  }

  private handleResult<T>(result: PromiseSettledResult<T>): T | ErrorInfo {
    if (result.status === 'fulfilled') {
      return result.value;
    }
    return {
      error: result.reason.message,
      timestamp: new Date()
    };
  }
}
```

### Caching Strategy

Implement intelligent caching to improve performance and handle offline scenarios:

```typescript
interface CachedInfo {
  data: any;
  timestamp: Date;
  ttl: number;
}

class InfoCache {
  private cache = new Map<string, CachedInfo>();

  set(key: string, data: any, ttl: number = 30000): void {
    this.cache.set(key, {
      data,
      timestamp: new Date(),
      ttl
    });
  }

  get(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const isExpired = Date.now() - cached.timestamp.getTime() > cached.ttl;
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }
}
```

## Error Handling

### Error Classification

**Network Errors**:
- Supabase connection failures
- API timeout errors
- DNS resolution issues

**Authentication Errors**:
- Expired sessions
- Invalid tokens
- Permission denied

**System Errors**:
- File system access issues
- Missing dependencies
- Configuration corruption

### Error Handling Strategy

```typescript
class InfoErrorHandler {
  handleError(error: Error, context: string): ErrorInfo {
    if (error instanceof SupabaseError) {
      return this.handleSupabaseError(error, context);
    }
    
    if (error instanceof FileSystemError) {
      return this.handleFileSystemError(error, context);
    }
    
    return {
      type: 'unknown',
      message: error.message,
      context,
      timestamp: new Date(),
      suggestions: ['Check logs for more details', 'Try running the command again']
    };
  }

  private handleSupabaseError(error: SupabaseError, context: string): ErrorInfo {
    return {
      type: 'network',
      message: 'Unable to connect to Supabase',
      context,
      timestamp: new Date(),
      suggestions: [
        'Check your internet connection',
        'Verify Supabase configuration',
        'Try again in a few moments'
      ]
    };
  }
}
```

### Graceful Degradation

When external services are unavailable, the system should:

1. **Show cached information** with timestamps indicating staleness
2. **Display partial information** from available sources
3. **Provide clear indicators** of what information is missing
4. **Suggest recovery actions** for users

## Testing Strategy

### Unit Testing Approach

**InfoService Testing**:
- Mock all external dependencies (AuthService, ConfigService, SupabaseClient)
- Test each information retrieval method independently
- Verify error handling for various failure scenarios
- Test caching behavior and TTL expiration

**InfoCommand Testing**:
- Mock InfoService to control data flow
- Test output formatting for different information states
- Verify command option parsing and validation
- Test error display and user messaging

### Test Structure

```typescript
describe('InfoService', () => {
  let service: InfoService;
  let mockAuthService: jest.Mocked<AuthService>;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockSupabaseClient: jest.Mocked<SupabaseClient>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        InfoService,
        { provide: AuthService, useValue: mockAuthService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: SupabaseClient, useValue: mockSupabaseClient }
      ]
    }).compile();

    service = module.get<InfoService>(InfoService);
  });

  describe('getAuthenticationInfo', () => {
    it('should return authenticated user info when logged in', async () => {
      // Test implementation
    });

    it('should return unauthenticated status when not logged in', async () => {
      // Test implementation
    });

    it('should handle expired sessions gracefully', async () => {
      // Test implementation
    });
  });
});
```

### Integration Testing

**End-to-End Command Testing**:
- Test complete command execution flow
- Verify output formatting and colors
- Test with various system states (online/offline, authenticated/unauthenticated)
- Validate performance requirements (2-second response time)

### Test Fixtures

Create comprehensive test fixtures for different scenarios:

```typescript
export const mockAuthInfo = {
  authenticated: {
    isAuthenticated: true,
    user: {
      email: 'test@example.com',
      provider: 'google' as const,
      lastLogin: new Date('2025-08-11T10:00:00Z')
    },
    session: {
      expiresAt: new Date('2025-08-12T10:00:00Z'),
      isExpired: false
    }
  },
  unauthenticated: {
    isAuthenticated: false
  },
  expired: {
    isAuthenticated: true,
    user: {
      email: 'test@example.com',
      provider: 'google' as const,
      lastLogin: new Date('2025-08-10T10:00:00Z')
    },
    session: {
      expiresAt: new Date('2025-08-11T10:00:00Z'),
      isExpired: true
    }
  }
};
```

## Performance Considerations

### Response Time Optimization

- **Parallel Information Retrieval**: Use `Promise.allSettled()` to fetch information concurrently
- **Intelligent Caching**: Cache frequently accessed information with appropriate TTL
- **Lazy Loading**: Only fetch detailed information when requested with verbose flag
- **Connection Pooling**: Reuse Supabase connections where possible

### Memory Management

- **Cache Size Limits**: Implement LRU cache with maximum size limits
- **Resource Cleanup**: Properly dispose of resources and clear timers
- **Streaming for Large Data**: Use streaming for large sync history data

### Network Resilience

- **Timeout Configuration**: Set appropriate timeouts for external API calls
- **Retry Logic**: Implement exponential backoff for transient failures
- **Circuit Breaker**: Prevent cascading failures with circuit breaker pattern

## Security Considerations

### Data Privacy

- **Sensitive Information Filtering**: Never display full tokens or sensitive configuration
- **User Consent**: Only show information the user has explicitly requested
- **Audit Logging**: Log information access for security monitoring

### Authentication Security

- **Session Validation**: Always validate session tokens before displaying auth info
- **Secure Storage**: Use secure storage mechanisms for cached authentication data
- **Token Refresh**: Handle token refresh transparently when needed

This design provides a robust, testable, and maintainable foundation for the InfoModule feature while adhering to NestJS best practices and the existing application architecture.