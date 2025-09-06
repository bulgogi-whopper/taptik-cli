# Taptik CLI Developer Guide

## 🚀 Getting Started

### Prerequisites

- Node.js 18.x or higher
- npm or equivalent package manager
- Kiro configuration files (for build functionality)

### Development Setup

```bash
# Clone and install dependencies
git clone <repository-url>
cd taptik-cli
npm install

# Set up development environment
npm run dev:setup

# Run the CLI in development mode
npm run cli -- --help
```

### Package.json Scripts Reference

| Script           | Description               | Usage                         |
| ---------------- | ------------------------- | ----------------------------- |
| `cli`            | Run CLI with ts-node      | `npm run cli -- build`        |
| `cli:build`      | Build and run from dist   | `npm run cli:build -- --help` |
| `cli:dev`        | Quick development build   | `npm run cli:dev`             |
| `cli:help`       | Show main CLI help        | `npm run cli:help`            |
| `cli:build-help` | Show build command help   | `npm run cli:build-help`      |
| `cli:test`       | Test CLI health check     | `npm run cli:test`            |
| `build:kiro`     | Run build command         | `npm run build:kiro`          |
| `build:test`     | Test build functionality  | `npm run build:test`          |
| `test:cli`       | Run CLI integration tests | `npm run test:cli`            |

## 📋 List Command Deep Dive

### Overview

The list command provides discovery and exploration of configuration packages stored in the Taptik cloud. It allows users to browse, filter, and sort available configurations through an intuitive command-line interface.

### Basic Usage

```bash
# List all public configurations
npm run cli -- list

# Filter configurations by title
npm run cli -- list --filter "frontend"
npm run cli -- list --filter "typescript"

# Sort configurations
npm run cli -- list --sort date    # Sort by creation date (default)
npm run cli -- list --sort name    # Sort alphabetically by title

# Limit results
npm run cli -- list --limit 10     # Show 10 results
npm run cli -- list --limit 50     # Show 50 results (max: 100)

# Combine options
npm run cli -- list --filter "react" --sort name --limit 20
```

### Subcommands

#### Liked Configurations

```bash
# List configurations you've liked (requires authentication)
npm run cli -- list liked
npm run cli -- list liked --sort date --limit 10
```

### Command Options

| Option | Description | Default | Example |
|--------|-------------|---------|---------|
| `--filter <query>` | Filter by configuration title | None | `--filter "frontend"` |
| `--sort <field>` | Sort by date or name | `date` | `--sort name` |
| `--limit <n>` | Limit results (1-100) | `20` | `--limit 50` |

### Output Format

The list command displays configurations in a table format:

```
ID       Title                    Created      Size     Access
─────────────────────────────────────────────────────────────
abc12345 Frontend React Setup     2 days ago   2.3MB    Public
def67890 TypeScript Backend       1 week ago   1.8MB    Public
ghi11121 Full Stack Template      3 days ago   4.1MB    Public
```

### Error Handling

The list command provides specific error messages for different scenarios:

- **Network Error**: "Unable to connect to Taptik cloud. Please check your internet connection."
- **Authentication Error**: "Authentication failed. Please run 'taptik login' first."
- **Server Error**: "Taptik cloud is temporarily unavailable. Please try again later."
- **Invalid Options**: Shows help with valid options

### Authentication Requirements

- **Public listings**: No authentication required
- **Liked configurations**: Requires authentication with `taptik login`

## 🏗️ Build Command Deep Dive

### Architecture Overview

The build command follows a modular architecture:

```
BuildCommand (Controller)
├── InteractiveService     # User input and selection
├── CollectionService      # Gather data from file system
├── TransformationService  # Convert to taptik format
├── OutputService          # Generate output files
├── ProgressService        # User feedback and progress
└── ErrorHandlerService    # Error handling and recovery
```

### Build Process Flow

1. **Input Processing**: Parse CLI options and flags
2. **Platform Selection**: Interactive or preset platform choice
3. **Category Selection**: Choose what to build (personal/project/prompts)
4. **Data Collection**: Scan local and global Kiro settings
5. **Data Transformation**: Convert to taptik-compatible format
6. **Output Generation**: Create JSON files and manifest
7. **Completion**: Display summary and cleanup

### Configuration Sources

#### Local Settings (Project-level)

```
.kiro/
├── settings/
│   ├── context.md           # Project context and description
│   ├── user-preferences.md  # User preferences for this project
│   └── project-spec.md      # Project specifications
├── steering/               # Development guidelines
│   ├── git.md              # Git workflow standards
│   ├── typescript.md       # TypeScript conventions
│   └── testing.md          # Testing practices
└── hooks/                  # Automation hooks
    ├── pre-commit.kiro.hook
    └── pre-push.kiro.hook
```

#### Global Settings (User-level)

```
~/.kiro/
├── config/
│   └── user.yaml           # Global user configuration
├── preferences/
│   └── global.md           # Global user preferences
└── prompts/                # Global prompt templates
    ├── code-review.md
    ├── debugging.md
    └── architecture.md
```

## 🔧 CLI Options and Usage Patterns

### Basic Usage Patterns

```bash
# 1. First-time interactive setup
npm run cli -- build

# 2. Development workflow
npm run cli -- build --platform kiro --categories personal,project --verbose

# 3. Quick preview
npm run cli -- build --dry-run

# 4. Production build
npm run cli -- build --platform kiro --output ./dist/taptik-config --quiet

# 5. Specific use case builds
npm run cli -- build --categories personal     # User context only
npm run cli -- build --categories project      # Project context only
npm run cli -- build --categories prompts      # Templates only

# 6. List available configurations
npm run cli -- list                            # List public configurations
npm run cli -- list --filter "frontend"        # Filter by title
npm run cli -- list --sort name --limit 50     # Sort and limit results
npm run cli -- list liked                      # List liked configurations (requires auth)
```

### Advanced Options

#### Dry Run Mode (`--dry-run`)

- Performs all processing steps except file creation
- Shows preview of what would be generated
- Displays estimated file sizes
- Useful for validation and debugging

#### Custom Output Path (`--output <path>`)

- Specify exact output directory
- Can use relative or absolute paths
- Directory will be created if it doesn't exist
- Useful for CI/CD pipelines and automation

#### Platform Preset (`--platform <platform>`)

- Skip interactive platform selection
- Supported values: `kiro`, `cursor`, `claude-code`
- Case-insensitive
- Useful for automation and batch processing

#### Category Filtering (`--categories <list>`)

- Build only specified categories
- Comma-separated list: `personal,project,prompts`
- Maps to internal category names:
  - `personal` → Personal Context
  - `project` → Project Context
  - `prompts` → Prompt Templates

#### Verbose Mode (`--verbose`)

- Shows detailed progress information
- Displays configuration objects
- Useful for debugging and development
- Shows timing information for each step

#### Quiet Mode (`--quiet`)

- Suppresses non-essential output
- Only shows errors and final results
- Useful for automation and scripts
- Opposite of verbose mode

## 🧪 Testing and Development

### Running Tests

```bash
# Unit tests
npm test

# Integration tests
npm run test:cli

# E2E tests
npm run test:e2e

# Coverage report
npm run test:coverage

# Test with UI
npm run test:ui
```

### Development Testing

```bash
# Test CLI health
npm run cli:test

# Test build command help
npm run cli:build-help

# Test build with dry run
npm run cli -- build --dry-run --verbose

# Test with minimal setup
npm run cli -- build --platform kiro --categories personal --dry-run
```

### Debugging Tips

1. **Use Verbose Mode**: Always start with `--verbose` when debugging
2. **Try Dry Run First**: Use `--dry-run` to validate without side effects
3. **Check File Permissions**: Ensure Kiro directories are readable
4. **Validate Input Data**: Check that Kiro files exist and are well-formed
5. **Monitor Memory Usage**: Large projects may require memory optimization

## 📋 Output Format Specification

### Personal Context (`personal-context.json`)

```typescript
interface PersonalContext {
  taptik_version: string;
  context_type: 'personal';
  created_at: string;
  source_platform: string;
  user_info: {
    role: string;
    experience_level: string;
    specializations: string[];
    preferred_languages: string[];
  };
  development_environment: {
    operating_system: string;
    editor: string;
    terminal: string;
    shell: string;
  };
  // ... additional fields
}
```

### Project Context (`project-context.json`)

```typescript
interface ProjectContext {
  taptik_version: string;
  context_type: 'project';
  created_at: string;
  source_platform: string;
  project_info: {
    name: string;
    description: string;
    version: string;
    primary_language: string;
  };
  technical_stack: {
    frameworks: string[];
    databases: string[];
    tools: string[];
  };
  // ... additional fields
}
```

### Prompt Templates (`prompt-templates.json`)

```typescript
interface PromptTemplates {
  taptik_version: string;
  context_type: 'prompt_templates';
  created_at: string;
  source_platform: string;
  templates: Array<{
    id: string;
    name: string;
    description: string;
    category: string;
    content: string;
    variables: string[];
    tags: string[];
  }>;
}
```

### Manifest (`manifest.json`)

```typescript
interface Manifest {
  build_id: string;
  taptik_version: string;
  source_platform: string;
  categories: string[];
  created_at: string;
  source_files: Array<{
    path: string;
    type: string;
    size: number;
    last_modified: string;
  }>;
  output_files: Array<{
    filename: string;
    category: string;
    size: number;
  }>;
  build_metadata: {
    nodejs_version: string;
    platform: string;
    build_duration_ms: number;
    warnings: string[];
    errors: string[];
  };
}
```

## 🚨 Error Handling and Troubleshooting

### Common Issues

#### "Permission Denied" Errors

```bash
# Check file permissions
ls -la .kiro/
ls -la ~/.kiro/

# Fix permissions if needed
chmod -R 755 .kiro/
chmod -R 755 ~/.kiro/
```

#### "No Such File or Directory"

```bash
# Initialize Kiro structure
mkdir -p .kiro/{settings,steering,hooks}
mkdir -p ~/.kiro/{config,preferences,prompts}
```

#### "Invalid Platform" Error

```bash
# Use correct platform names (case-insensitive)
npm run cli -- build --platform kiro     # ✓ Correct
npm run cli -- build --platform Kiro     # ✓ Also correct
npm run cli -- build --platform invalid  # ✗ Error
```

#### "Invalid Category" Error

```bash
# Use correct category names
npm run cli -- build --categories personal,project,prompts  # ✓ Correct
npm run cli -- build --categories personal-context          # ✗ Error
```

### Debug Information

Enable verbose mode to see detailed information:

```bash
npm run cli -- build --verbose
```

This will show:

- CLI options parsing
- Configuration objects
- File system operations
- Transformation steps
- Output generation details
- Timing information

### Getting Help

```bash
# Main CLI help
npm run cli -- --help

# Build command help
npm run cli -- build --help

# Show examples and usage patterns
npm run cli:build-help
```

## 🔄 Integration with Development Workflow

### Git Hooks Integration

Add to your `.git/hooks/pre-commit`:

```bash
#!/bin/bash
# Ensure taptik config is up to date
npm run cli -- build --dry-run --quiet || echo "Warning: taptik build would fail"
```

### CI/CD Pipeline Integration

```yaml
# GitHub Actions example
- name: Generate Taptik Config
  run: |
    npm install
    npm run cli -- build --platform kiro --output ./taptik-config --quiet

- name: Upload Taptik Artifacts
  uses: actions/upload-artifact@v3
  with:
    name: taptik-config
    path: taptik-config/
```

### NPM Scripts Integration

Add to your project's `package.json`:

```json
{
  "scripts": {
    "taptik:build": "npm run cli -- build --platform kiro --quiet",
    "taptik:preview": "npm run cli -- build --dry-run --verbose",
    "precommit": "npm run taptik:preview"
  }
}
```

## 📈 Performance Considerations

### Large Projects

For projects with many files:

- Use `--categories` to build only what you need
- Consider using `--quiet` mode to reduce output overhead
- Monitor memory usage with large Kiro configurations

### Automation

For automated builds:

- Always use `--platform` and `--categories` to avoid interactive prompts
- Use `--quiet` to minimize log output
- Set appropriate timeout values for your CI/CD system
- Consider using `--dry-run` for validation before actual builds

### Troubleshooting Performance

```bash
# Profile build performance
time npm run cli -- build --platform kiro --verbose

# Check memory usage
npm run cli -- build --verbose 2>&1 | grep -i memory

# Test with minimal data
npm run cli -- build --categories personal --dry-run
```
