---
inclusion: always
---

# Taptik CLI - Product Requirements Document (PRD)

## Product Overview

### Product Name

`taptik-cli` (npx package name: `bulgogi-whopper/taptik-cli`)

### Product Description

A CLI tool that enables easy migration and synchronization of settings and environments between
various AI development tools such as AI IDEs and Claude Code. It provides secure authentication
through Supabase Auth (supporting Google and GitHub OAuth), helping developers maintain consistent
development environments across multiple AI tools.

### Core Values

- **Portability**: Settings migration between various AI development tools
- **Convenience**: Complex settings synchronization through simple CLI commands
- **Security**: Secure authentication via Supabase Auth with OAuth 2.0
- **Extensibility**: Support for various AI IDEs and tools

## Technology Stack

### Core Technologies

- **Framework**: NestJS
- **CLI Framework**: nestjs-commander
- **Authentication**: Supabase Auth (Google OAuth 2.0, GitHub OAuth)
- **Database**: Supabase (PostgreSQL)
- **Package Manager**: npm/npx
- **Language**: TypeScript

### Key Dependencies

- `@nestjs/core`
- `nestjs-commander`
- `@nestjs/config`
- `@supabase/supabase-js` (Supabase client)
- `chalk` (CLI styling)
- `ora` (Loading spinner)
- `@inquirer/prompts` (Interactive prompts)

## Feature Specifications

### 1. Authentication Commands

#### `taptik login`

**Description**: User authentication via Supabase Auth (Google or GitHub OAuth)

**Options**:

- `--provider <provider>`: Select authentication provider (google/github)
- `--force`: Overwrite existing authentication information

**Process**:

1. Select authentication provider (interactive selection if not specified)
2. Open OAuth authentication page in browser via Supabase
3. Handle OAuth callback and session management
4. Store session tokens in secure local storage

#### `taptik logout`

**Description**: End current authentication session

**Options**:

- `--all`: Logout from all authentication providers

**Process**:

1. Clear Supabase session
2. Delete stored tokens
3. Remove cached configuration information
4. Display logout confirmation message

### 2. Configuration Management Commands

#### `taptik build`

**Description**: Collect current AI tool settings and build into synchronizable format

**Options**:

- `--source <tool>`: Specify tool to import settings from
- `--output <path>`: Build result save path
- `--include <items>`: Configuration items to include (comma-separated)
- `--exclude <items>`: Configuration items to exclude

**Supported Configuration Items**:

- IDE settings (themes, shortcuts, extensions)
- Project templates
- Code snippets
- AI prompt templates
- Environment variable settings

#### `taptik push`

**Description**: Upload built configuration to Supabase storage

**Options**:

- `--name <name>`: Configuration bundle name
- `--description <desc>`: Configuration description
- `--private`: Save as private configuration
- `--force`: Overwrite existing configuration

**Process**:

1. Validate built configuration file
2. Upload to Supabase Storage
3. Create database record in Supabase
4. Generate and return unique ID

#### `taptik pull`

**Description**: Download configuration from cloud and apply to current tool

**Options**:

- `--id <id>`: Download by specific configuration ID
- `--latest`: Download latest configuration
- `--target <tool>`: Specify tool to apply to
- `--dry-run`: Preview without actual application

**Process**:

1. Query configuration from Supabase database
2. Download from Supabase Storage
3. Check compatibility with target tool
4. Apply configuration (create backup)
5. Report application results

### 3. Information Query Commands

#### `taptik info`

**Description**: Display current authentication status and configuration information

**Output Information**:

- Authenticated account information (from Supabase Auth)
- Current tool and version
- Last synchronization time
- Number of saved configurations

#### `taptik list`

**Description**: Query available configuration list from Supabase

**Options**:

- `--filter <query>`: Search filter
- `--sort <field>`: Sort criteria (name/date/size)
- `--limit <n>`: Limit number of results

**Output Format**:

ID Name Created Size Access ───────────────────────────────────────────────────────── abc123 My IDE
Config 2025-08-01 2.3MB Private def456 Team Settings 2025-07-30 1.8MB Public

### 4. Utility Commands

#### `taptik --version` / `taptik -v`

**Description**: Display CLI version information

**Detailed Version Info** (`-vv`):

- CLI version
- Node.js version
- Supported tools list
- Installation path

#### `taptik --help` / `taptik -h`

**Description**: Display help

**Options**:

- Command-specific help: `taptik <command> --help`

## Data Models

### Configuration Bundle (Supabase Schema)

```typescript
// Supabase Table: config_bundles
interface ConfigBundle {
  id: string; // Primary key
  name: string;
  description?: string;
  version: string;
  source: {
    tool: string;
    version: string;
  };
  settings: {
    ide?: IDESettings;
    templates?: ProjectTemplate[];
    snippets?: CodeSnippet[];
    prompts?: AIPrompt[];
    env?: EnvironmentVariables;
  };
  metadata: {
    created_at: Date; // Supabase automatic
    updated_at: Date; // Supabase automatic
    user_id: string; // Supabase Auth user ID
    is_private: boolean;
    tags: string[];
  };
  storage_path: string; // Supabase Storage path
}
```
