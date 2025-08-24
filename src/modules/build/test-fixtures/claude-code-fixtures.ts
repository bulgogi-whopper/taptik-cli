/**
 * Claude Code test fixtures for comprehensive testing
 * Provides mock data for all Claude Code configuration types
 */

import {
  ClaudeCodeSettings,
  ClaudeAgent,
  ClaudeCommand,
  McpServerConfig,
  ClaudeCodeLocalSettingsData,
  ClaudeCodeGlobalSettingsData,
} from '../interfaces/claude-code.interfaces';

// ============================================================================
// Valid Claude Code Settings Fixtures
// ============================================================================

export const validClaudeCodeSettings: ClaudeCodeSettings = {
  theme: 'dark',
  fontSize: 14,
  keyboardShortcuts: {
    'cmd+k': 'openCommandPalette',
    'cmd+shift+p': 'openSettings',
    'cmd+b': 'toggleSidebar',
    'cmd+/': 'toggleComment',
  },
  extensions: ['prettier', 'eslint', 'typescript', 'github-copilot'],
  preferences: {
    autoSave: true,
    autoFormat: true,
    wordWrap: 'on',
    tabSize: 2,
    insertSpaces: true,
    minimap: {
      enabled: true,
      scale: 1,
      showSlider: 'mouseover',
    },
    terminal: {
      fontSize: 12,
      fontFamily: 'Menlo, Monaco, monospace',
      cursorStyle: 'block',
    },
  },
};

export const minimalClaudeCodeSettings: ClaudeCodeSettings = {
  theme: 'light',
};

export const complexClaudeCodeSettings: ClaudeCodeSettings = {
  ...validClaudeCodeSettings,
  preferences: {
    ...validClaudeCodeSettings.preferences,
    advanced: {
      experimentalFeatures: true,
      telemetry: false,
      updateChannel: 'stable',
      proxySettings: {
        http: 'http://proxy.company.com:8080',
        https: 'https://proxy.company.com:8443',
        noProxy: 'localhost,127.0.0.1,.company.internal',
      },
    },
    workbench: {
      colorTheme: 'One Dark Pro',
      iconTheme: 'material-icon-theme',
      productIconTheme: 'fluent-icons',
    },
    editor: {
      suggestSelection: 'first',
      snippetSuggestions: 'top',
      multiCursorModifier: 'alt',
      find: {
        autoFindInSelection: 'multiline',
        seedSearchStringFromSelection: true,
      },
    },
  },
};

// ============================================================================
// Claude Agent Fixtures
// ============================================================================

export const validClaudeAgent: ClaudeAgent = {
  name: 'Code Reviewer',
  description: 'Reviews code for best practices and potential issues',
  instructions: `You are a senior code reviewer. Your task is to:
1. Check for code quality issues
2. Identify potential bugs
3. Suggest performance improvements
4. Ensure consistent coding style
5. Verify test coverage

Be constructive and provide actionable feedback.`,
  tools: ['read', 'write', 'search', 'lint'],
  metadata: {
    version: '1.0.0',
    author: 'team',
    tags: ['review', 'quality', 'testing'],
    requiresAuth: false,
  },
};

export const minimalClaudeAgent: ClaudeAgent = {
  name: 'Simple Helper',
  description: 'A basic helper agent',
  instructions: 'Help with simple tasks',
};

export const complexClaudeAgent: ClaudeAgent = {
  name: 'Full Stack Developer',
  description:
    'Comprehensive development assistant for full-stack applications',
  instructions: `You are an expert full-stack developer with deep knowledge of:

## Frontend
- React, Vue, Angular
- TypeScript
- CSS/SASS/Tailwind
- State management (Redux, MobX, Zustand)
- Build tools (Webpack, Vite, Rollup)

## Backend
- Node.js, Python, Go
- REST and GraphQL APIs
- Database design (SQL and NoSQL)
- Authentication and authorization
- Microservices architecture

## DevOps
- Docker and Kubernetes
- CI/CD pipelines
- Cloud platforms (AWS, GCP, Azure)
- Monitoring and logging
- Infrastructure as Code

## Best Practices
- Clean code principles
- Design patterns
- Testing strategies
- Security best practices
- Performance optimization

Always consider scalability, maintainability, and security in your solutions.`,
  tools: [
    'read',
    'write',
    'edit',
    'search',
    'execute',
    'git',
    'docker',
    'kubernetes',
    'terraform',
    'test',
    'lint',
    'format',
    'debug',
  ],
  metadata: {
    version: '2.1.0',
    author: 'engineering-team',
    tags: ['fullstack', 'devops', 'architecture', 'testing'],
    requiresAuth: true,
    permissions: ['file:write', 'shell:execute', 'network:access'],
    config: {
      maxTokens: 4000,
      temperature: 0.7,
      model: 'claude-3-opus',
    },
  },
};

// ============================================================================
// Claude Command Fixtures
// ============================================================================

export const validClaudeCommand: ClaudeCommand = {
  name: 'format-code',
  description: 'Format code using project formatter',
  command: 'npm run format',
  args: ['--write', '--check'],
  metadata: {
    category: 'development',
    hotkey: 'cmd+shift+f',
  },
};

export const minimalClaudeCommand: ClaudeCommand = {
  name: 'test',
  description: 'Run tests',
  command: 'npm test',
};

export const complexClaudeCommand: ClaudeCommand = {
  name: 'deploy-production',
  description: 'Deploy application to production environment',
  command: './scripts/deploy.sh',
  args: [
    '--environment',
    'production',
    '--version',
    '${VERSION}',
    '--branch',
    '${BRANCH}',
    '--skip-tests',
    '${SKIP_TESTS:-false}',
  ],
  metadata: {
    category: 'deployment',
    requiresConfirmation: true,
    requiresAuth: true,
    permissions: ['deploy:production'],
    variables: {
      VERSION: 'Latest git tag or manual input',
      BRANCH: 'Git branch name',
      SKIP_TESTS: 'Skip test execution (default: false)',
    },
    preChecks: ['git status --porcelain', 'npm run test', 'npm run build'],
    postHooks: ['notify-slack', 'update-changelog'],
  },
};

// ============================================================================
// MCP Configuration Fixtures
// ============================================================================

export const validMcpConfig: McpServerConfig = {
  mcpServers: {
    filesystem: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem'],
      env: {
        MCP_PROJECT_ROOT: '/Users/developer/projects',
      },
    },
    github: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github'],
      env: {
        GITHUB_TOKEN: '${GITHUB_TOKEN}',
      },
      autoApprove: ['repo:read', 'user:read'],
    },
    database: {
      command: 'python',
      args: ['/opt/mcp-servers/database-server.py'],
      env: {
        DATABASE_URL: 'postgresql://localhost:5432/myapp',
      },
      disabled: false,
    },
  },
};

export const minimalMcpConfig: McpServerConfig = {
  mcpServers: {
    basic: {
      command: 'node',
      args: ['server.js'],
    },
  },
};

export const disabledMcpConfig: McpServerConfig = {
  mcpServers: {
    disabled_server: {
      command: 'npx',
      args: ['@example/server'],
      disabled: true,
    },
  },
};

// ============================================================================
// Steering Files Content Fixtures
// ============================================================================

export const steeringFiles = {
  principle: `# Development Principles

## Code Quality
- Write clean, maintainable code
- Follow SOLID principles
- Implement comprehensive testing
- Document complex logic

## Architecture
- Favor composition over inheritance
- Keep modules loosely coupled
- Design for scalability
- Consider performance implications

## Collaboration
- Write clear commit messages
- Review code thoroughly
- Share knowledge actively
- Communicate design decisions`,

  persona: `# Assistant Persona

You are an experienced software engineer with expertise in:
- Full-stack development
- System architecture
- DevOps practices
- Agile methodologies

Your communication style is:
- Clear and concise
- Professional but friendly
- Solution-oriented
- Educational when appropriate`,

  context: `# Project Context

This is a next-generation AI development platform that enables:
- Seamless IDE configuration sharing
- Cloud-based settings management
- Community collaboration
- Multi-IDE support

Technology stack:
- TypeScript/Node.js
- NestJS framework
- Supabase backend
- Jest/Vitest testing`,

  workflow: `# Development Workflow

1. **Planning**
   - Review requirements
   - Design solution
   - Break down tasks

2. **Implementation**
   - Write tests first (TDD)
   - Implement features
   - Refactor as needed

3. **Validation**
   - Run tests
   - Perform code review
   - Update documentation

4. **Deployment**
   - Create pull request
   - Pass CI/CD checks
   - Deploy to staging
   - Promote to production`,
};

// ============================================================================
// CLAUDE.md and CLAUDE.local.md Fixtures
// ============================================================================

export const claudeMdContent = `# CLAUDE.md

This file provides instructions for Claude AI assistants working with this codebase.

## Project Overview

This is a TypeScript application built with NestJS that provides IDE configuration management.

## Key Principles

1. **Type Safety**: Always use TypeScript types and interfaces
2. **Testing**: Write tests for all new functionality
3. **Error Handling**: Implement comprehensive error handling
4. **Documentation**: Document complex logic and APIs

## Code Style

- Use async/await for asynchronous operations
- Prefer functional programming patterns
- Follow NestJS best practices
- Use dependency injection

## Development Guidelines

### When adding new features:
1. Start with tests (TDD)
2. Create interfaces first
3. Implement services
4. Add controllers/commands
5. Update documentation

### When fixing bugs:
1. Write a failing test that reproduces the bug
2. Fix the bug
3. Ensure all tests pass
4. Add regression tests

## Security Considerations

- Never commit sensitive data
- Sanitize all user inputs
- Use environment variables for configuration
- Implement proper authentication

## Performance Guidelines

- Optimize database queries
- Implement caching where appropriate
- Use lazy loading for large datasets
- Monitor memory usage`;

export const claudeLocalMdContent = `# CLAUDE.local.md

Local development instructions and personal preferences.

## Local Setup

\`\`\`bash
npm install
cp .env.example .env.local
# Configure your local environment variables
npm run start:dev
\`\`\`

## Personal Preferences

- Prefer explicit types over inference
- Use descriptive variable names
- Comment complex algorithms
- Break large functions into smaller ones

## Local Testing

Run tests with coverage:
\`\`\`bash
npm run test:coverage
\`\`\`

## Debugging Tips

1. Use VS Code debugger with breakpoints
2. Enable source maps in tsconfig
3. Use console.log strategically
4. Check logs in .logs/ directory

## Common Issues

### Issue: TypeScript compilation errors
Solution: Run \`npm run typecheck\` to see detailed errors

### Issue: Test failures
Solution: Run tests in watch mode with \`npm run test:watch\`

### Issue: Import errors
Solution: Check path aliases in tsconfig.json`;

// ============================================================================
// Complete Local Settings Data Fixture
// ============================================================================

export const completeClaudeCodeLocalSettings: ClaudeCodeLocalSettingsData = {
  settings: validClaudeCodeSettings,
  claudeMd: claudeMdContent,
  claudeLocalMd: claudeLocalMdContent,
  steeringFiles: [
    {
      filename: 'principle.md',
      content: steeringFiles.principle,
      path: '.claude/steering/principle.md',
    },
    {
      filename: 'persona.md',
      content: steeringFiles.persona,
      path: '.claude/steering/persona.md',
    },
    {
      filename: 'context.md',
      content: steeringFiles.context,
      path: '.claude/steering/context.md',
    },
    {
      filename: 'workflow.md',
      content: steeringFiles.workflow,
      path: '.claude/steering/workflow.md',
    },
  ],
  agents: [
    {
      filename: 'code-reviewer.json',
      content: JSON.stringify(validClaudeAgent, null, 2),
      path: '.claude/agents/code-reviewer.json',
      parsed: validClaudeAgent,
    },
    {
      filename: 'fullstack-dev.json',
      content: JSON.stringify(complexClaudeAgent, null, 2),
      path: '.claude/agents/fullstack-dev.json',
      parsed: complexClaudeAgent,
    },
  ],
  commands: [
    {
      filename: 'format-code.json',
      content: JSON.stringify(validClaudeCommand, null, 2),
      path: '.claude/commands/format-code.json',
      parsed: validClaudeCommand,
    },
    {
      filename: 'deploy.json',
      content: JSON.stringify(complexClaudeCommand, null, 2),
      path: '.claude/commands/deploy.json',
      parsed: complexClaudeCommand,
    },
  ],
  hooks: [
    {
      filename: 'pre-commit.sh',
      content: '#!/bin/bash\nnpm run lint && npm run test',
      path: '.claude/hooks/pre-commit.sh',
    },
    {
      filename: 'post-deploy.js',
      content: 'console.log("Deployment completed successfully");',
      path: '.claude/hooks/post-deploy.js',
    },
  ],
  mcpConfig: validMcpConfig,
  sourcePath: '/Users/developer/projects/myapp',
  collectedAt: new Date().toISOString(),
};

// ============================================================================
// Complete Global Settings Data Fixture
// ============================================================================

export const completeClaudeCodeGlobalSettings: ClaudeCodeGlobalSettingsData = {
  settings: minimalClaudeCodeSettings,
  agents: [
    {
      filename: 'global-helper.json',
      content: JSON.stringify(minimalClaudeAgent, null, 2),
      path: '~/.claude/agents/global-helper.json',
      parsed: minimalClaudeAgent,
    },
  ],
  commands: [
    {
      filename: 'global-test.json',
      content: JSON.stringify(minimalClaudeCommand, null, 2),
      path: '~/.claude/commands/global-test.json',
      parsed: minimalClaudeCommand,
    },
  ],
  mcpConfig: minimalMcpConfig,
  sourcePath: '~/.claude',
  collectedAt: new Date().toISOString(),
  securityFiltered: true,
};

// ============================================================================
// Edge Case Fixtures
// ============================================================================

export const emptyClaudeCodeLocalSettings: ClaudeCodeLocalSettingsData = {
  steeringFiles: [],
  agents: [],
  commands: [],
  hooks: [],
  sourcePath: '/Users/developer/empty-project',
  collectedAt: new Date().toISOString(),
};

export const partialClaudeCodeLocalSettings: ClaudeCodeLocalSettingsData = {
  settings: minimalClaudeCodeSettings,
  steeringFiles: [],
  agents: [
    {
      filename: 'helper.json',
      content: JSON.stringify(minimalClaudeAgent, null, 2),
      path: '.claude/agents/helper.json',
      parsed: minimalClaudeAgent,
    },
  ],
  commands: [],
  hooks: [],
  sourcePath: '/Users/developer/partial-project',
  collectedAt: new Date().toISOString(),
};
