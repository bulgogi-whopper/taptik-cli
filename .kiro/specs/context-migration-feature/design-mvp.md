# Context Migration Feature Design Document (MVP)

## Overview

The Context Migration Feature enables seamless bidirectional transfer of development environments and configurations between Kiro and Claude Code AI IDEs. This MVP focuses on perfect interoperability between these two platforms, providing a unified context format that can capture, store, and deploy configurations with 100% feature preservation and intelligent mapping. The architecture emphasizes deep platform integration, security, and performance while establishing an extensible foundation for future platform additions.

## Architecture

### MVP Architecture: Kiro ↔ Claude Code Focus

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│    Kiro     │◄───────►│  Taptik CLI  │◄───────►│ Claude Code │
└─────────────┘         └──────────────┘         └─────────────┘
      │                        │                        │
      ▼                        ▼                        ▼
  .kiro/                  Universal                .claude/
- specs/                Context                 - settings.json
- steering/             Format                  - commands/
- hooks/                                        - CLAUDE.md
- settings/                                     - mcp.json
```

### Focused Two-Platform Integration

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Kiro & Claude │    │   Taptik CLI     │    │   Supabase      │
│   Code IDEs     │◄──►│   Context Engine │◄──►│   Cloud Storage │
└─────────────────┘    └──────────────────┘    └─────────────────┘
        │                        │                        │
        ▼                        ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ • Kiro Config   │    │ • Context Builder│    │ • File Storage  │
│ • Claude Config │    │ • Bi-Converter   │    │ • Metadata DB   │
│ • Feature Map   │    │ • Validator      │    │ • Access Control│
│ • Compatibility │    │ • Deployer       │    │ • Encryption    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Context Processing Pipeline

```
Extract → Normalize → Validate → Store → Retrieve → Convert → Deploy
   │         │          │         │         │         │        │
   ▼         ▼          ▼         ▼         ▼         ▼        ▼
Kiro/     Universal  Schema   Supabase  Download  Target   Apply
Claude    Context    Check    Upload    Context   Format   Config
```

## Components and Interfaces

### 1. Context Builder Service

**Purpose**: Extract and build context bundles from Kiro and Claude Code environments

**Key Components**:

- `KiroContextExtractor`: Extracts .kiro/specs, steering rules, hooks, settings
- `ClaudeCodeContextExtractor`: Extracts .claude/settings, MCP servers, CLAUDE.md files
- `PlatformDetector`: Auto-detects current IDE environment
- `ContextValidator`: Validates extracted context completeness

**Interface**:

```typescript
interface ContextBuilder {
  buildContext(platform: 'kiro' | 'claude-code', options: BuildOptions): Promise<TaptikContext>;
  detectPlatform(workspacePath: string): Promise<'kiro' | 'claude-code' | 'unknown'>;
  validateExtraction(context: TaptikContext): Promise<ValidationResult>;
}
```

### 2. Bidirectional Converter Service

**Purpose**: Convert contexts between Kiro and Claude Code formats with intelligent feature mapping

**Key Components**:

- `KiroToClaudeConverter`: Converts Kiro configurations to Claude Code format
- `ClaudeToKiroConverter`: Converts Claude Code configurations to Kiro format
- `FeatureMapper`: Maps equivalent features between platforms
- `ConversionReporter`: Generates detailed conversion reports

**Interface**:

```typescript
interface BidirectionalConverter {
  convertKiroToClaudeCode(context: TaptikContext): Promise<ConversionResult>;
  convertClaudeCodeToKiro(context: TaptikContext): Promise<ConversionResult>;
  validateCompatibility(context: TaptikContext, targetPlatform: 'kiro' | 'claude-code'): Promise<CompatibilityReport>;
  getFeatureMapping(from: 'kiro' | 'claude-code', to: 'kiro' | 'claude-code'): FeatureMapping;
}
```

### 3. Context Storage Service

**Purpose**: Handle cloud storage operations with Supabase for context persistence

**Key Components**:

- `ContextUploader`: Handles context bundle uploads with compression
- `ContextDownloader`: Manages context retrieval with caching
- `MetadataManager`: Manages context metadata and indexing
- `SecurityManager`: Handles encryption and access control

**Interface**:

```typescript
interface ContextStorage {
  uploadContext(context: TaptikContext, metadata: ContextMetadata): Promise<string>;
  downloadContext(contextId: string): Promise<TaptikContext>;
  listContexts(filters: ContextFilters): Promise<ContextSummary[]>;
  deleteContext(contextId: string): Promise<void>;
}
```

### 4. Context Deployer Service

**Purpose**: Apply contexts to target IDE environments with backup and conflict resolution

**Key Components**:

- `KiroDeployer`: Applies configurations to Kiro environment
- `ClaudeCodeDeployer`: Applies configurations to Claude Code environment
- `BackupManager`: Creates and manages configuration backups
- `ConflictResolver`: Handles configuration conflicts during deployment

**Interface**:

```typescript
interface ContextDeployer {
  deployToKiro(context: TaptikContext, options: DeployOptions): Promise<DeploymentResult>;
  deployToClaudeCode(context: TaptikContext, options: DeployOptions): Promise<DeploymentResult>;
  createBackup(platform: 'kiro' | 'claude-code'): Promise<BackupInfo>;
  restoreBackup(backupId: string): Promise<void>;
}
```

## Data Models

### Core Context Structure (MVP)

```typescript
interface TaptikContext {
  version: string;
  metadata: ContextMetadata;
  source_platform: 'kiro' | 'claude-code';
  kiro_config?: KiroConfiguration;
  claude_code_config?: ClaudeCodeConfiguration;
  universal_mappings?: UniversalMappings;
}

interface KiroConfiguration {
  specs: KiroSpec[];
  steering_rules: SteeringRule[];
  hooks: Hook[];
  mcp_settings?: McpSettings;
  project_settings: KiroProjectSettings;
}

interface ClaudeCodeConfiguration {
  settings: ClaudeCodeSettings;
  mcp_servers: McpServerConfig[];
  claude_files: ClaudeFile[];
  custom_commands: CustomCommand[];
  permissions: PermissionConfig;
}
```

### Feature Mapping System

```typescript
interface FeatureMapping {
  kiro_to_claude: {
    specs: 'claude_files' | 'custom_instructions';
    steering_rules: 'custom_instructions' | 'settings';
    hooks: 'custom_commands' | 'mcp_servers';
    mcp_settings: 'mcp_servers';
  };
  claude_to_kiro: {
    claude_files: 'specs' | 'steering_rules';
    custom_instructions: 'steering_rules';
    mcp_servers: 'mcp_settings' | 'hooks';
    settings: 'project_settings';
  };
  bidirectional: {
    mcp_servers: 'mcp_servers';
    project_metadata: 'project_metadata';
  };
}
```

### Conversion Results

```typescript
interface ConversionResult {
  success: boolean;
  converted_context: TaptikContext;
  mapping_report: MappingReport;
  warnings: ConversionWarning[];
  errors: ConversionError[];
}

interface MappingReport {
  features_mapped: FeatureMappingDetail[];
  features_preserved: string[];
  features_approximated: FeatureApproximation[];
  features_unsupported: UnsupportedFeature[];
}
```

## Platform-Specific Implementation Details

### Kiro Configuration Extraction

**File Locations**:

- `.kiro/specs/*/requirements.md` - Project specifications
- `.kiro/specs/*/design.md` - Design documents
- `.kiro/specs/*/tasks.md` - Task lists
- `.kiro/steering/*.md` - Steering rules
- `.kiro/hooks/*.json` - Automation hooks
- `.kiro/settings/mcp.json` - MCP server configurations

**Extraction Strategy**:

```typescript
class KiroContextExtractor {
  async extractSpecs(specsPath: string): Promise<KiroSpec[]> {
    // Read all spec directories
    // Parse requirements.md, design.md, tasks.md
    // Include referenced files
  }

  async extractSteeringRules(steeringPath: string): Promise<SteeringRule[]> {
    // Read all .md files in steering directory
    // Parse front-matter for metadata
    // Include file references
  }

  async extractHooks(hooksPath: string): Promise<Hook[]> {
    // Read hook configuration files
    // Parse automation triggers and actions
  }
}
```

### Claude Code Configuration Extraction

**File Locations**:

- `.claude/settings.json` - IDE settings and preferences
- `mcp.json` / `.kiro/settings/mcp.json` - MCP server configurations
- `CLAUDE.md` / `CLAUDE.local.md` - Project instructions and context
- Custom command definitions

**Extraction Strategy**:

```typescript
class ClaudeCodeContextExtractor {
  async extractSettings(settingsPath: string): Promise<ClaudeCodeSettings> {
    // Read .claude/settings.json
    // Parse IDE preferences and configurations
  }

  async extractMcpServers(mcpPath: string): Promise<McpServerConfig[]> {
    // Read mcp.json files (workspace and user level)
    // Merge configurations with workspace precedence
  }

  async extractClaudeFiles(workspacePath: string): Promise<ClaudeFile[]> {
    // Find CLAUDE.md and CLAUDE.local.md files
    // Parse content and metadata
  }
}
```

## Intelligent Feature Mapping

### Kiro → Claude Code Mappings

1. **Kiro Specs → Claude Instructions**
   - `requirements.md` → Custom instructions for project requirements
   - `design.md` → Technical context in CLAUDE.md
   - `tasks.md` → Action items in project documentation

2. **Steering Rules → Custom Instructions**
   - Steering markdown files → Custom instruction sections
   - File references → Included context files
   - Conditional rules → Context-specific instructions

3. **Hooks → Custom Commands**
   - Automation hooks → MCP server configurations
   - Trigger conditions → Command aliases
   - Actions → Custom command definitions

### Claude Code → Kiro Mappings

1. **Claude Instructions → Kiro Specs**
   - Custom instructions → Steering rules
   - Project context → Spec requirements
   - Technical details → Design documents

2. **MCP Servers → Kiro MCP Settings**
   - Direct mapping of MCP configurations
   - Server-specific settings preservation
   - Auto-approval lists maintenance

3. **CLAUDE.md → Multiple Kiro Files**
   - Project context → Spec requirements
   - Technical instructions → Steering rules
   - Workflow guidance → Hook configurations

## Error Handling

### Error Categories

1. **Platform Detection Errors**
   - Missing configuration directories
   - Ambiguous platform indicators
   - Corrupted configuration files

2. **Extraction Errors**
   - File permission issues
   - Malformed configuration data
   - Missing required dependencies

3. **Conversion Errors**
   - Incompatible feature combinations
   - Data transformation failures
   - Validation failures

4. **Deployment Errors**
   - Target platform unavailable
   - Configuration conflicts
   - Backup creation failures

### Error Recovery Strategies

```typescript
interface ErrorRecoveryStrategy {
  retryWithBackoff(operation: () => Promise<any>, maxRetries: number): Promise<any>;
  createPartialBackup(failedOperation: string): Promise<BackupInfo>;
  rollbackChanges(deploymentId: string): Promise<void>;
  suggestAlternatives(error: ContextError): string[];
}
```

## Testing Strategy

### Unit Testing

1. **Platform Extractors**
   - Test Kiro configuration extraction with mock file systems
   - Test Claude Code configuration extraction with sample configs
   - Validate extracted context structure and completeness

2. **Bidirectional Conversion**
   - Test Kiro → Claude Code conversion with comprehensive feature coverage
   - Test Claude Code → Kiro conversion with edge cases
   - Validate feature mapping accuracy and completeness

3. **Storage Operations**
   - Mock Supabase operations for upload/download testing
   - Test encryption/decryption of sensitive data
   - Validate metadata consistency and indexing

### Integration Testing

1. **End-to-End Workflows**
   - Test complete build → push → pull → deploy workflow
   - Validate cross-platform compatibility with real configurations
   - Test backup and restore functionality

2. **Platform Integration**
   - Test with actual Kiro and Claude Code installations
   - Validate configuration application and functionality
   - Test conflict resolution and merge strategies

### Performance Testing

1. **Context Processing**
   - Large context bundle handling (>100MB)
   - Parallel processing efficiency
   - Memory usage optimization

2. **Network Operations**
   - Upload/download speed with compression
   - Retry mechanism effectiveness
   - Caching performance

## Implementation Approach

### Phase 1: Core Infrastructure (Weeks 1-2)

**Deliverables**:

- Context data models and TypeScript interfaces
- Basic context builder framework for Kiro and Claude Code
- Supabase storage integration
- CLI command structure

**Key Tasks**:

- Set up context module structure in NestJS
- Implement TaptikContext interface and validation
- Create Supabase storage service with encryption
- Add CLI commands: `context build`, `context push`, `context pull`

### Phase 2: Platform Extractors (Weeks 3-4)

**Deliverables**:

- Complete Kiro context extractor
- Complete Claude Code context extractor
- Platform auto-detection
- Context validation system

**Key Tasks**:

- Implement KiroContextExtractor with full .kiro/ directory support
- Implement ClaudeCodeContextExtractor with .claude/ and MCP support
- Create PlatformDetector for automatic IDE detection
- Build comprehensive context validation

### Phase 3: Bidirectional Conversion (Weeks 5-6)

**Deliverables**:

- Kiro ↔ Claude Code conversion system
- Intelligent feature mapping
- Conversion reporting
- Compatibility validation

**Key Tasks**:

- Implement KiroToClaudeConverter with feature mapping
- Implement ClaudeToKiroConverter with intelligent approximation
- Create FeatureMapper with comprehensive mapping rules
- Build ConversionReporter for detailed feedback

### Phase 4: Context Deployment (Weeks 7-8)

**Deliverables**:

- Context deployment system
- Backup and restore functionality
- Conflict resolution
- Deployment validation

**Key Tasks**:

- Implement KiroDeployer and ClaudeCodeDeployer
- Create BackupManager with automatic backup creation
- Build ConflictResolver with merge strategies
- Add deployment validation and rollback

### Phase 5: Testing and Polish (Weeks 9-10)

**Deliverables**:

- Comprehensive test suite (>80% coverage)
- Performance optimizations
- Documentation and examples
- User experience improvements

**Key Tasks**:

- Achieve comprehensive test coverage
- Performance testing and optimization
- Create user documentation and examples
- CLI UX improvements and error handling

## Security Considerations

### Data Protection

1. **Sensitive Data Detection**
   - Automatic detection of API keys, tokens, passwords
   - Configurable exclusion patterns for sensitive files
   - Encryption of sensitive context sections before storage

2. **Access Control**
   - User-based context ownership through Supabase Auth
   - Private/public context visibility controls
   - Secure context sharing mechanisms

3. **Data Transmission**
   - TLS encryption for all network operations
   - Context integrity verification with checksums
   - Secure authentication with OAuth providers

## Performance Optimization

### Context Processing

1. **Efficient Extraction**
   - Parallel file reading for large directory structures
   - Streaming processing for large configuration files
   - Incremental extraction for partial updates

2. **Compression and Storage**
   - Context bundle compression (gzip/brotli)
   - Deduplication of common configuration patterns
   - Efficient binary serialization for large contexts

3. **Caching Strategy**
   - Local context cache for frequently accessed contexts
   - Conversion result caching to avoid re-processing
   - Metadata caching for faster context listing

## Future Extensibility

### Plugin Architecture Foundation

The MVP establishes patterns that will support future platform additions:

1. **Extractor Interface**
   - Standardized extraction interface for new platforms
   - Plugin registration system
   - Validation framework for custom extractors

2. **Converter Framework**
   - Extensible conversion system for new platform pairs
   - Feature mapping registry
   - Custom conversion rule definitions

3. **Deployment System**
   - Pluggable deployment strategies
   - Platform-specific deployment validation
   - Extensible backup and restore mechanisms

This MVP design provides a solid foundation for Kiro ↔ Claude Code migration while establishing the architecture patterns needed for future platform expansion.
