/**
 * Realistic project scenarios for comprehensive testing
 */

// Web Application Project Scenario
export const webAppProjectScenario = {
  localSettings: {
    context: `# E-Commerce Platform - Frontend

This is a modern React-based e-commerce platform with TypeScript and Next.js.

## Architecture
- Next.js 14 with App Router
- React 18 with TypeScript
- TailwindCSS for styling
- Zustand for state management
- React Query for server state
- Prisma with PostgreSQL database

## Key Features
- Product catalog with search and filtering
- Shopping cart with persistent state
- User authentication and profiles
- Payment processing with Stripe
- Admin dashboard for inventory management
- Real-time order tracking
- Responsive design for mobile and desktop

## Current Sprint Goals
- Implement product recommendation engine
- Add multi-currency support
- Optimize Core Web Vitals performance
- Enhance accessibility (WCAG 2.1 AA)
`,

    userPreferences: `# Senior Frontend Developer Preferences

## Development Environment
- Editor: VS Code with extensions (ES7 React snippets, Tailwind IntelliSense, Prisma)
- Terminal: Warp with oh-my-zsh
- Node.js version: 20.x LTS
- Package manager: pnpm (for monorepo efficiency)
- Browser: Chrome DevTools with React DevTools
- Design tools: Figma for design handoffs

## Code Style & Architecture
- TypeScript strict mode always enabled
- Prefer functional components with hooks
- Use custom hooks for complex logic
- Follow compound component pattern for reusable UI
- Implement error boundaries for robust UX
- Use React.memo() for performance optimization
- Prefer server components over client components when possible

## Testing Strategy
- Unit tests with Jest and React Testing Library
- E2E tests with Playwright
- Visual regression tests with Chromatic
- Performance testing with Lighthouse CI
- Accessibility testing with axe-core

## Deployment & DevOps
- Vercel for hosting with preview deployments
- GitHub Actions for CI/CD
- Sentry for error monitoring
- PostHog for analytics and feature flags
`,

    projectSpec: `# E-Commerce Frontend Specification

## Technical Requirements
- **Framework**: Next.js 14+ with TypeScript 5.x
- **Styling**: TailwindCSS with custom design system
- **State Management**: Zustand for client state, React Query for server state
- **Database**: Prisma ORM with PostgreSQL
- **Authentication**: NextAuth.js with multiple providers
- **Payments**: Stripe integration with webhook handling
- **Image Handling**: Next.js Image component with Cloudinary CDN
- **SEO**: Dynamic metadata generation and structured data

## Performance Goals
- First Contentful Paint < 1.5s
- Largest Contentful Paint < 2.5s
- Cumulative Layout Shift < 0.1
- Time to Interactive < 3.5s
- Core Web Vitals passing on 90% of page loads

## Browser Support
- Chrome 90+, Firefox 90+, Safari 14+
- Mobile: iOS Safari 14+, Chrome Mobile 90+
- Progressive Web App capabilities

## Security Requirements
- Content Security Policy implementation
- HTTPS only with HSTS headers
- Input validation and XSS protection
- Rate limiting on API endpoints
- Secure cookie handling
`,
  },

  steeringFiles: [
    {
      filename: 'react-patterns.md',
      path: '.kiro/steering/react-patterns.md',
      content: `---
inclusion: always
priority: high
---

# React Development Patterns

## Component Architecture
- Use compound components for complex UI patterns
- Implement render props for flexible component composition
- Leverage React.forwardRef for ref forwarding in reusable components
- Use React.memo with custom comparison functions for optimization

## State Management Guidelines
- Local state for component-specific data (useState, useReducer)
- Zustand stores for global client state
- React Query for server state and caching
- Context API only for truly global, rarely-changing data

## Error Handling
- Error boundaries at route and feature levels
- Graceful degradation for non-critical failures
- User-friendly error messages with actionable advice
- Automatic error reporting to Sentry with user context

## Performance Optimization
- Code splitting at route and feature levels
- Lazy loading for non-critical components
- Image optimization with Next.js Image component
- Implement virtual scrolling for large lists
- Use React.startTransition for non-urgent updates
`,
    },
    {
      filename: 'nextjs-conventions.md',
      path: '.kiro/steering/nextjs-conventions.md',
      content: `---
inclusion: always
priority: high
---

# Next.js Conventions & Best Practices

## File Structure
- Use App Router with co-located components
- Group related files in feature folders
- Separate client and server components clearly
- Use meaningful file naming: kebab-case for pages, PascalCase for components

## Data Fetching
- Prefer server components for static data
- Use Suspense boundaries for loading states
- Implement proper error.tsx for error handling
- Cache API responses appropriately with revalidation

## SEO & Metadata
- Generate dynamic metadata for each page
- Implement proper Open Graph and Twitter cards
- Use structured data for rich snippets
- Optimize Core Web Vitals with built-in tools

## Deployment
- Use environment variables for configuration
- Implement proper build-time and runtime environment handling
- Configure proper caching headers
- Monitor performance with Analytics and Core Web Vitals
`,
    },
    {
      filename: 'testing-standards.md',
      path: '.kiro/steering/testing-standards.md',
      content: `---
inclusion: always
priority: medium
---

# Testing Standards & Practices

## Unit Testing with React Testing Library
- Test behavior, not implementation details
- Use semantic queries (getByRole, getByLabelText)
- Mock external dependencies at module boundaries
- Test error states and edge cases

## Integration Testing
- Test complete user workflows
- Use MSW for API mocking
- Test form submissions and validations
- Verify state management integration

## E2E Testing with Playwright
- Cover critical user journeys
- Test on multiple browsers and devices
- Include accessibility testing
- Verify performance benchmarks

## Test Data Management
- Use factories for consistent test data
- Clean up test data after each test
- Mock external services (payments, analytics)
- Test with various user permission levels
`,
    },
  ],

  hookFiles: [
    {
      filename: 'pre-commit.kiro.hook',
      path: '.kiro/hooks/pre-commit.kiro.hook',
      content: `#!/bin/bash
# Pre-commit hook for React/Next.js project

echo "🔍 Running pre-commit checks..."

# Check for TypeScript errors
echo "📝 Checking TypeScript..."
npx tsc --noEmit
if [ $? -ne 0 ]; then
  echo "❌ TypeScript errors found. Please fix before committing."
  exit 1
fi

# Run ESLint
echo "🔧 Running ESLint..."
npx eslint . --ext .ts,.tsx --max-warnings 0
if [ $? -ne 0 ]; then
  echo "❌ ESLint errors found. Please fix before committing."
  exit 1
fi

# Check for missing dependencies
echo "📦 Checking dependencies..."
npx depcheck --skip-missing
if [ $? -ne 0 ]; then
  echo "⚠️  Dependency issues found. Please review."
fi

# Run tests
echo "🧪 Running unit tests..."
npm run test:coverage -- --watchAll=false --passWithNoTests
if [ $? -ne 0 ]; then
  echo "❌ Tests failed. Please fix before committing."
  exit 1
fi

# Check bundle size
echo "📊 Analyzing bundle size..."
npx next build --debug
if [ $? -ne 0 ]; then
  echo "❌ Build failed. Please fix before committing."
  exit 1
fi

echo "✅ All pre-commit checks passed!"
`,
    },
    {
      filename: 'pre-push.kiro.hook',
      path: '.kiro/hooks/pre-push.kiro.hook',
      content: `#!/bin/bash
# Pre-push hook for comprehensive testing

echo "🚀 Running pre-push checks..."

# Run E2E tests
echo "🎭 Running Playwright tests..."
npx playwright test --reporter=line
if [ $? -ne 0 ]; then
  echo "❌ E2E tests failed. Please fix before pushing."
  exit 1
fi

# Check accessibility
echo "♿ Running accessibility tests..."
npx @axe-core/cli http://localhost:3000 --include "main" --exit
if [ $? -ne 0 ]; then
  echo "⚠️  Accessibility issues found. Please review."
fi

# Performance audit
echo "⚡ Running Lighthouse audit..."
npx lighthouse-ci autorun
if [ $? -ne 0 ]; then
  echo "⚠️  Performance issues detected. Please review."
fi

echo "✅ All pre-push checks completed!"
`,
    },
  ],
};

// API Service Project Scenario
export const apiServiceProjectScenario = {
  localSettings: {
    context: `# Payment Processing API - Backend Service

This is a mission-critical payment processing API built with Node.js, Express, and TypeScript.

## Architecture
- Express.js with TypeScript
- Prisma ORM with PostgreSQL
- Redis for caching and session storage
- Bull Queue for background job processing
- Jest for testing with 90%+ coverage
- Docker containerization with multi-stage builds

## Key Features
- PCI DSS compliant payment processing
- Multi-currency support with real-time exchange rates
- Webhook handling for payment providers (Stripe, PayPal, Square)
- Comprehensive audit logging and monitoring
- Rate limiting and DDoS protection
- Circuit breaker pattern for external service calls
- Database connection pooling and query optimization

## Security Measures
- JWT-based authentication with refresh tokens
- Role-based access control (RBAC)
- API key management with rotation
- Input validation with Joi schemas
- SQL injection prevention with parameterized queries
- Encryption of sensitive data at rest
- Regular security audits and penetration testing

## Compliance & Monitoring
- PCI DSS Level 1 compliance
- SOC 2 Type II certification
- GDPR compliance for EU customers
- Comprehensive logging with structured formats
- Real-time monitoring with Prometheus and Grafana
- Error tracking with Sentry
- Performance monitoring with APM tools
`,

    userPreferences: `# Senior Backend Developer Preferences

## Development Environment
- Editor: VS Code with REST Client, Thunder Client, Prisma extensions
- Terminal: iTerm2 with tmux for session management  
- Node.js version: 20.x LTS with nvm for version management
- Package manager: npm with exact versions for security
- Database tools: TablePlus, pgAdmin for PostgreSQL management
- API testing: Postman, Insomnia for API development and testing

## Code Architecture & Patterns
- Clean Architecture with dependency injection
- Repository pattern for data access abstraction
- Service layer for business logic encapsulation
- Factory pattern for creating complex objects
- Strategy pattern for different payment providers
- Observer pattern for event-driven architecture
- SOLID principles strictly followed

## Error Handling & Logging
- Structured logging with Winston
- Error codes with meaningful messages
- Graceful degradation for external service failures  
- Comprehensive error monitoring and alerting
- Request correlation IDs for distributed tracing
- Rate limiting with meaningful error responses

## Testing Philosophy
- Test-driven development (TDD) approach
- Unit tests with >90% code coverage
- Integration tests for API endpoints
- Contract testing with external services
- Load testing for performance validation
- Security testing for vulnerability assessment

## Database & Performance
- Database migrations with version control
- Query optimization with EXPLAIN ANALYZE
- Connection pooling with pgbouncer
- Read replicas for scaling read operations
- Database indexing strategy optimization
- Background job processing with Bull Queue
`,

    projectSpec: `# Payment Processing API Specification

## Technical Stack
- **Runtime**: Node.js 20.x LTS with TypeScript 5.x
- **Framework**: Express.js with Helmet.js for security
- **Database**: PostgreSQL 15+ with Prisma ORM
- **Cache**: Redis 7+ for session storage and caching
- **Queue**: Bull Queue with Redis for background jobs
- **Monitoring**: Prometheus metrics with Grafana dashboards
- **Logging**: Winston with structured JSON logging
- **Documentation**: OpenAPI 3.0 with Swagger UI

## Performance Requirements
- API response time < 200ms for 95th percentile
- Support 10,000+ concurrent connections
- 99.9% uptime SLA with max 8.76 hours downtime/year
- Database queries < 50ms average response time
- Background job processing < 5 minutes for non-critical tasks
- Payment processing < 3 seconds end-to-end

## Security Requirements
- PCI DSS Level 1 compliance mandatory
- TLS 1.3 minimum for all communications
- API rate limiting: 1000 req/min per client
- JWT tokens with 15-minute expiration
- Refresh token rotation on each use
- Input validation and sanitization on all endpoints
- SQL injection prevention with parameterized queries
- Regular vulnerability scans and penetration testing

## Compliance & Audit
- SOC 2 Type II compliance
- GDPR compliance for EU data
- Audit trail for all financial transactions
- Data retention policies (7 years for financial data)
- Encrypted data at rest (AES-256)
- Secure key management with rotation
- Regular compliance audits and reporting
`,
  },

  steeringFiles: [
    {
      filename: 'api-design.md',
      path: '.kiro/steering/api-design.md',
      content: `---
inclusion: always
priority: high
---

# API Design Guidelines

## RESTful Design Principles
- Use HTTP methods semantically (GET, POST, PUT, PATCH, DELETE)
- Resource-based URLs with consistent naming conventions
- Use plural nouns for resource endpoints
- Implement proper HTTP status codes
- Version APIs using header-based versioning (Accept: application/vnd.api.v1+json)

## Request/Response Standards
- Use JSON for request and response bodies
- Implement consistent error response format
- Include request correlation IDs in all responses
- Use pagination for list endpoints (cursor-based for large datasets)
- Implement partial response support with field selection

## Authentication & Authorization
- Use JWT tokens with short expiration times
- Implement refresh token rotation
- Role-based access control (RBAC) for different user types
- API key authentication for service-to-service communication
- Rate limiting per client with different tiers

## Documentation
- OpenAPI 3.0 specification for all endpoints
- Include example requests and responses
- Document error scenarios and status codes
- Provide SDK and integration examples
- Keep documentation in sync with implementation
`,
    },
    {
      filename: 'database-patterns.md',
      path: '.kiro/steering/database-patterns.md',
      content: `---
inclusion: always
priority: high
---

# Database Design & Query Patterns

## Schema Design
- Use UUID primary keys for external references
- Implement soft deletes for audit trail
- Create appropriate indexes for query patterns
- Use foreign key constraints for data integrity
- Implement database-level validation where possible

## Query Optimization
- Use EXPLAIN ANALYZE for query performance analysis
- Implement connection pooling with appropriate sizing
- Use read replicas for scaling read operations
- Batch operations for bulk data processing
- Implement query result caching for expensive operations

## Migration Strategy
- Version-controlled database migrations
- Use transactions for atomic schema changes
- Test migrations on production-like data
- Implement rollback procedures for failed migrations
- Document breaking changes and upgrade paths

## Data Security
- Encrypt sensitive data at column level
- Use row-level security for multi-tenant data
- Implement audit logging for data changes
- Regular database backups with encryption
- Access control with minimal necessary privileges
`,
    },
  ],

  hookFiles: [
    {
      filename: 'pre-commit.kiro.hook',
      path: '.kiro/hooks/pre-commit.kiro.hook',
      content: `#!/bin/bash
# Pre-commit hook for API service

echo "🔍 Running API service pre-commit checks..."

# TypeScript compilation
echo "📝 Checking TypeScript compilation..."
npx tsc --noEmit
if [ $? -ne 0 ]; then
  echo "❌ TypeScript errors found"
  exit 1
fi

# ESLint for code quality
echo "🔧 Running ESLint..."
npx eslint src --ext .ts --max-warnings 0
if [ $? -ne 0 ]; then
  echo "❌ ESLint errors found"
  exit 1
fi

# Security audit
echo "🔒 Running security audit..."
npm audit --audit-level high
if [ $? -ne 0 ]; then
  echo "❌ Security vulnerabilities found"
  exit 1
fi

# Database migration check
echo "🗄️  Checking database migrations..."
npx prisma migrate diff --from-migrations ./prisma/migrations --to-schema-datamodel ./prisma/schema.prisma
if [ $? -ne 0 ]; then
  echo "⚠️  Database schema changes detected. Consider creating migration."
fi

# Unit tests with coverage
echo "🧪 Running unit tests with coverage..."
npm run test:coverage -- --passWithNoTests
if [ $? -ne 0 ]; then
  echo "❌ Tests failed"
  exit 1
fi

echo "✅ All pre-commit checks passed!"
`,
    },
  ],
};

// CLI Tool Project Scenario  
export const cliToolProjectScenario = {
  localSettings: {
    context: `# Developer Productivity CLI Tool

A powerful command-line tool for automating development workflows and project management tasks.

## Architecture
- Node.js CLI with TypeScript
- Commander.js for command parsing and routing
- Inquirer.js for interactive prompts
- Chalk for colorized terminal output
- Ora for loading spinners and progress indicators
- Configstore for persistent configuration management

## Key Features
- Project scaffolding with multiple templates
- Git workflow automation (branch management, PR creation)
- Package dependency analysis and updates
- Code quality checks and formatting automation
- Database migration and seeding utilities
- Environment management across different stages
- Integration with popular development tools (Docker, Kubernetes, AWS)

## Command Categories
- `init` - Project initialization and scaffolding
- `dev` - Development workflow commands
- `deploy` - Deployment and infrastructure commands  
- `db` - Database management commands
- `config` - Configuration management
- `health` - System health and diagnostics

## Distribution
- NPM package with global installation
- Homebrew formula for macOS users
- Self-contained executables for Windows/Linux
- Auto-update mechanism with semantic versioning
`,

    userPreferences: `# CLI Tool Developer Preferences  

## Development Philosophy
- Focus on developer experience and ergonomics
- Provide helpful error messages with actionable guidance
- Follow UNIX philosophy: do one thing well
- Progressive disclosure of complexity
- Fail fast with clear error reporting
- Extensive help documentation and examples

## User Interface Design
- Colorized output for better readability
- Interactive prompts for complex operations
- Progress indicators for long-running tasks
- Consistent command structure and naming
- Support for both interactive and non-interactive modes
- Comprehensive help system with examples

## Configuration & Extensibility
- Sensible defaults with override capabilities
- Plugin architecture for extensibility
- Configuration file support (JSON, YAML)
- Environment variable configuration
- Per-project and global configuration scopes
- Configuration validation and error reporting

## Testing & Quality
- Unit tests for all command logic
- Integration tests for file system operations  
- Snapshot testing for CLI output
- Cross-platform testing (Windows, macOS, Linux)
- Performance testing for large projects
- User acceptance testing with real workflows
`,

    projectSpec: `# CLI Tool Technical Specification

## Core Technologies
- **Runtime**: Node.js 18+ for modern JavaScript features
- **Language**: TypeScript with strict mode
- **CLI Framework**: Commander.js for command parsing
- **Prompts**: Inquirer.js for interactive user input
- **Output**: Chalk for colors, Ora for spinners
- **Config**: Configstore for persistent settings
- **File System**: fs-extra for enhanced file operations
- **HTTP**: Axios for API requests with retry logic

## Command Structure
```
tool-name <command> [subcommand] [options] [arguments]

Examples:
  tool-name init react-app my-project
  tool-name dev start --watch --port 3000
  tool-name deploy production --dry-run
  tool-name db migrate --up --environment staging
```

## Configuration Management
- Global config: `~/.tool-name/config.json`
- Project config: `./tool-name.config.js` or `package.json`
- Environment variables: `TOOL_NAME_*` prefix
- Command-line flags override all other sources
- Configuration validation with helpful error messages

## Error Handling & Logging
- Structured error codes for programmatic handling
- Detailed error messages with suggestions
- Debug logging with different verbosity levels
- Crash reporting with user consent
- Graceful handling of network failures
- Rollback capabilities for destructive operations

## Performance Requirements
- Command startup time < 500ms
- File operations progress indication
- Async operations with proper cancellation
- Memory efficient for large projects
- Disk space cleanup for temporary files
`,
  },

  steeringFiles: [
    {
      filename: 'cli-ux.md', 
      path: '.kiro/steering/cli-ux.md',
      content: `---
inclusion: always
priority: high
---

# CLI User Experience Guidelines

## Command Design Principles
- Commands should be self-documenting through clear naming
- Use consistent verb-noun pattern: \`tool action resource\`
- Provide both short and long option forms (-v, --verbose)
- Support dry-run mode for destructive operations
- Include confirmation prompts for irreversible actions

## Output & Feedback
- Use colors meaningfully (red for errors, green for success, yellow for warnings)
- Show progress for operations taking >2 seconds
- Provide structured output options (JSON, table, plain text)
- Include timestamps for log-style output
- Support quiet mode for scripting

## Error Handling
- Show error messages in human-readable format
- Include error codes for programmatic handling
- Provide suggestions for common mistakes
- Link to documentation for complex errors
- Never fail silently - always provide feedback

## Help & Documentation
- Every command must have help documentation
- Include practical examples in help text
- Show available options and their defaults
- Group related options logically
- Provide man pages for complex commands
`,
    },
    {
      filename: 'node-patterns.md',
      path: '.kiro/steering/node-patterns.md', 
      content: `---
inclusion: always
priority: medium
---

# Node.js CLI Development Patterns

## Command Structure
- Use Commander.js for consistent command parsing
- Implement command classes for complex operations
- Separate business logic from CLI concerns
- Use dependency injection for testability
- Handle process signals gracefully (SIGINT, SIGTERM)

## File System Operations
- Use fs-extra for enhanced file operations
- Implement proper error handling for file operations
- Create temporary directories for safe operations
- Clean up temporary files on exit
- Handle permission errors gracefully

## Configuration Management
- Support multiple configuration sources (file, env, CLI)
- Implement configuration validation
- Provide configuration migration paths
- Use JSON Schema for configuration validation
- Store sensitive data securely (keychain integration)

## Testing Strategies
- Mock file system operations for unit tests
- Use temporary directories for integration tests
- Test cross-platform compatibility
- Snapshot test CLI output formatting
- Test error scenarios and edge cases
`,
    },
  ],

  hookFiles: [
    {
      filename: 'pre-commit.kiro.hook',
      path: '.kiro/hooks/pre-commit.kiro.hook', 
      content: `#!/bin/bash
# Pre-commit hook for CLI tool

echo "🔍 Running CLI tool pre-commit checks..."

# TypeScript compilation
echo "📝 Checking TypeScript..."
npx tsc --noEmit
if [ $? -ne 0 ]; then
  echo "❌ TypeScript compilation failed"
  exit 1
fi

# Linting
echo "🔧 Running ESLint..."
npx eslint src --ext .ts --max-warnings 0
if [ $? -ne 0 ]; then
  echo "❌ Linting failed"  
  exit 1
fi

# Unit tests
echo "🧪 Running unit tests..."
npm test -- --passWithNoTests
if [ $? -ne 0 ]; then
  echo "❌ Unit tests failed"
  exit 1
fi

# CLI integration tests
echo "🖥️  Running CLI integration tests..."
npm run test:cli
if [ $? -ne 0 ]; then
  echo "❌ CLI integration tests failed"
  exit 1
fi

# Check package.json for required fields
echo "📦 Validating package.json..."
node -e "
const pkg = require('./package.json');
if (!pkg.bin) throw new Error('Missing bin field in package.json');
if (!pkg.engines?.node) throw new Error('Missing engines.node in package.json');
"
if [ $? -ne 0 ]; then
  echo "❌ package.json validation failed"
  exit 1
fi

echo "✅ All pre-commit checks passed!"
`,
    },
  ],
};

// Edge Cases and Error Scenarios
export const edgeCaseScenarios = {
  emptyProject: {
    localSettings: {
      context: `# Minimal Project Setup

This is a minimal project with basic configuration only.

## Status
- Just initialized
- No major features implemented yet
- Placeholder content for testing
`,
      userPreferences: `# Basic Preferences

## Environment
- Editor: Any text editor
- Runtime: Node.js latest
`,
      projectSpec: `# Minimal Spec

## Goal
Test empty/minimal project handling.
`,
    },
    steeringFiles: [],
    hookFiles: [],
  },

  corruptedFiles: {
    localSettings: {
      context: `# Project with Corrupted Data

This project contains intentionally malformed data for testing error handling.

## Notes
- Some configuration files may be corrupted
- Testing parser resilience  
- Should gracefully handle invalid data
`,
      userPreferences: `# Preferences

This file contains some invalid markdown and malformed content:

<<< INVALID YAML >>>
invalid: [unclosed bracket
malformed: {no closing brace
unquoted: string without quotes
`,
      projectSpec: null, // Will cause null reference
    },
    steeringFiles: [
      {
        filename: 'invalid.md',
        path: '.kiro/steering/invalid.md',
        content: `---
invalid yaml frontmatter:
  - unclosed array
  broken: {object
---

# Invalid Content

This contains intentionally broken content:
- Invalid JSON: {"key": value}
- Unclosed brackets: [1, 2, 3
- Invalid references: ${UNDEFINED_VARIABLE}
`,
      },
    ],
    hookFiles: [
      {
        filename: 'broken.kiro.hook',
        path: '.kiro/hooks/broken.kiro.hook',
        content: `#!/bin/bash
# This hook contains syntax errors for testing

echo "Testing error handling"
invalid_command_that_does_not_exist
syntax error here
`,
      },
    ],
  },

  largeProject: {
    localSettings: {
      context: `# Enterprise Monorepo

This is a large-scale enterprise monorepo with multiple services and applications.

## Scale
- 50+ microservices
- 200+ developers
- 1000+ npm packages
- Multi-region deployment
- 24/7 operations

## Architecture  
- Microservices with event-driven communication
- Kubernetes orchestration
- Multi-cloud deployment (AWS, Azure, GCP)
- Comprehensive CI/CD pipelines
- Automated security scanning and compliance
- Performance monitoring and alerting

${'## Services\n' + Array.from({length: 50}, (_, i) => 
  `- Service ${i+1}: ${['User Management', 'Payment Processing', 'Inventory Management', 'Notification Service', 'Analytics Engine', 'File Storage', 'Search Service', 'Authentication', 'Logging Service', 'Monitoring'][i % 10]}`
).join('\n')}
`,
      userPreferences: `# Enterprise Development Preferences

## Team Structure
- Platform Engineering team
- Application Development teams  
- DevOps and Infrastructure teams
- Quality Assurance teams
- Security and Compliance teams

## Development Standards
${Array.from({length: 20}, (_, i) => 
  `- Standard ${i+1}: Detailed requirement for enterprise development`
).join('\n')}

## Tooling Requirements
${Array.from({length: 15}, (_, i) => 
  `- Tool ${i+1}: Enterprise-grade tooling requirement`  
).join('\n')}
`,
      projectSpec: `# Enterprise Project Specification

## Compliance Requirements
- SOC 2 Type II certification
- PCI DSS compliance  
- GDPR compliance
- HIPAA compliance where applicable
- ISO 27001 certification

## Performance Requirements  
${Array.from({length: 25}, (_, i) => 
  `- Requirement ${i+1}: Enterprise performance standard`
).join('\n')}
`,
    },
    steeringFiles: Array.from({length: 30}, (_, i) => ({
      filename: `standard-${i+1}.md`,
      path: `.kiro/steering/standard-${i+1}.md`,
      content: `---
inclusion: always
priority: ${['high', 'medium', 'low'][i % 3]}
team: ${['platform', 'backend', 'frontend', 'devops', 'security'][i % 5]}
---

# Enterprise Standard ${i+1}

## Overview
This is enterprise standard #${i+1} for large-scale development.

## Requirements
${Array.from({length: 10}, (_, j) => `- Requirement ${j+1} for standard ${i+1}`).join('\n')}

## Implementation
${Array.from({length: 5}, (_, k) => `Step ${k+1}: Implementation detail for standard ${i+1}`).join('\n')}
`,
    })),
    hookFiles: Array.from({length: 15}, (_, i) => ({
      filename: `${['pre-commit', 'pre-push', 'post-commit', 'post-merge', 'pre-rebase'][i % 5]}-${Math.floor(i/5)+1}.kiro.hook`,
      path: `.kiro/hooks/${['pre-commit', 'pre-push', 'post-commit', 'post-merge', 'pre-rebase'][i % 5]}-${Math.floor(i/5)+1}.kiro.hook`,
      content: `#!/bin/bash
# Enterprise hook ${i+1}

echo "Running enterprise hook ${i+1}..."

# Multiple validation steps
${Array.from({length: 8}, (_, j) => `echo "Step ${j+1}: Enterprise validation"`).join('\n')}

echo "Hook ${i+1} completed successfully"
`,
    })),
  },
};