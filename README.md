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
taptik --help

# Check application health
taptik health

# Build configuration packages
taptik build

# Authentication commands
taptik login
taptik logout

# Information commands
taptik info
taptik list

# Deploy configurations
taptik deploy
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
- **Deploy** - Apply configurations to target platforms

### 🔧 Supported Configuration Items

- IDE settings (themes, shortcuts, extensions)
- Project templates and boilerplates
- Code snippets and custom commands
- AI prompt templates and contexts
- Environment variable configurations

### 🎨 Supported AI IDEs

- **Claude Code** - Anthropic's AI coding assistant (✅ Full Support)
- **Kiro** - AI development environment (✅ Full Support)
- **Cursor** - AI-powered code editor (🚧 Coming Soon)

## 🛠️ Commands

### Available Commands

```bash
# Core functionality
taptik health                              # Check application health
taptik login                               # OAuth login
taptik logout                              # Logout
taptik info                                # Show current status

# Configuration management
taptik build                               # Build configurations
taptik deploy                              # Deploy to platforms
taptik list                                # List configurations

# Cloud management
taptik push --name "My Setup"              # Upload configuration
taptik pull --id abc123                    # Download configuration
taptik update <config-id>                  # Update package metadata
taptik delete <config-id>                  # Delete package
taptik visibility <config-id>              # Change visibility
taptik stats <config-id>                   # View statistics
```

### Build Command

The `build` command converts your current IDE configuration files into taptik-compatible format for use with various AI development tools.

#### Interactive Mode (Default)

```bash
# Run interactive build with prompts
taptik build
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
taptik build --dry-run

# Specify custom output directory
taptik build --output ./my-custom-path

# Skip platform selection (use Kiro)
taptik build --platform kiro

# Build specific categories only
taptik build --categories personal,project
taptik build --categories prompts

# Show detailed progress information
taptik build --verbose

# Suppress non-essential output
taptik build --quiet

# Combine multiple options
taptik build --platform kiro --categories personal --output ./output --dry-run
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

### List Command

The `list` command helps you discover and explore configuration packages available in the Taptik cloud.

#### Basic Usage

```bash
# List all public configurations
taptik list

# Filter configurations by title
taptik list --filter "frontend"
taptik list --filter "typescript setup"

# Sort configurations
taptik list --sort date    # Sort by creation date (default)
taptik list --sort name    # Sort alphabetically by title

# Limit number of results
taptik list --limit 10     # Show 10 results
taptik list --limit 50     # Show up to 50 results (max: 100)

# Combine options for precise discovery
taptik list --filter "react" --sort name --limit 20
```

### Information & Discovery

```bash
# Show current status
taptik info

# List available configurations
taptik list                              # List all public configurations
taptik list --filter "typescript"       # Filter by title
taptik list --sort name --limit 10       # Sort alphabetically, limit results
taptik list liked                        # List your liked configurations (requires auth)

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