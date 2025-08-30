# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# My Preference
- Please response with korean only.
- Always follow Project Guide(same as CLAUDE_PROJECT_GUIDE.md)

# Project Guide

## Current Work Overview
The deploy command currently only supports Claude Code platform. We are working on adding Kiro platform support.

## Work Process
1. PRD and design and task list are already written
2. Work through tasks starting from 1.1 in order
3. For each task:
   - First explain plan in Korean (no coding)
   - Start coding when user says 'go'
   - After completion, check tasks.md: `[]` -> `[x]`
   - Commit with `/git-commit` command

## Key Files
- `design.md`: Design specifications
- `requirements.md`: Detailed requirements
- `tasks.md`: Task list and progress tracking

## Development Commands
- `pnpm run cli` - Run CLI in development mode
- `pnpm run test:run` - Run tests
- `pnpm run lint` - Run linting
- `pnpm run build` - Build project

## Coding Rules
- Create files only when absolutely necessary
- Prefer editing existing files
- Create documentation files only when explicitly requested
- Respond in Korean

## Current Branch: feat/deploy-kiro
Main Branch: main


## Project Overview

Taptik CLI is a NestJS-based CLI tool for migrating and synchronizing settings between AI development tools (Cursor, Kiro, Claude Code). It provides build, deploy, authentication, and configuration management functionality.

## Essential Commands

### Development
```bash
# Run CLI commands during development
npm run cli -- <command>

# Build and run from compiled dist
npm run cli:build

# Start NestJS server for auth callbacks
npm start:dev
```

### Testing
```bash
# Run all tests with Vitest
npm test

# Run tests once (CI mode)
npm run test:run

# Run specific test file
npm test src/path/to/test.spec.ts

# Coverage reporting with 80% line/60% branch thresholds
npm run test:coverage
```

### Code Quality
```bash
# Lint and fix TypeScript
npm run lint

# Format code with Prettier
npm run format
```

## Architecture Overview

### Core Framework
- **NestJS**: Modular architecture with dependency injection
- **nest-commander**: CLI command structure using decorators (`@Command`, `@SubCommand`)
- **Vitest**: Testing framework (migrated from Jest)

### Module Structure
The codebase is organized into NestJS modules:

- **AuthModule**: OAuth2 authentication (Google/GitHub) with Supabase backend
- **BuildModule**: Converts platform configurations to Taptik format
- **DeployModule**: Deploys Taptik configurations to target platforms
- **ContextModule**: Context validation and transformation utilities
- **InfoModule**: System information and status commands

### Key Services Architecture

#### DeploymentService (`src/modules/deploy/services/deployment.service.ts`)
- Central orchestrator for all deployment operations
- Platform-agnostic deployment with routing to platform-specific handlers
- Integrates backup, security scanning, validation, and error recovery
- Uses composition pattern with specialized services

#### Platform-Specific Services
- **KiroTransformerService**: Transforms Taptik context to Kiro configuration format
- **KiroComponentHandlerService**: Handles file system operations for Kiro components
- **KiroValidatorService**: Validates configurations for Kiro compatibility
- **SecurityScannerService**: Scans components for security violations with platform-specific rules

#### Error Handling & Recovery
- **ErrorRecoveryService**: Automatic retry logic and intelligent fallback strategies  
- **BackupService**: Creates timestamped backups before deployments
- **PerformanceMonitorService**: Tracks deployment performance and resource usage

### Configuration Types & Transformations

The system transforms between three main configuration formats:

1. **TaptikContext**: Universal intermediate format (build system output)
   - PersonalContext: User preferences and environment settings
   - ProjectContext: Project-specific configuration and guidelines  
   - PromptTemplates: Reusable prompt templates

2. **Platform-Specific Formats**: 
   - **Kiro**: JSON settings, markdown steering docs, task specs
   - **Claude Code**: CLAUDE.md files and MCP configurations

3. **Component Mapping**: Each platform has different component types
   - Kiro: settings, steering, specs, hooks, agents, templates
   - Claude Code: claude_md, mcp_config, settings

### Security Architecture

Multi-layered security scanning system:
- **Command validation**: Dangerous pattern detection (rm -rf, eval, etc.)
- **Sensitive data detection**: API keys, tokens, credentials
- **Injection prevention**: Prompt injection, XSS patterns  
- **Component quarantine**: Automatic isolation of high-risk components

### CLI Command Pattern

All CLI commands follow NestJS commander pattern:
```typescript
@Command({
  name: 'command-name',
  description: 'Command description'
})
export class CommandName extends CommandRunner {
  async run(args: string[], options: OptionsType): Promise<void> {
    // Command implementation
  }
}
```

## Important Implementation Notes

### Testing Strategy
- Use Vitest for all testing (globals enabled in vitest.config.ts)
- Import test functions: `import { describe, it, expect, beforeEach } from 'vitest'`
- NestJS Testing utilities for service injection in unit tests
- Test file naming: `*.spec.ts` for unit tests, `*.integration.spec.ts` for integration tests

### TypeScript Configuration  
- Strict type checking enabled
- Path aliases configured: `@/` maps to `src/`, `@test/` to `test/`
- Security interfaces use enum types for severity levels (`SecuritySeverity.HIGH`)

### Platform Support Status
- **Kiro Platform**: Full deployment support implemented (transformers, handlers, validation, security)
- **Claude Code Platform**: Basic deployment support exists  
- **Cursor Platform**: Planned but not yet implemented

### Service Dependencies
Services use constructor injection and follow dependency hierarchy:
- DeploymentService depends on all platform-specific services
- Platform services depend on shared utilities (validation, security, backup)
- All services integrate with shared error handling and monitoring infrastructure

### File System Operations
- All file operations use absolute paths
- Backup creation before destructive operations  
- Atomic file operations with rollback capability
- Cross-platform path handling with proper normalization