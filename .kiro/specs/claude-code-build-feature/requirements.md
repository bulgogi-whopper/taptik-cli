# Requirements Document

## Introduction

This specification defines the requirements for implementing the `taptik build --platform=claude-code` feature that enables users to collect and transform Claude Code IDE settings into the standardized Taptik format. This feature extends the existing build system architecture to support Claude Code as a platform, following the same patterns established by the Kiro build implementation.

The feature will scan Claude Code configuration directories, collect relevant settings and configurations, transform them into Taptik's standardized format, and output them as JSON files that can be synchronized across different AI development environments.

## Requirements

### Requirement 1

**User Story:** As a Claude Code user, I want to specify Claude Code as my platform using the --platform flag, so that I can build my Claude Code settings without interactive platform selection.

#### Acceptance Criteria

1. WHEN I run `taptik build --platform=claude-code` THEN the system SHALL skip platform selection and use Claude Code as the source platform
2. WHEN the platform is Claude Code THEN the system SHALL proceed directly to category selection (or use preset categories if --categories is specified)
3. WHEN Claude Code platform is selected THEN the system SHALL display "Building from Claude Code platform..." message
4. WHEN Claude Code platform is used THEN the system SHALL scan both global (~/.claude/) and project-specific (.claude/) configuration directories
5. IF Claude Code directories are not found THEN the system SHALL display clear error message indicating Claude Code is not installed or configured

### Requirement 2

**User Story:** As a Claude Code user, I want the system to collect my project-specific Claude Code settings, so that my project configurations are included in the build.

#### Acceptance Criteria

1. WHEN "Project Context" is selected THEN the system SHALL scan the current project's `.claude/` directory
2. WHEN scanning project settings THEN the system SHALL collect `.claude/settings.json` if it exists
3. WHEN scanning project instructions THEN the system SHALL collect `CLAUDE.md` and `CLAUDE.local.md` files from project root
4. WHEN scanning steering files THEN the system SHALL collect all markdown files from `.claude/steering/` directory
5. WHEN scanning agents THEN the system SHALL collect all files from `.claude/agents/` directory
6. WHEN scanning commands THEN the system SHALL collect all files from `.claude/commands/` directory
7. WHEN scanning hooks THEN the system SHALL collect all files from `.claude/hooks/` directory
8. WHEN scanning MCP configuration THEN the system SHALL collect `.mcp.json` file from project root
9. IF `.claude/` directory does not exist THEN the system SHALL log warning and continue with empty project settings

### Requirement 3

**User Story:** As a Claude Code user, I want the system to collect my global Claude Code settings, so that my user-wide preferences are included in the build.

#### Acceptance Criteria

1. WHEN "Personal Context" is selected THEN the system SHALL scan the user's `~/.claude/` directory
2. WHEN scanning global settings THEN the system SHALL collect `~/.claude/settings.json` if it exists
3. WHEN scanning global agents THEN the system SHALL collect all files from `~/.claude/agents/` directory
4. WHEN scanning global commands THEN the system SHALL collect all files from `~/.claude/commands/` directory
5. WHEN scanning global MCP configuration THEN the system SHALL collect `~/.claude/mcp.json` if it exists
6. IF global Claude directory does not exist THEN the system SHALL log warning and continue with empty global settings
7. IF access to home directory is denied THEN the system SHALL display error message and continue without global settings

### Requirement 4

**User Story:** As a Claude Code user, I want my collected settings to be converted to taptik standard format, so that they can be used for migration and synchronization.

#### Acceptance Criteria

1. WHEN converting Personal Context THEN the system SHALL map Claude Code global settings to personal-context.json format including user preferences, themes, and global agents
2. WHEN converting Project Context THEN the system SHALL map Claude Code project settings to project-context.json format including project instructions, steering files, and MCP configurations
3. WHEN converting Prompt Templates THEN the system SHALL map Claude Code agents and steering files to prompt-templates.json format
4. WHEN processing MCP configurations THEN the system SHALL merge global and project-level MCP settings with project-level taking precedence
5. WHEN processing instruction files THEN the system SHALL merge CLAUDE.md and CLAUDE.local.md content appropriately
6. WHEN conversion fails for any category THEN the system SHALL log error and exclude that category from build
7. WHEN conversion is successful THEN the system SHALL validate output against taptik specification schema

### Requirement 5

**User Story:** As a developer, I want the Claude Code build feature to extend existing services, so that the codebase remains maintainable and follows established patterns.

#### Acceptance Criteria

1. WHEN implementing Claude Code support THEN the system SHALL extend CollectionService with methods: `collectClaudeCodeLocalSettings()`, `collectClaudeCodeGlobalSettings()`, `parseMcpConfig()`, `parseClaudeAgents()`, `parseClaudeCommands()`
2. WHEN implementing Claude Code support THEN the system SHALL extend TransformationService with methods: `transformClaudeCodePersonalContext()`, `transformClaudeCodeProjectContext()`, `transformClaudeCodePromptTemplates()`
3. WHEN implementing Claude Code support THEN the system SHALL reuse existing services (InteractiveService, OutputService, ProgressService, ErrorHandlerService) without modification
4. WHEN implementing Claude Code support THEN the system SHALL follow the same error handling patterns as the Kiro build implementation
5. WHEN implementing Claude Code support THEN the system SHALL support all existing CLI options (--dry-run, --output, --verbose, --quiet, --categories)

### Requirement 6

**User Story:** As a Claude Code user, I want to see real-time progress during the build process, so that I understand what the system is doing and can track completion.

#### Acceptance Criteria

1. WHEN build process starts THEN the system SHALL display progress indicators with Claude Code specific messages
2. WHEN scanning local settings THEN the system SHALL show "✓ Scanning local Claude Code settings..." with spinner
3. WHEN scanning global settings THEN the system SHALL show "✓ Scanning global Claude Code settings..." with spinner
4. WHEN processing MCP configurations THEN the system SHALL show "✓ Processing MCP server configurations..." with spinner
5. WHEN converting categories THEN the system SHALL show "✓ [Category] Complete Conversion!" for each completed category
6. WHEN build completes THEN the system SHALL display summary with output directory and file sizes
7. IF any step fails THEN the system SHALL display error message with clear indication of what failed

### Requirement 7

**User Story:** As a Claude Code user, I want proper error handling and validation, so that I receive clear feedback when issues occur during the build process.

#### Acceptance Criteria

1. WHEN Claude Code directories are not found THEN the system SHALL provide clear error messages indicating "Claude Code not found. Please ensure Claude Code is installed and configured."
2. WHEN Claude Code configuration files are malformed THEN the system SHALL report specific validation errors with file paths and line numbers
3. WHEN MCP configuration JSON is invalid THEN the system SHALL validate the JSON structure and report parsing errors with specific details
4. WHEN file permissions prevent access THEN the system SHALL report permission errors with suggested solutions like "Run with appropriate permissions or check file ownership"
5. WHEN transformation fails THEN the system SHALL provide detailed error information including the source file and transformation step
6. WHEN critical errors occur THEN the system SHALL exit with appropriate error code (non-zero)
7. WHEN warnings occur THEN the system SHALL continue execution and display warning summary at end

### Requirement 8

**User Story:** As a developer, I want comprehensive test coverage for the Claude Code build feature, so that the implementation is reliable and maintainable.

#### Acceptance Criteria

1. WHEN implementing Claude Code collection logic THEN the system SHALL include unit tests for all new collection methods with mock file system
2. WHEN implementing Claude Code transformation logic THEN the system SHALL include unit tests for all transformation mappings with sample Claude Code data
3. WHEN implementing the complete build pipeline THEN the system SHALL include integration tests with mock Claude Code configurations and directory structures
4. WHEN testing error scenarios THEN the system SHALL include tests for missing directories, malformed files, and permission errors
5. WHEN testing CLI integration THEN the system SHALL include tests verifying --platform=claude-code works with all existing CLI options
6. WHEN creating test fixtures THEN the system SHALL include sample Claude Code configurations for agents, MCP settings, and instruction files

### Requirement 9

**User Story:** As a Claude Code user, I want the build output to be compatible with other Taptik features, so that I can use the generated files for synchronization and deployment.

#### Acceptance Criteria

1. WHEN generating personal-context.json THEN the system SHALL follow the TaptikPersonalContext interface with Claude Code specific mappings
2. WHEN generating project-context.json THEN the system SHALL follow the TaptikProjectContext interface with Claude Code project information
3. WHEN generating prompt-templates.json THEN the system SHALL follow the TaptikPromptTemplates interface with Claude Code agents converted to templates
4. WHEN creating manifest.json THEN the system SHALL include source_platform as "claude-code" and list all processed Claude Code files
5. WHEN validating output files THEN the system SHALL ensure all generated JSON is valid and schema-compliant
6. WHEN other Taptik commands consume the output THEN the system SHALL ensure compatibility with push, pull, and deploy operations
