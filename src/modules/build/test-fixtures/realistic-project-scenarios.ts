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

  globalSettings: {
    sourcePath: 'src/modules/build/test-fixtures/web-app-project',
    collectedAt: new Date().toISOString(),
    securityFiltered: false,
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

  globalSettings: {
    sourcePath: 'src/modules/build/test-fixtures/api-service-project',
    collectedAt: new Date().toISOString(),
    securityFiltered: false,
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
  sourcePath: 'src/modules/build/test-fixtures/api-service-project',
  collectedAt: new Date().toISOString(),
};

// CLI Tool Project Scenario
export const cliToolProjectScenario = {
  localSettings: {
    context: `# Taptik CLI - Cross-Platform Development Tool

This is a comprehensive CLI tool for migrating and synchronizing settings between various AI development platforms.

## Architecture
- Node.js with TypeScript for cross-platform compatibility
- NestJS framework for modular architecture
- Commander.js for CLI argument parsing and command structure
- Inquirer.js for interactive prompts and user input
- File system operations with Node.js fs/promises
- JSON/YAML configuration file handling
- Plugin system for extensible platform support

## Key Features
- Multi-platform settings migration (VS Code, Cursor, Kiro, etc.)
- Interactive configuration wizards
- Dry-run mode for safe testing
- Verbose logging and progress indicators
- Configuration validation and error handling
- Backup and restore functionality
- Plugin architecture for new platform support
- Cross-platform compatibility (Windows, macOS, Linux)

## Development Tools
- TypeScript for type safety and better DX
- ESLint and Prettier for code quality
- Vitest for fast testing with coverage
- Husky for git hooks integration
- Conventional commits for version control
- GitHub Actions for CI/CD pipeline
- Docker for containerized development

## User Experience
- Intuitive command-line interface
- Helpful error messages and suggestions
- Progress bars for long-running operations
- Color-coded output for better readability
- Interactive prompts for user guidance
- Comprehensive documentation and examples
`,

    userPreferences: `# CLI Tool Developer Preferences

## Development Environment
- Editor: VS Code with TypeScript, ESLint, Prettier extensions
- Terminal: iTerm2 with Oh My Zsh and custom aliases
- Node.js version: 20.x LTS with nvm for version management
- Package manager: pnpm for faster, disk-efficient package management
- Git tools: GitLens, Git Graph for enhanced Git workflow
- Testing: Vitest UI for interactive test development

## Code Architecture & Patterns
- Command pattern for CLI operations
- Factory pattern for platform-specific implementations
- Strategy pattern for different migration strategies
- Observer pattern for progress tracking and logging
- Dependency injection with NestJS IoC container
- Repository pattern for configuration storage
- SOLID principles and clean code practices

## Error Handling & Logging
- Structured logging with different verbosity levels
- Graceful error recovery with user-friendly messages
- Input validation with detailed error explanations
- Progress tracking for long-running operations
- Debug mode for detailed troubleshooting
- Error reporting with context preservation

## Testing Philosophy
- Unit tests for all business logic
- Integration tests for CLI commands
- E2E tests for complete workflows
- Mock testing for file system operations
- Snapshot testing for configuration outputs
- Performance testing for large file operations

## CLI Design Principles
- Intuitive command structure and naming
- Consistent help text and documentation
- Progressive disclosure of advanced options
- Default values for common use cases
- Short and long option flags
- Command aliases for convenience
`,

    projectSpec: `# Taptik CLI Tool Specification

## Technical Stack
- **Runtime**: Node.js 20.x LTS with TypeScript 5.x
- **Framework**: NestJS with Commander.js for CLI structure
- **Testing**: Vitest for fast unit and integration tests
- **Linting**: ESLint with TypeScript rules
- **Formatting**: Prettier for consistent code style
- **Documentation**: JSDoc with TypeDoc generation
- **Packaging**: pnpm for dependency management
- **CI/CD**: GitHub Actions with automated testing

## Performance Requirements
- CLI startup time < 2 seconds
- Settings migration < 30 seconds for typical projects
- Memory usage < 100MB for large configurations
- Support for projects with 10,000+ files
- Cross-platform compatibility (Windows, macOS, Linux)

## User Experience Requirements
- Intuitive command-line interface
- Helpful error messages with actionable suggestions
- Progress indicators for long-running operations
- Dry-run mode for safe testing
- Verbose logging for debugging
- Interactive prompts for user guidance
- Color-coded output for better readability

## Security & Reliability
- Input validation and sanitization
- Safe file operations with backup creation
- Error handling with graceful degradation
- Configuration file validation
- Secure handling of sensitive data
- Regular dependency updates and security audits
`,
  },

  globalSettings: {
    sourcePath: 'src/modules/build/test-fixtures/cli-tool-project',
    collectedAt: new Date().toISOString(),
    securityFiltered: false,
  },

  steeringFiles: [
    {
      filename: 'cli-design.md',
      path: '.kiro/steering/cli-design.md',
      content: `---
inclusion: always
priority: high
---

# CLI Design Guidelines

## Command Structure
- Use verb-noun pattern for command names (build, migrate, validate)
- Group related commands under subcommands
- Provide both short (-v) and long (--verbose) option flags
- Use consistent naming conventions across all commands
- Implement command aliases for common operations

## User Interface
- Provide clear, concise help text for all commands
- Use color coding for different types of output (success, error, warning)
- Implement progress bars for long-running operations
- Show meaningful error messages with actionable suggestions
- Use interactive prompts for complex user input

## Error Handling
- Validate all user input before processing
- Provide context-aware error messages
- Implement graceful degradation for non-critical errors
- Log detailed error information for debugging
- Suggest solutions for common error scenarios

## Documentation
- Comprehensive help text for all commands
- Include usage examples and common scenarios
- Document all configuration options
- Provide troubleshooting guides
- Keep documentation in sync with implementation
`,
    },
    {
      filename: 'testing-strategy.md',
      path: '.kiro/steering/testing-strategy.md',
      content: `---
inclusion: always
priority: high
---

# Testing Strategy for CLI Tool

## Test Categories
- Unit tests for all business logic functions
- Integration tests for CLI command workflows
- E2E tests for complete user scenarios
- Performance tests for large file operations
- Cross-platform compatibility tests

## Testing Tools
- Vitest for fast unit and integration testing
- Mock file system operations for isolated testing
- Snapshot testing for configuration outputs
- Coverage reporting with minimum thresholds
- Automated testing in CI/CD pipeline

## Test Data Management
- Use realistic test fixtures for different scenarios
- Mock external dependencies and file system
- Create temporary test environments
- Clean up test artifacts after execution
- Version control test data and fixtures

## Quality Assurance
- Maintain >90% code coverage
- Test error scenarios and edge cases
- Validate cross-platform compatibility
- Performance testing for scalability
- Security testing for input validation
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

# Prettier formatting check
echo "🎨 Checking code formatting..."
npx prettier --check "src/**/*.ts"
if [ $? -ne 0 ]; then
  echo "❌ Code formatting issues found"
  exit 1
fi

# Security audit
echo "🔒 Running security audit..."
npm audit --audit-level high
if [ $? -ne 0 ]; then
  echo "❌ Security vulnerabilities found"
  exit 1
fi

# Unit tests
echo "🧪 Running unit tests..."
npm run test:run
if [ $? -ne 0 ]; then
  echo "❌ Unit tests failed"
  exit 1
fi

# CLI command tests
echo "⚡ Testing CLI commands..."
npm run test:cli
if [ $? -ne 0 ]; then
  echo "❌ CLI tests failed"
  exit 1
fi

# Build verification
echo "🏗️  Verifying build..."
npm run build
if [ $? -ne 0 ]; then
  echo "❌ Build failed"
  exit 1
fi

echo "✅ All pre-commit checks passed!"
`,
    },
  ],
  sourcePath: 'src/modules/build/test-fixtures/cli-tool-project',
  collectedAt: new Date().toISOString(),
};
