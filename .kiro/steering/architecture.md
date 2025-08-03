---
inclusion: always
---

# Architecture Standards

## Module Structure

The application follows a modular architecture where each major CLI command is organized as a
separate module under `/src/modules/`.

### Core Modules

- `auth` - Authentication (login/logout)
- `config` - Configuration management (build/push/pull)
- `info` - Information queries (info/list)
- `health` - Health checks and diagnostics

### Module Directory Structure

```
src/
├── modules/
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── commands/
│   │   │   ├── login.command.ts
│   │   │   └── logout.command.ts
│   │   ├── services/
│   │   │   ├── auth.service.ts
│   │   │   └── supabase.service.ts
│   │   └── dto/
│   │       └── auth.dto.ts
│   ├── config/
│   │   ├── config.module.ts
│   │   ├── commands/
│   │   │   ├── build.command.ts
│   │   │   ├── push.command.ts
│   │   │   └── pull.command.ts
│   │   ├── services/
│   │   │   ├── config.service.ts
│   │   │   ├── migration.service.ts
│   │   │   └── storage.service.ts
│   │   └── dto/
│   │       └── config.dto.ts
│   └── info/
│       ├── info.module.ts
│       ├── commands/
│       │   ├── info.command.ts
│       │   └── list.command.ts
│       └── services/
│           └── info.service.ts
├── models/                   # Data Models & Types
│   ├── config-bundle.model.ts
│   ├── user.model.ts
│   ├── sync-session.model.ts
│   └── ide-settings.model.ts
├── shared/
│   ├── services/
│   │   ├── file.service.ts
│   │   └── logger.service.ts
│   ├── utils/
│   │   └── validation.util.ts
│   └── interfaces/
│       └── config.interface.ts
├── app.module.ts
├── cli.ts
└── main.ts
```

## Layer Responsibilities

### Command Layer (`/commands/`)

**Purpose**: CLI interface layer - handles user input, validation, and output formatting

**Responsibilities**:

- Parse CLI arguments and options using nest-commander
- Validate user input
- Call appropriate service methods
- Format and display output to user
- Handle CLI-specific errors and help messages

**Naming Convention**: `<action>.command.ts`

**Example Structure**:

```typescript
@Command({
  name: 'login',
  description: 'Authenticate with Supabase',
})
export class LoginCommand extends CommandRunner {
  constructor(private authService: AuthService) {
    super();
  }

  async run(passedParams: string[], options?: LoginOptions): Promise<void> {
    // CLI logic only - delegate business logic to service
  }
}
```

### Service Layer (`/services/`)

**Purpose**: Business logic layer - contains core application functionality

**Responsibilities**:

- Implement business logic and rules
- Handle data transformation and validation
- Manage external API calls (Supabase, file system)
- Coordinate between different services
- Handle business-level error scenarios

**Naming Convention**: `<domain>.service.ts`

**Example Structure**:

```typescript
@Injectable()
export class AuthService {
  constructor(
    private supabaseService: SupabaseService,
    private configService: ConfigService,
  ) {}

  async authenticate(provider: AuthProvider): Promise<AuthResult> {
    // Business logic implementation
  }
}
```

### Module Organization

Each module must:

- Export a NestJS module class that imports all commands and services
- Register commands with nest-commander
- Provide all services through dependency injection
- Import shared services from `/shared/`

**Module Template**:

```typescript
@Module({
  imports: [SharedModule],
  providers: [
    // Services
    AuthService,
    SupabaseService,
    // Commands
    LoginCommand,
    LogoutCommand,
  ],
  exports: [AuthService], // Export services used by other modules
})
export class AuthModule {}
```

## Dependency Flow

```
CLI Input → Command Layer → Service Layer → External APIs/File System
                ↓              ↓
            User Output ← Business Logic ← Data Processing
```

## Cross-Module Communication

- Services can depend on other services through dependency injection
- Commands should only depend on services within their module or shared services
- Use shared interfaces in `/shared/interfaces/` for type definitions
- Shared utilities go in `/shared/utils/`

## Testing Structure

Mirror the module structure in tests:

```
src/modules/auth/
├── commands/
│   ├── login.command.ts
│   └── login.command.spec.ts
└── services/
    ├── auth.service.ts
    └── auth.service.spec.ts
```

## Models Layer (`/models/`)

**Purpose**: Data models and type definitions for core business entities

**Responsibilities**:

- Define TypeScript interfaces and classes for business entities
- Provide type safety across the application
- Define data validation rules and constraints
- Map between external API responses and internal data structures

**Naming Convention**: `<entity>.model.ts`

**Core Models**:

- `config-bundle.model.ts` - Configuration bundle structure and metadata
- `user.model.ts` - User profile and authentication data
- `sync-session.model.ts` - Synchronization session tracking
- `ide-settings.model.ts` - IDE-specific settings and preferences

**Example Structure**:

```typescript
export interface ConfigBundle {
  id: string;
  name: string;
  description?: string;
  version: string;
  source: ToolInfo;
  settings: ConfigSettings;
  metadata: BundleMetadata;
  storage_path: string;
}

export class ConfigBundleEntity implements ConfigBundle {
  // Implementation with validation methods
  validate(): ValidationResult {
    // Validation logic
  }
}
```

## File Naming Conventions

- **Commands**: `<action>.command.ts`
- **Services**: `<domain>.service.ts`
- **Modules**: `<module>.module.ts`
- **DTOs**: `<domain>.dto.ts`
- **Models**: `<entity>.model.ts`
- **Interfaces**: `<domain>.interface.ts`
- **Tests**: `<filename>.spec.ts`

## Import Guidelines

- Use barrel exports (`index.ts`) for clean imports between modules
- Import from `@/modules/<module>` using path aliases
- Models: `@/models/<entity>.model`
- Shared utilities: `@/shared/<type>/<name>`
- External dependencies at the top, internal imports below

**Import Order**:

1. External dependencies (npm packages)
2. Models (`@/models/`)
3. Shared utilities (`@/shared/`)
4. Module-specific imports (`@/modules/`)
5. Relative imports (`./`, `../`)

This architecture ensures clear separation of concerns, testability, and maintainability while
following NestJS best practices.
