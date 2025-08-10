# Taptik CLI

A CLI tool that enables seamless migration and synchronization of settings between various AI development tools like Cursor, Kiro, and Claude Code. Simplify your AI IDE workflow with one-click context and configuration sharing.

## 🎯 Overview

New AI IDEs and LLM tools are emerging rapidly, but switching between them means constantly re-sharing your context and reconfiguring settings. Taptik CLI solves this by providing:

- **Easy Migration**: One-click migration between AI IDEs
- **Context Sharing**: Share your developer context (experience, domain, preferences) across tools
- **Configuration Sync**: Sync prompts, templates, and settings between different AI development environments
- **Community Marketplace**: Import and share prompt sets like Docker Hub for configurations

## 🚀 Quick Start

### Installation

```bash
# Install globally via npm
npm install -g taptik-cli

# Or use directly with npx
npx taptik-cli --help
```

### Basic Usage

```bash
# Check CLI health and available commands
npm run cli -- --help

# Build taptik-compatible files from your current Kiro setup
npm run build:kiro

# Interactive build with all options
npm run cli -- build

# Build with specific options
npm run cli -- build --platform kiro --categories personal,project --verbose

# Build your current configuration
taptik build

# Preview build without creating files (dry run)
npm run cli -- build --dry-run

# Build with custom output directory
npm run cli -- build --output ./my-taptik-config

# Build specific categories only
npm run cli -- build --categories personal,project

# Silent build (suppress non-essential output)
npm run cli -- build --quiet

# Push configuration to cloud
taptik push --name "My Setup" --description "Full stack dev config"

# Pull someone else's configuration
taptik pull --id abc123

# List available configurations
taptik list

# Check your current status
taptik info
```

## 📋 Features

### 🔐 Authentication
- **Google OAuth 2.0** - Secure login with your Google account
- **GitHub OAuth** - Authenticate using GitHub credentials
- **Supabase Auth** - Enterprise-grade authentication infrastructure

### 📦 Configuration Management
- **Build** - Package your current AI tool settings into a shareable format
- **Push** - Upload configurations to cloud storage
- **Pull** - Download and apply configurations from the community
- **Sync** - Keep settings synchronized across multiple tools

### 🔧 Supported Configuration Items
- IDE settings (themes, shortcuts, extensions)
- Project templates and boilerplates
- Code snippets and custom commands
- AI prompt templates and contexts
- Environment variable configurations

### 🎨 Supported AI IDEs (MVP)
- **Cursor** - AI-powered code editor
- **Kiro** - AI development environment  
- **Claude Code** - Anthropic's AI coding assistant

## 🛠️ Commands

### Build Command

The `build` command converts your Kiro configuration files into taptik-compatible format for use with various AI development tools.

#### Interactive Mode (Default)

```bash
# Run interactive build with prompts
npm run cli -- build
```

The interactive mode will guide you through:
1. **Platform Selection**: Choose your source platform (Kiro, Cursor, Claude Code)
2. **Category Selection**: Select which types of context to build:
   - **Personal Context**: User preferences, development environment, coding style
   - **Project Context**: Project info, tech stack, architecture patterns, guidelines
   - **Prompt Templates**: Reusable prompt templates for various development tasks

#### Command-Line Options

```bash
# Dry run - preview what would be built without creating files
npm run cli -- build --dry-run

# Specify custom output directory
npm run cli -- build --output ./my-custom-path

# Skip platform selection (use Kiro)
npm run cli -- build --platform kiro

# Build specific categories only
npm run cli -- build --categories personal,project
npm run cli -- build --categories prompts

# Show detailed progress information
npm run cli -- build --verbose

# Suppress non-essential output
npm run cli -- build --quiet

# Combine multiple options
npm run cli -- build --platform kiro --categories personal --output ./output --dry-run
```

#### Build Options Reference

| Option | Description | Example |
|--------|-------------|---------|
| `--dry-run` | Preview build without creating files | `--dry-run` |
| `--output <path>` | Custom output directory path | `--output ./my-config` |
| `--platform <platform>` | Skip platform selection | `--platform kiro` |
| `--categories <list>` | Comma-separated category list | `--categories personal,project` |
| `--verbose` | Show detailed progress info | `--verbose` |
| `--quiet` | Suppress non-essential output | `--quiet` |

#### Output Structure

The build command creates a timestamped directory with the following structure:

```
taptik-build-20240115-103000/
├── personal-context.json    # User preferences and environment
├── project-context.json     # Project info and guidelines  
├── prompt-templates.json    # Reusable prompt templates
└── manifest.json           # Build metadata and file info
```

#### Supported Categories

- **Personal Context**: Development environment, coding preferences, workflow practices, AI interaction preferences
- **Project Context**: Technical stack, architecture patterns, development guidelines, security requirements
- **Prompt Templates**: Code review templates, debugging guides, architecture reviews, performance analysis

#### Examples

```bash
# Build everything interactively
npm run cli -- build

# Quick build for personal context only
npm run cli -- build --platform kiro --categories personal --quiet

# Preview full build
npm run cli -- build --dry-run --verbose

# Build for specific output location
npm run cli -- build --output ~/my-taptik-configs/project-x
```

### Authentication

```bash
# Login with provider selection
taptik login
taptik login --provider google
taptik login --provider github

# Logout
taptik logout
taptik logout --all
```

### Configuration Management

```bash
# Build configuration from current tool
taptik build
taptik build --source cursor --output ./my-config.json
taptik build --include "themes,snippets" --exclude "extensions"

# Push to cloud
taptik push --name "Backend Dev Setup"
taptik push --description "Node.js + TypeScript config" --private
taptik push --force  # Overwrite existing

# Pull from cloud
taptik pull --id abc123
taptik pull --latest --target cursor
taptik pull --dry-run  # Preview without applying
```

### Information & Discovery

```bash
# Show current status
taptik info

# List available configurations
taptik list
taptik list --filter "typescript"
taptik list --sort date --limit 10

# Version information
taptik --version
taptik -vv  # Detailed version info
```

## 🏗️ Development

### Prerequisites
- Node.js 18+ 
- pnpm package manager
- Supabase account (for authentication)

### Setup

```bash
# Clone repository
git clone https://github.com/your-org/taptik-cli.git
cd taptik-cli

# Install dependencies
pnpm install

# Setup environment
cp .env.example .env.local
# Configure Supabase credentials in .env.local
```

### Development Commands

```bash
# Run CLI in development
pnpm run cli

# Build and run from dist
pnpm run cli:build

# Start NestJS server
pnpm run start:dev

# Build project
pnpm run build

# Run tests
pnpm run test
pnpm run test:run  # Run once

# Linting and formatting
pnpm run lint
pnpm run format
```

### Project Structure

```
src/
├── cli.ts                 # Main CLI entry point
├── commands/              # CLI command implementations
│   ├── auth.command.ts   # Login/logout commands
│   ├── build.command.ts  # Build configurations
│   ├── push.command.ts   # Upload to cloud
│   └── pull.command.ts   # Download from cloud
├── supabase/             # Supabase client and auth
└── services/             # Business logic services

templates/                # Configuration templates
├── personal-context-template.json
├── project-context-template.json
└── prompt-context-template.json
```

## 🔧 Technology Stack

- **Framework**: NestJS with nest-commander for CLI
- **Authentication**: Supabase Auth (Google/GitHub OAuth)
- **Database**: Supabase (PostgreSQL)
- **Language**: TypeScript
- **Testing**: Vitest (migrated from Jest)
- **Package Manager**: pnpm

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the Beerware License - see the [LICENSE](LICENSE) file for details.



## 📞 Support

- 📧 Issues: [GitHub Issues](https://github.com/your-org/taptik-cli/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/your-org/taptik-cli/discussions)
- 📖 Documentation: [Wiki](https://github.com/your-org/taptik-cli/wiki)

---

**Taptik** - Making AI IDE migration simple, one tap at a time. 🚀