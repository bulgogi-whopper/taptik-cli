# Design Document - Taptik List Command

## Overview

The List Command feature provides a comprehensive CLI interface for discovering and exploring configuration packages stored in the Taptik cloud. This module implements a robust querying system that allows users to browse, filter, and sort available configurations through an intuitive command-line interface. The design emphasizes user experience, performance, and extensibility while maintaining consistency with the existing Taptik CLI architecture.

## Architecture

### High-Level Architecture

```
CLI Layer (Commands)
    ↓
Service Layer (Business Logic)
    ↓
Data Access Layer (Supabase Client)
    ↓
External Services (Supabase Cloud)
```

### Component Interaction Flow

```
User Input → ListCommand → ListService → SupabaseService → Supabase API
                ↓              ↓             ↓
            Validation → Filtering → Data Transform → Response Formatting
```

## Components and Interfaces

### 1. Command Layer

#### ListCommand (`src/modules/list/commands/list.command.ts`)

**Purpose**: Handle CLI interface for listing configurations

**Responsibilities**:

- Parse and validate CLI arguments and options
- Coordinate with ListService for data retrieval
- Format and display results to user
- Handle command-specific error scenarios

**Interface**:

```typescript
@Command({
  name: 'list',
  description: 'List available configuration packages',
  arguments: '[subcommand]',
  options: [
    { flags: '--filter <query>', description: 'Filter by title' },
    { flags: '--sort <field>', description: 'Sort by date|name (default: date)' },
    { flags: '--limit <n>', description: 'Limit results (default: 20, max: 100)' },
  ],
})
export class ListCommand extends CommandRunner {
  async run(passedParams: string[], options: ListOptions): Promise<void>;
}

interface ListOptions {
  filter?: string;
  sort?: 'date' | 'name';
  limit?: number;
}
```

**Subcommands**:

- `taptik list` - List public configurations
- `taptik list liked` - List user's liked configurations

### 2. Service Layer

#### ListService (`src/modules/info/services/list.service.ts`)

**Purpose**: Business logic for configuration listing and discovery

**Responsibilities**:

- Implement filtering and sorting logic for configuration lists
- Coordinate with authentication service for liked configurations
- Transform data for presentation
- Handle business-level error scenarios specific to listing

**Key Methods**:

```typescript
export class ListService {
  async listConfigurations(options: ListConfigurationsOptions): Promise<ConfigurationListResult>;
  async listLikedConfigurations(userId: string, options: ListOptions): Promise<ConfigurationListResult>;
  private validateListOptions(options: ListOptions): ValidationResult;
  private applyFilters(configs: ConfigBundle[], filter: string): ConfigBundle[]; // Filter by title only
  private applySorting(configs: ConfigBundle[], sort: SortField): ConfigBundle[];
  private formatForDisplay(configs: ConfigBundle[]): DisplayConfiguration[];
}

interface ListConfigurationsOptions {
  filter?: string;
  sort?: SortField;
  limit?: number;
  includePrivate?: boolean;
  userId?: string;
}

interface ConfigurationListResult {
  configurations: DisplayConfiguration[];
  totalCount: number;
  hasMore: boolean;
}
```

#### SupabaseService Integration

**Purpose**: Data access layer for Supabase operations

**Key Operations**:

- Query public configurations with filtering
- Query user's liked configurations
- Handle pagination and sorting at database level
- Manage authentication state

### 3. Data Models

#### DisplayConfiguration

**Purpose**: Formatted configuration data for CLI display

```typescript
interface DisplayConfiguration {
  id: string;
  title: string; // Changed from 'name' to 'title' to match requirements
  description?: string;
  createdAt: Date;
  size: string; // Human-readable format (e.g., "2.3MB")
  accessLevel: 'Public' | 'Private';
  author?: string;
  isLiked?: boolean;
}
```

#### Database Query Models

```typescript
interface ConfigurationQuery {
  select: string;
  filters: QueryFilter[];
  orderBy: OrderByClause[];
  limit: number;
  offset?: number;
}

interface QueryFilter {
  field: string;
  operator: 'eq' | 'ilike' | 'in' | 'gte' | 'lte';
  value: any;
}
```

## Data Models

### Configuration Listing Schema

The list command interacts with the existing `config_bundles` table in Supabase:

```sql
-- Query for public configurations
SELECT
  id,
  name,
  description,
  created_at,
  storage_path,
  metadata->>'is_private' as access_level,
  metadata->>'user_id' as author_id
FROM config_bundles
WHERE metadata->>'is_private' = 'false'
ORDER BY created_at DESC
LIMIT 20;

-- Query for liked configurations (requires likes table)
SELECT cb.*, ul.created_at as liked_at
FROM config_bundles cb
JOIN user_likes ul ON cb.id = ul.config_id
WHERE ul.user_id = $1
ORDER BY ul.created_at DESC;
```

### Filtering and Sorting Logic

#### Text Search Implementation

```typescript
// Filter by title only as specified in requirements
const searchQuery = `
  SELECT * FROM config_bundles 
  WHERE name ILIKE '%${filter}%'
  AND metadata->>'is_private' = 'false'
`;
```

#### Sorting Implementation

```typescript
const sortMappings = {
  date: 'created_at DESC',
  name: 'name ASC', // Sort by title alphabetically
};
```

## Error Handling

### Error Classification and Responses

#### Network and Connectivity Errors

```typescript
class NetworkErrorHandler {
  handle(error: SupabaseError): never {
    if (error.code === 'NETWORK_ERROR') {
      throw new CLIError('Unable to connect to Taptik cloud. Please check your internet connection.', ExitCode.NETWORK_ERROR);
    }
  }
}
```

#### Authentication Errors

```typescript
class AuthErrorHandler {
  handle(error: AuthError): never {
    if (error.code === 'UNAUTHORIZED') {
      throw new CLIError("Authentication failed. Please run 'taptik login' first.", ExitCode.AUTH_ERROR);
    }
  }
}
```

#### Server Errors

```typescript
class ServerErrorHandler {
  handle(error: SupabaseError): never {
    if (error.code >= 500) {
      throw new CLIError('Taptik cloud is temporarily unavailable. Please try again later.', ExitCode.SERVER_ERROR);
    }
  }
}
```

#### Validation Errors

```typescript
class ValidationErrorHandler {
  validateSortOption(sort: string): void {
    const validSorts = ['date', 'name'];
    if (sort && !validSorts.includes(sort)) {
      throw new CLIError(`Invalid sort option '${sort}'. Valid options: ${validSorts.join(', ')}`, ExitCode.INVALID_ARGUMENT);
    }
  }

  validateLimitOption(limit: number): void {
    if (limit <= 0) {
      throw new CLIError('Limit must be greater than 0', ExitCode.INVALID_ARGUMENT);
    }
    if (limit > 100) {
      throw new CLIError('Limit cannot exceed 100', ExitCode.INVALID_ARGUMENT);
    }
  }
}
```

### Error Recovery Strategies

#### Graceful Degradation

- If size information unavailable, display "Unknown"
- If description missing, show truncated name
- If author information unavailable, show "Anonymous"

#### Retry Logic

```typescript
class RetryHandler {
  async executeWithRetry<T>(operation: () => Promise<T>, maxRetries: number = 3): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === maxRetries || !this.isRetryableError(error)) {
          throw error;
        }
        await this.delay(attempt * 1000);
      }
    }
  }
}
```

## Testing Strategy

### Unit Testing Approach

#### Command Testing

```typescript
describe('ListCommand', () => {
  describe('argument parsing', () => {
    it('should parse filter option correctly');
    it('should validate sort options');
    it('should apply default limit');
    it('should handle invalid arguments gracefully');
  });

  describe('subcommand handling', () => {
    it('should route to liked configurations for "liked" subcommand');
    it('should route to public configurations by default');
  });
});
```

#### Service Testing

```typescript
describe('ListService', () => {
  describe('listConfigurations', () => {
    it('should apply text filters correctly');
    it('should sort by different criteria');
    it('should respect limit constraints');
    it('should handle empty results');
  });

  describe('error handling', () => {
    it('should handle network errors gracefully');
    it('should handle authentication errors');
    it('should validate input parameters');
  });
});
```

### Integration Testing

#### End-to-End Command Testing

```typescript
describe('List Command E2E', () => {
  it('should list public configurations successfully');
  it('should filter configurations by search term');
  it('should sort configurations by different fields');
  it('should handle authentication for liked configurations');
  it('should display appropriate error messages');
});
```

### Test Data Strategy

#### Mock Data Generation

```typescript
const mockConfigurations = [
  {
    id: 'config-1',
    name: 'VSCode Dark Theme Setup',
    description: 'Complete dark theme configuration for VSCode',
    created_at: '2025-08-20T10:00:00Z',
    size: '2.3MB',
    access_level: 'Public',
  },
  // Additional test configurations...
];
```

## Performance Considerations

### Database Query Optimization

#### Indexing Strategy

```sql
-- Indexes for efficient querying
CREATE INDEX idx_config_bundles_public ON config_bundles
  USING btree (created_at DESC)
  WHERE metadata->>'is_private' = 'false';

CREATE INDEX idx_config_bundles_search ON config_bundles
  USING gin (to_tsvector('english', name || ' ' || description));
```

#### Pagination Implementation

```typescript
class PaginationHandler {
  async getConfigurationsPage(offset: number, limit: number, filters: QueryFilter[]): Promise<PaginatedResult> {
    const query = this.supabase
      .from('config_bundles')
      .select('*', { count: 'exact' })
      .range(offset, offset + limit - 1);

    return this.applyFilters(query, filters);
  }
}
```

### Caching Strategy

#### Response Caching

```typescript
class CacheManager {
  private cache = new Map<string, CachedResult>();
  private readonly TTL = 5 * 60 * 1000; // 5 minutes

  async getCachedOrFetch<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.TTL) {
      return cached.data;
    }

    const data = await fetcher();
    this.cache.set(key, { data, timestamp: Date.now() });
    return data;
  }
}
```

### Output Formatting Performance

#### Table Output Format

**Decision**: Display configurations in a structured table format with specific columns as defined in requirements

**Table Columns** (as specified in Requirement 1.2):
- ID
- Title (not "name")
- Created date
- Size
- Access level

```typescript
class TableFormatter {
  formatConfigurationTable(configurations: DisplayConfiguration[]): string {
    if (configurations.length === 0) {
      return this.getEmptyStateMessage();
    }

    const header = this.getTableHeader();
    const rows = configurations.map(config => this.formatTableRow(config));
    
    return [header, ...rows].join('\n');
  }

  private getTableHeader(): string {
    return 'ID       Title                    Created      Size     Access';
  }

  private formatTableRow(config: DisplayConfiguration): string {
    return `${config.id.substring(0, 8)} ${config.title.padEnd(24)} ${this.formatDate(config.createdAt)} ${config.size.padEnd(8)} ${config.accessLevel}`;
  }

  private getEmptyStateMessage(): string {
    return 'No configurations are available'; // As specified in Requirement 1.3
  }
}
```

#### Empty State and Error Messages

**Purpose**: Provide specific user-friendly messages for different scenarios as defined in requirements

```typescript
class MessageFormatter {
  getEmptyStateMessage(): string {
    return 'No configurations are available'; // Requirement 1.3
  }

  getNoFilterResultsMessage(): string {
    return 'No configurations found matching your filter'; // Requirement 2.3
  }

  getNoLikedConfigurationsMessage(): string {
    return "You haven't liked any configurations yet"; // Requirement 5.3
  }

  getAuthenticationRequiredMessage(): string {
    return "Authentication failed. Please run 'taptik login' first."; // Requirement 6.2
  }

  getNetworkErrorMessage(): string {
    return 'Unable to connect to Taptik cloud. Please check your internet connection.'; // Requirement 6.1
  }

  getServerErrorMessage(): string {
    return 'Taptik cloud is temporarily unavailable. Please try again later.'; // Requirement 6.3
  }
}
```

#### Streaming Output for Large Results

```typescript
class StreamingFormatter {
  async formatAndStream(configurations: AsyncIterable<DisplayConfiguration>): Promise<void> {
    console.log(this.getTableHeader());

    for await (const config of configurations) {
      console.log(this.formatTableRow(config));
    }
  }
}
```

## Security Considerations

### Input Validation and Sanitization

#### SQL Injection Prevention

```typescript
class QuerySanitizer {
  sanitizeFilter(filter: string): string {
    // Remove potentially dangerous characters and handle special characters safely
    return filter.replace(/[;'"\\]/g, '').trim();
  }

  validateSortField(field: string): boolean {
    const allowedFields = ['date', 'name'];
    return allowedFields.includes(field);
  }
}
```

### Authentication and Authorization

#### Session Validation

```typescript
class AuthValidator {
  async validateSession(): Promise<User | null> {
    const session = await this.supabase.auth.getSession();
    if (!session?.data?.session) {
      return null;
    }
    return session.data.session.user;
  }

  async requireAuthentication(): Promise<User> {
    const user = await this.validateSession();
    if (!user) {
      throw new AuthError('Authentication required');
    }
    return user;
  }
}
```

### Data Privacy

#### Private Configuration Filtering

```typescript
class PrivacyFilter {
  filterPublicConfigurations(configurations: ConfigBundle[]): ConfigBundle[] {
    return configurations.filter((config) => !config.metadata.is_private);
  }

  async getUserAccessibleConfigurations(userId: string): Promise<ConfigBundle[]> {
    // Return public configs + user's private configs
    return this.supabase.from('config_bundles').select('*').or(`metadata->>'is_private'.eq.false,metadata->>'user_id'.eq.${userId}`);
  }
}
```

## Design Decisions and Rationales

### 1. Table-Based Output Format

**Decision**: Use a structured table format for displaying configuration lists

**Rationale**:

- Provides clear, scannable information layout
- Consistent with common CLI tools (ls, ps, etc.)
- Easily parseable by users and scripts
- Supports alignment and formatting

### 2. Default Sorting by Creation Date

**Decision**: Default sort order is newest-first by creation date

**Rationale**:

- Most relevant configurations are typically the most recent
- Matches user expectations from other platforms
- Provides consistent, predictable ordering

### 3. 20-Item Default Limit with 100 Maximum

**Decision**: Limit results to 20 by default, maximum 100

**Rationale**:

- Prevents overwhelming output in terminal
- Reduces API response time and bandwidth
- 100 maximum prevents abuse while allowing flexibility
- Encourages use of filtering for large result sets

### 4. Separate Subcommand for Liked Configurations

**Decision**: Implement `taptik list liked` as a subcommand rather than an option

**Rationale**:

- Clear semantic distinction between public and personal lists
- Allows for different authentication requirements
- Enables future expansion with other list types
- Follows CLI convention patterns

### 5. Client-Side vs Server-Side Filtering

**Decision**: Implement filtering at the database level using SQL queries

**Rationale**:

- Reduces network bandwidth and response time
- Leverages database indexing for performance
- Scales better with large datasets
- Provides consistent filtering behavior

### 6. Error Message Specificity

**Decision**: Provide specific, actionable error messages for different failure scenarios

**Rationale**:

- Improves user experience and reduces support burden
- Enables users to self-resolve common issues
- Follows CLI best practices for error communication
- Maintains consistency with existing Taptik commands

### 7. Title-Only Filtering

**Decision**: Filter configurations by title only, not by description

**Rationale**:

- Aligns with Requirement 2.1 which specifies filtering by title
- Provides focused search results
- Reduces complexity and improves performance
- Matches user expectations for title-based search

### 8. Simplified Sort Options

**Decision**: Support only 'date' and 'name' sorting, removing 'size' option

**Rationale**:

- Aligns with Requirements 3.1 and 3.2 which only specify date and name sorting
- Size sorting may not be meaningful for configuration packages
- Simplifies user interface and reduces cognitive load
- Focuses on most commonly used sorting criteria

### 9. Exact Error Message Compliance

**Decision**: Use exact error messages as specified in requirements

**Rationale**:

- Ensures consistent user experience across the application
- Provides clear, actionable guidance for users
- Meets specific acceptance criteria defined in Requirement 6
- Enables predictable error handling for automation scripts

This design provides a robust, user-friendly, and performant implementation of the list command while maintaining strict compliance with the requirements document and consistency with the existing Taptik CLI architecture.
