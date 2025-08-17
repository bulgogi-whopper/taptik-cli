/**
 * Mock Kiro configuration data for testing
 * 
 * @deprecated Use realistic-project-scenarios.ts for comprehensive testing
 * This file is kept for backward compatibility with existing tests
 */

export const mockKiroLocalSettings = {
  context: `# Project Context

This is a Taptik CLI application built with NestJS.

## Architecture
- Command-based CLI using nest-commander
- Modular service architecture
- TypeScript with strict mode enabled

## Key Features
- Build command for converting Kiro settings to taptik format
- Interactive user selection interface
- Progress reporting and error handling
`,

  userPreferences: `# User Preferences

## Development Environment
- Editor: VS Code
- Terminal: iTerm2
- Node.js version: 18.x
- Package manager: npm

## Code Style
- Use TypeScript strict mode
- Prefer async/await over promises
- Use dependency injection pattern
- Follow NestJS conventions
`,

  projectSpec: `# Project Specification

## Purpose
Convert Kiro configuration files to taptik-compatible format for use with various AI development tools.

## Target Platforms
- Kiro (primary source)
- Cursor (planned)
- Claude Code (planned)

## Output Format
- JSON files following taptik specification
- Manifest file with build metadata
- Timestamped output directories
`,

  steeringFiles: [
    {
      filename: 'git.md',
      path: '.kiro/steering/git.md',
      content: `---
inclusion: always
---

# Git Commit Standards

All commits must use gitmoji followed by English description.

## Essential Gitmoji Reference
- 🎉 Project initialization
- ✨ New features  
- 🐛 Bug fixes
- 📝 Documentation
- 🎨 Code structure/formatting
- ⚡ Performance improvements
- ✅ Tests
- 🔧 Configuration
`,
    },
    {
      filename: 'typescript.md',
      path: '.kiro/steering/typescript.md',
      content: `---
inclusion: always
---

# TypeScript Standards

## General Rules
- Use strict mode
- Prefer interfaces over types
- Use explicit return types for functions
- Avoid any type unless absolutely necessary

## Naming Conventions
- PascalCase for classes and interfaces
- camelCase for variables and functions
- UPPER_SNAKE_CASE for constants
`,
    },
  ],

  hookFiles: [
    {
      filename: 'commit.kiro.hook',
      path: '.kiro/hooks/commit.kiro.hook',
      content: `#!/bin/bash
# Validate commit message format
# Ensures gitmoji is used and message is under 50 characters

commit_msg="$1"

if [[ ! "$commit_msg" =~ ^[[:space:]]*[[:emoji:]][[:space:]] ]]; then
  echo "Error: Commit message must start with gitmoji"
  exit 1
fi

if [[ "#commit_msg" -gt 50 ]]; then
  echo "Warning: Commit message exceeds 50 characters"
fi
`,
    },
  ],
};

export const mockKiroGlobalSettings = {
  userConfig: `# Global Kiro Configuration

## User Information
name: "Test User"
email: "test@example.com"

## Default Preferences
default_editor: "code"
auto_save: true
theme: "dark"

## AI Provider Settings
# Note: API keys should be in environment variables
default_ai_provider: "anthropic"
max_context_tokens: 100000
`,

  globalPreferences: `# Global User Preferences

## Workflow Preferences
- Start with project analysis
- Use incremental commits
- Always write tests for new features
- Document public APIs

## Communication Style
- Be concise and direct
- Focus on problem-solving
- Explain technical decisions
- Provide examples when helpful

## Development Standards
- Follow established patterns in codebase
- Prioritize code readability
- Use meaningful variable names
- Write self-documenting code
`,

  promptTemplates: [
    {
      filename: 'code-review.md',
      path: '~/.kiro/prompts/code-review.md',
      content: `# Code Review Template

Review the following code changes and provide feedback on:

1. **Code Quality**: Check for readability, maintainability, and best practices
2. **Testing**: Ensure adequate test coverage
3. **Performance**: Identify potential performance issues
4. **Security**: Look for security vulnerabilities
5. **Documentation**: Verify API documentation is updated

## Change Summary
{CHANGE_SUMMARY}

## Files Changed
{FILES_CHANGED}

Please provide specific, actionable feedback.
`,
    },
    {
      filename: 'bug-investigation.md',
      path: '~/.kiro/prompts/bug-investigation.md',
      content: `# Bug Investigation Template

Help investigate and resolve this issue:

## Problem Description
{BUG_DESCRIPTION}

## Expected Behavior
{EXPECTED_BEHAVIOR}

## Actual Behavior
{ACTUAL_BEHAVIOR}

## Steps to Reproduce
{REPRODUCTION_STEPS}

## Environment
{ENVIRONMENT_INFO}

Please analyze the issue and suggest debugging steps and potential solutions.
`,
    },
  ],

  configFiles: [
    {
      filename: '.kirorc',
      path: '~/.kiro/.kirorc',
      content: `{
  "version": "1.0.0",
  "plugins": ["typescript", "nestjs", "git-hooks"],
  "integrations": {
    "vscode": true,
    "github": true
  }
}`,
    },
  ],
};

export const mockBuildConfig = {
  platform: 'Kiro' as const,
  categories: [
    { name: 'personal-context' as const, enabled: true },
    { name: 'project-context' as const, enabled: true },
    { name: 'prompt-templates' as const, enabled: true },
  ],
  outputDirectory: './taptik-build-test',
  timestamp: '2024-01-15T10:30:00.000Z',
  buildId: 'test-build-12345',
};

export const mockSettingsData = {
  localSettings: {
    contextMd: mockKiroLocalSettings.context,
    userPreferencesMd: mockKiroLocalSettings.userPreferences,
    projectSpecMd: mockKiroLocalSettings.projectSpec,
    steeringFiles: mockKiroLocalSettings.steeringFiles,
    hooks: mockKiroLocalSettings.hookFiles.map(file => ({
      ...file,
      type: file.filename.split('.')[0],
    })),
  },
  globalSettings: {
    userConfig: mockKiroGlobalSettings.userConfig,
    preferences: mockKiroGlobalSettings.globalPreferences,
    globalPrompts: mockKiroGlobalSettings.promptTemplates,
  },
  collectionMetadata: {
    sourcePlatform: 'Kiro' as const,
    collectionTimestamp: '2024-01-15T10:25:00.000Z',
    projectPath: '/test/project/path',
    globalPath: '/test/home/.kiro',
    warnings: [],
    errors: [],
  },
};

export const mockExpectedOutputs = {
  personalContext: {
    taptik_version: '1.0.0',
    context_type: 'personal',
    created_at: '2024-01-15T10:30:00.000Z',
    source_platform: 'Kiro',
    user_preferences: {
      development_environment: {
        editor: 'VS Code',
        terminal: 'iTerm2',
        nodejs_version: '18.x',
        package_manager: 'npm',
      },
      code_style: {
        typescript_strict: true,
        async_pattern: 'async/await',
        architecture_pattern: 'dependency_injection',
        framework_conventions: 'NestJS',
      },
    },
    workflow_preferences: {
      analysis_first: true,
      incremental_commits: true,
      test_driven: true,
      documentation_required: true,
    },
    communication_style: {
      tone: 'concise_direct',
      focus: 'problem_solving',
      explanation_level: 'technical_with_examples',
    },
  },

  projectContext: {
    taptik_version: '1.0.0',
    context_type: 'project',
    created_at: '2024-01-15T10:30:00.000Z',
    source_platform: 'Kiro',
    project_info: {
      name: 'Taptik CLI',
      description: 'Command-based CLI using nest-commander with modular service architecture',
      architecture: 'NestJS with TypeScript strict mode',
      key_features: [
        'Build command for converting Kiro settings',
        'Interactive user selection interface',
        'Progress reporting and error handling',
      ],
    },
    steering_rules: [
      {
        category: 'git',
        rules: {
          commit_format: 'gitmoji + English description',
          essential_gitmoji: {
            init: '🎉',
            feature: '✨',
            bugfix: '🐛',
            docs: '📝',
            style: '🎨',
            performance: '⚡',
            tests: '✅',
            config: '🔧',
          },
        },
      },
      {
        category: 'typescript',
        rules: {
          strict_mode: true,
          prefer_interfaces: true,
          explicit_returns: true,
          avoid_any: true,
          naming_conventions: {
            classes: 'PascalCase',
            variables: 'camelCase',
            constants: 'UPPER_SNAKE_CASE',
          },
        },
      },
    ],
    hooks: [
      {
        name: 'commit',
        type: 'pre-commit',
        description: 'Validate commit message format',
      },
    ],
  },

  promptTemplates: {
    taptik_version: '1.0.0',
    context_type: 'prompt_templates',
    created_at: '2024-01-15T10:30:00.000Z',
    source_platform: 'Kiro',
    templates: [
      {
        name: 'code-review',
        category: 'development',
        description: 'Template for conducting code reviews',
        variables: ['CHANGE_SUMMARY', 'FILES_CHANGED'],
        template: 'Review the following code changes and provide feedback on:',
      },
      {
        name: 'bug-investigation',
        category: 'debugging',
        description: 'Template for investigating and resolving bugs',
        variables: ['BUG_DESCRIPTION', 'EXPECTED_BEHAVIOR', 'ACTUAL_BEHAVIOR', 'REPRODUCTION_STEPS', 'ENVIRONMENT_INFO'],
        template: 'Help investigate and resolve this issue:',
      },
    ],
  },
};