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
taptik deploy --platform claude-code
taptik deploy --dry-run  # Preview without applying
```

## 📋 Features

### 🔐 Authentication

- **Google OAuth 2.0** - Secure login with your Google account
- **GitHub OAuth** - Authenticate using GitHub credentials
- **Supabase Auth** - Enterprise-grade authentication infrastructure

### 📦 Configuration Management

- **Build** - Package your current AI tool settings into a shareable format
- **Deploy** - Apply configurations to target platforms
- **Update** - Modify metadata of uploaded packages
- **Delete** - Remove packages from cloud storage

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

### Core Commands

```bash
# Application health and info
taptik health [--verbose] [--format json|text]   # Check application health
taptik info                                      # Show auth status and info
taptik --version                                 # Show version

# Authentication
taptik login [--provider google|github]         # OAuth login
taptik logout                                   # Logout
```

### Configuration Commands  

```bash
# Build configurations
taptik build [--output <path>] [--platform <platform>] 
             [--categories <list>] [--push] [--push-public]

# Deploy to platforms
taptik deploy [--platform <platform>] [--context-id <id>] 
              [--dry-run] [--validate-only] [--force]

# List configurations
taptik list [--filter <query>] [--sort <field>] [--limit <n>]
```

### Cloud Management Commands

```bash
# Manage uploaded packages
taptik update <config-id> [--title <title>] [--description <desc>] [--tags <tags>] [--yes]
taptik delete <config-id> [--yes] [--force]
taptik visibility <config-id> [--public|--private] [--yes]
taptik stats <config-id> [--format table|json|simple] [--detailed]
```

## ℹ️ Command Details

### Build Command

The `build` command converts your IDE configuration files into shareable format. Run interactively or with specific options:

```bash
# Interactive mode (recommended for first-time users)
taptik build

# Examples with options
taptik build --platform claude-code --output ./my-config
taptik build --categories personal,project --push
```

**Available platforms**: `kiro`, `claude-code`, `cursor`  
**Available categories**: `personal`, `project`, `prompts`

### Deploy Command  

Deploy configurations to target IDE platforms:

```bash
# Deploy with options
taptik deploy --platform claude-code --dry-run  # Preview first
taptik deploy --context-id abc123 --force       # Deploy specific config
```

**Supported platforms**: `claude-code` (default), `kiro-ide`, `cursor-ide`

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