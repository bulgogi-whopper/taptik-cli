/**
 * Comprehensive taptik output validation fixtures
 * These fixtures provide expected output data that fully complies with the taptik specification
 */

import { 
  TaptikPersonalContext, 
  TaptikProjectContext, 
  TaptikPromptTemplates,
  TaptikManifest 
} from '../interfaces/taptik-format.interface';

// Web Application Personal Context Output
export const webAppPersonalContextOutput: TaptikPersonalContext = {
  taptik_version: '1.0.0',
  context_type: 'personal',
  created_at: '2024-01-15T10:30:00.000Z',
  source_platform: 'Kiro',
  user_info: {
    role: 'Senior Frontend Developer',
    experience_level: 'senior',
    specializations: ['React', 'Next.js', 'TypeScript', 'Performance Optimization'],
    preferred_languages: ['TypeScript', 'JavaScript'],
    timezone: 'America/New_York',
  },
  development_environment: {
    operating_system: 'macOS',
    editor: 'VS Code',
    terminal: 'Warp',
    shell: 'zsh',
    package_manager: 'pnpm',
    version_control: 'git',
  },
  tools_and_extensions: {
    editor_extensions: [
      'ES7+ React/Redux/React-Native snippets',
      'Tailwind CSS IntelliSense', 
      'Prisma',
      'GitLens',
      'Auto Rename Tag',
      'Prettier',
      'ESLint'
    ],
    development_tools: [
      'React DevTools',
      'Chrome DevTools',
      'Figma',
      'Postman',
      'TablePlus'
    ],
    productivity_tools: [
      'Raycast',
      'CleanMyMac',
      'Notion',
      'Linear'
    ],
  },
  coding_preferences: {
    indentation: {
      type: 'spaces',
      size: 2,
    },
    line_endings: 'LF',
    max_line_length: 100,
    trailing_commas: true,
    semicolons: true,
    quote_style: 'single',
    bracket_spacing: true,
  },
  workflow_preferences: {
    commit_frequency: 'frequent_small_commits',
    branch_strategy: 'feature_branches',
    code_review_approach: 'thorough_reviews',
    testing_approach: 'test_driven_development',
    documentation_level: 'comprehensive',
  },
  ai_interaction_preferences: {
    communication_style: 'concise_technical',
    detail_level: 'high_detail_with_examples',
    code_explanation_preference: 'explain_complex_logic',
    error_handling_approach: 'provide_multiple_solutions',
    learning_style: 'hands_on_with_theory',
  },
};

// API Service Personal Context Output  
export const apiServicePersonalContextOutput: TaptikPersonalContext = {
  taptik_version: '1.0.0',
  context_type: 'personal', 
  created_at: '2024-01-15T10:30:00.000Z',
  source_platform: 'Kiro',
  user_info: {
    role: 'Senior Backend Developer',
    experience_level: 'senior',
    specializations: ['Node.js', 'PostgreSQL', 'Microservices', 'Payment Processing'],
    preferred_languages: ['TypeScript', 'SQL', 'Bash'],
    timezone: 'UTC',
  },
  development_environment: {
    operating_system: 'Ubuntu 22.04 LTS',
    editor: 'VS Code',
    terminal: 'iTerm2',
    shell: 'bash',
    package_manager: 'npm',
    version_control: 'git',
  },
  tools_and_extensions: {
    editor_extensions: [
      'REST Client',
      'Thunder Client',
      'Prisma',
      'PostgreSQL',
      'Docker',
      'GitLens'
    ],
    development_tools: [
      'TablePlus',
      'pgAdmin',
      'Postman',
      'Insomnia',
      'Docker Desktop',
      'Kubernetes Dashboard'
    ],
    monitoring_tools: [
      'Grafana',
      'Prometheus',
      'Sentry',
      'DataDog'
    ],
  },
  coding_preferences: {
    indentation: {
      type: 'spaces',
      size: 2,
    },
    line_endings: 'LF',
    max_line_length: 120,
    trailing_commas: true,
    semicolons: true,
    quote_style: 'single',
    bracket_spacing: true,
  },
  workflow_preferences: {
    commit_frequency: 'logical_commits',
    branch_strategy: 'git_flow',
    code_review_approach: 'security_focused_reviews',
    testing_approach: 'test_driven_development',
    documentation_level: 'api_documentation_focused',
  },
  ai_interaction_preferences: {
    communication_style: 'technical_precise',
    detail_level: 'architecture_focused',
    code_explanation_preference: 'explain_design_patterns',
    error_handling_approach: 'security_first_solutions',
    learning_style: 'best_practices_focused',
  },
};

// Web Application Project Context Output
export const webAppProjectContextOutput: TaptikProjectContext = {
  taptik_version: '1.0.0',
  context_type: 'project',
  created_at: '2024-01-15T10:30:00.000Z',
  source_platform: 'Kiro',
  project_info: {
    name: 'E-Commerce Platform Frontend',
    description: 'Modern React-based e-commerce platform with TypeScript and Next.js',
    version: '2.1.0',
    repository_url: 'https://github.com/company/ecommerce-frontend',
    documentation_url: 'https://docs.company.com/ecommerce-frontend',
    primary_language: 'TypeScript',
    project_type: 'web_application',
  },
  technical_stack: {
    primary_language: 'TypeScript',
    frameworks: [
      'Next.js 14',
      'React 18',
      'TailwindCSS',
      'Zustand',
      'React Query',
      'Prisma'
    ],
    databases: [
      'PostgreSQL 15'
    ],
    tools: [
      'Webpack',
      'ESBuild',
      'Prettier',
      'ESLint',
      'Jest',
      'Playwright',
      'Chromatic'
    ],
    deployment: [
      'Vercel',
      'GitHub Actions',
      'Sentry',
      'PostHog'
    ],
  },
  architecture_patterns: [
    {
      pattern: 'Component-Based Architecture',
      description: 'Modular React components with clear separation of concerns',
      implementation_details: [
        'Compound components for complex UI patterns',
        'Custom hooks for business logic',
        'Context API for global state when needed',
        'Render props for flexible component composition'
      ],
    },
    {
      pattern: 'Server-Side Rendering',
      description: 'Next.js App Router with server and client components',
      implementation_details: [
        'Server components for static data',
        'Client components for interactive features',
        'Streaming with Suspense boundaries',
        'Progressive enhancement approach'
      ],
    },
    {
      pattern: 'State Management',
      description: 'Multi-layered state management strategy',
      implementation_details: [
        'Zustand for global client state',
        'React Query for server state',
        'Local component state for UI state',
        'URL state for shareable application state'
      ],
    },
  ],
  development_guidelines: {
    coding_standards: [
      'TypeScript strict mode enabled',
      'ESLint with custom rules for React/Next.js',
      'Prettier for consistent formatting',
      'Husky for git hooks',
      'Conventional commits for changelog generation'
    ],
    testing_requirements: [
      'Unit tests with Jest and React Testing Library',
      'Integration tests for user workflows',
      'E2E tests with Playwright for critical paths',
      'Visual regression tests with Chromatic',
      'Accessibility testing with axe-core'
    ],
    documentation_standards: [
      'TSDoc for public APIs',
      'Storybook for component documentation',
      'README files for setup instructions',
      'ADRs for architectural decisions',
      'API documentation with OpenAPI'
    ],
    performance_requirements: [
      'Core Web Vitals passing scores',
      'First Contentful Paint < 1.5s',
      'Time to Interactive < 3.5s',
      'Bundle size monitoring',
      'Lighthouse CI in deployment pipeline'
    ],
  },
  environment_configuration: {
    development: {
      node_version: '20.x',
      package_manager: 'pnpm',
      database_url: 'postgresql://localhost:5432/ecommerce_dev',
      api_base_url: 'http://localhost:4000/api',
      enable_debugging: true,
    },
    staging: {
      node_version: '20.x',
      package_manager: 'pnpm', 
      database_url: 'postgresql://staging-db.company.com:5432/ecommerce_staging',
      api_base_url: 'https://api-staging.company.com/api',
      enable_debugging: false,
    },
    production: {
      node_version: '20.x',
      package_manager: 'pnpm',
      database_url: 'postgresql://prod-db.company.com:5432/ecommerce_prod',
      api_base_url: 'https://api.company.com/api',
      enable_debugging: false,
    },
  },
  team_preferences: {
    communication_channels: [
      'Slack for daily communication',
      'GitHub Discussions for technical discussions',
      'Linear for issue tracking',
      'Notion for documentation'
    ],
    meeting_schedule: [
      'Daily standups at 9:00 AM EST',
      'Sprint planning bi-weekly',
      'Code review sessions weekly',
      'Architecture review monthly'
    ],
    workflow_practices: [
      'Feature branches with pull requests',
      'Code review required before merge',
      'Automated testing in CI/CD',
      'Regular dependency updates',
      'Security audits quarterly'
    ],
  },
  deployment_info: {
    environments: [
      {
        name: 'development',
        url: 'http://localhost:3000',
        auto_deploy: true,
        branch: 'main',
      },
      {
        name: 'staging', 
        url: 'https://staging.company.com',
        auto_deploy: true,
        branch: 'main',
      },
      {
        name: 'production',
        url: 'https://company.com',
        auto_deploy: false,
        branch: 'main',
      },
    ],
    deployment_strategy: 'blue_green',
    rollback_strategy: 'automatic_on_health_check_failure',
    monitoring: [
      'Sentry for error tracking',
      'PostHog for analytics',
      'Vercel Analytics for performance',
      'GitHub Actions for deployment status'
    ],
  },
};

// API Service Project Context Output
export const apiServiceProjectContextOutput: TaptikProjectContext = {
  taptik_version: '1.0.0',
  context_type: 'project',
  created_at: '2024-01-15T10:30:00.000Z',
  source_platform: 'Kiro',
  project_info: {
    name: 'Payment Processing API',
    description: 'Mission-critical payment processing API built with Node.js, Express, and TypeScript',
    version: '3.2.1',
    repository_url: 'https://github.com/company/payment-api',
    documentation_url: 'https://api-docs.company.com/payment-api',
    primary_language: 'TypeScript',
    project_type: 'api_service',
  },
  technical_stack: {
    primary_language: 'TypeScript',
    frameworks: [
      'Express.js 4.18',
      'Prisma 5.x',
      'Bull Queue 4.x',
      'Winston 3.x',
      'Helmet.js',
      'express-rate-limit'
    ],
    databases: [
      'PostgreSQL 15',
      'Redis 7'
    ],
    tools: [
      'Jest',
      'Supertest',
      'ESLint',
      'Prettier',
      'Husky',
      'Docker',
      'Kubernetes'
    ],
    deployment: [
      'AWS EKS',
      'GitHub Actions',
      'Terraform',
      'Prometheus',
      'Grafana',
      'Sentry'
    ],
  },
  architecture_patterns: [
    {
      pattern: 'Clean Architecture',
      description: 'Layered architecture with dependency inversion',
      implementation_details: [
        'Controllers handle HTTP requests/responses',
        'Services contain business logic',
        'Repositories abstract data access',
        'Entities represent business objects',
        'Use cases orchestrate business workflows'
      ],
    },
    {
      pattern: 'Event-Driven Architecture',
      description: 'Asynchronous event processing for scalability',
      implementation_details: [
        'Event sourcing for payment transactions',
        'CQRS for read/write separation',
        'Message queues for async processing',
        'Event store for audit trail',
        'Saga pattern for distributed transactions'
      ],
    },
    {
      pattern: 'Microservices',
      description: 'Service-oriented architecture with bounded contexts',
      implementation_details: [
        'Payment processing service',
        'User management service',
        'Notification service',
        'Audit logging service',
        'API Gateway for routing'
      ],
    },
  ],
  development_guidelines: {
    coding_standards: [
      'TypeScript strict mode mandatory',
      'ESLint with security-focused rules',
      'Prettier with 120 character line limit',
      'SOLID principles enforcement',
      'Comprehensive error handling'
    ],
    testing_requirements: [
      'Unit tests with >90% coverage',
      'Integration tests for API endpoints',
      'Contract tests for external services',
      'Load tests for performance validation',
      'Security tests for vulnerability assessment'
    ],
    documentation_standards: [
      'OpenAPI 3.0 specification',
      'TSDoc for all public APIs',
      'Architecture decision records (ADRs)',
      'Runbook documentation',
      'API integration guides'
    ],
    performance_requirements: [
      'API response time <200ms (95th percentile)',
      '10,000+ concurrent connections support',
      '99.9% uptime SLA',
      'Database queries <50ms average',
      'Background jobs <5 minutes processing'
    ],
  },
  security_requirements: {
    compliance_standards: [
      'PCI DSS Level 1',
      'SOC 2 Type II',
      'GDPR compliance',
      'ISO 27001 certification'
    ],
    authentication: [
      'JWT tokens with 15-minute expiration',
      'Refresh token rotation',
      'Multi-factor authentication',
      'API key management with rotation'
    ],
    encryption: [
      'TLS 1.3 for all communications',
      'AES-256 encryption at rest',
      'Field-level encryption for PII',
      'Secure key management with HSM'
    ],
    monitoring: [
      'Real-time security monitoring',
      'Intrusion detection system',
      'Regular vulnerability scans',
      'Penetration testing quarterly'
    ],
  },
  environment_configuration: {
    development: {
      node_version: '20.x',
      database_url: 'postgresql://localhost:5432/payments_dev',
      redis_url: 'redis://localhost:6379/0',
      log_level: 'debug',
      rate_limit: 10_000,
    },
    staging: {
      node_version: '20.x',
      database_url: 'postgresql://staging-db:5432/payments_staging',
      redis_url: 'redis://staging-redis:6379/0',
      log_level: 'info',
      rate_limit: 5000,
    },
    production: {
      node_version: '20.x',
      database_url: 'postgresql://prod-cluster:5432/payments_prod',
      redis_url: 'redis://prod-redis-cluster:6379/0',
      log_level: 'warn',
      rate_limit: 1000,
    },
  },
  team_preferences: {
    communication_channels: [
      'Slack with dedicated security channel',
      'PagerDuty for critical alerts',
      'Confluence for documentation',
      'Jira for issue tracking'
    ],
    meeting_schedule: [
      'Daily standups at 10:00 AM UTC',
      'Sprint planning bi-weekly',
      'Security review weekly',
      'Architecture review monthly',
      'Incident postmortem as needed'
    ],
    workflow_practices: [
      'GitFlow with release branches',
      'Mandatory code review by 2 developers',
      'Security review for critical changes',
      'Blue-green deployment strategy',
      'Automated rollback on failure'
    ],
  },
  deployment_info: {
    environments: [
      {
        name: 'development',
        url: 'http://localhost:3000',
        auto_deploy: true,
        branch: 'develop',
      },
      {
        name: 'staging',
        url: 'https://api-staging.company.com',
        auto_deploy: true,
        branch: 'main',
      },
      {
        name: 'production',
        url: 'https://api.company.com',
        auto_deploy: false,
        branch: 'main',
      },
    ],
    deployment_strategy: 'blue_green',
    rollback_strategy: 'automated_health_check_failure',
    monitoring: [
      'Prometheus metrics collection',
      'Grafana dashboards',
      'Sentry error tracking',
      'PagerDuty alerting',
      'AWS CloudWatch logs'
    ],
  },
};

// Comprehensive Prompt Templates Output
export const comprehensivePromptTemplatesOutput: TaptikPromptTemplates = {
  taptik_version: '1.0.0',
  context_type: 'prompt_templates',
  created_at: '2024-01-15T10:30:00.000Z',
  source_platform: 'Kiro',
  templates: [
    {
      id: 'code-review-comprehensive',
      name: 'Comprehensive Code Review',
      description: 'Detailed code review template covering quality, security, performance, and maintainability',
      category: 'development',
      content: `# Comprehensive Code Review

Please review the following code changes with focus on:

## 1. Code Quality & Best Practices
- **Readability**: Is the code easy to understand and self-documenting?
- **Maintainability**: Will this code be easy to modify and extend?
- **Consistency**: Does it follow established patterns and conventions?
- **DRY Principle**: Are there any code duplications that should be extracted?

## 2. Security Analysis
- **Input Validation**: Are all inputs properly validated and sanitized?
- **Authentication/Authorization**: Are security controls correctly implemented?
- **Data Exposure**: Is sensitive information properly protected?
- **Injection Vulnerabilities**: SQL injection, XSS, CSRF protections in place?

## 3. Performance Considerations
- **Algorithm Efficiency**: Are algorithms optimal for the use case?
- **Memory Usage**: Any potential memory leaks or excessive allocations?
- **Database Queries**: N+1 queries, proper indexing, query optimization?
- **Caching Strategy**: Appropriate caching mechanisms implemented?

## 4. Testing Coverage
- **Unit Tests**: Are critical paths covered by unit tests?
- **Integration Tests**: Are component interactions properly tested?
- **Edge Cases**: Are error scenarios and boundary conditions tested?
- **Test Quality**: Are tests clear, maintainable, and comprehensive?

## 5. Documentation & Communication
- **API Documentation**: Are public interfaces properly documented?
- **Code Comments**: Complex logic explained with helpful comments?
- **Commit Messages**: Clear, descriptive commit messages following conventions?
- **Breaking Changes**: Any breaking changes properly communicated?

## Change Summary
{CHANGE_SUMMARY}

## Modified Files
{FILES_CHANGED}

## Specific Areas of Concern
{SPECIFIC_CONCERNS}

Please provide specific, actionable feedback with examples where possible.`,
      variables: [
        'CHANGE_SUMMARY',
        'FILES_CHANGED', 
        'SPECIFIC_CONCERNS'
      ],
      tags: [
        'code-review',
        'quality-assurance',
        'security',
        'performance',
        'comprehensive'
      ],
    },
    {
      id: 'bug-investigation-systematic',
      name: 'Systematic Bug Investigation',
      description: 'Structured approach to bug investigation and resolution',
      category: 'debugging',
      content: `# Systematic Bug Investigation & Resolution

Let's systematically investigate and resolve this issue:

## 1. Problem Analysis
**Issue Description**: {BUG_DESCRIPTION}
**Expected Behavior**: {EXPECTED_BEHAVIOR}  
**Actual Behavior**: {ACTUAL_BEHAVIOR}
**Impact Level**: {IMPACT_LEVEL}

## 2. Reproduction Information
**Steps to Reproduce**: 
{REPRODUCTION_STEPS}

**Environment Details**:
- Environment: {ENVIRONMENT}
- Browser/Platform: {PLATFORM}
- Version: {VERSION}
- User Type: {USER_TYPE}

## 3. Investigation Approach
Please help me:

### 3.1 Immediate Analysis
- Identify the most likely root cause based on symptoms
- Determine if this is a regression or existing issue
- Assess the scope of impact (single user, multiple users, specific conditions)

### 3.2 Debugging Strategy
- Suggest specific logging/debugging steps
- Identify key files and functions to examine
- Recommend tools for investigation (debugger, profiler, network tools)

### 3.3 Data Collection
- What additional information would be helpful?
- Are there specific error logs, metrics, or user data to examine?
- Should we enable additional debugging/tracing?

## 4. Solution Development
Based on investigation findings:

### 4.1 Root Cause Analysis
- What is the underlying cause of the issue?
- Why did this problem occur (code change, environment, data)?
- Are there similar issues that might also be affected?

### 4.2 Solution Options
- Provide multiple solution approaches (quick fix vs comprehensive fix)
- Include pros/cons of each approach
- Estimate complexity and risk for each option

### 4.3 Testing Strategy
- How should the fix be tested?
- What regression tests are needed?
- Are there specific edge cases to validate?

## 5. Prevention & Monitoring
- How can we prevent similar issues in the future?
- What monitoring/alerting should be added?
- Are there process improvements needed?

## Additional Context
{ADDITIONAL_CONTEXT}

Please provide a systematic analysis and actionable recommendations.`,
      variables: [
        'BUG_DESCRIPTION',
        'EXPECTED_BEHAVIOR',
        'ACTUAL_BEHAVIOR', 
        'IMPACT_LEVEL',
        'REPRODUCTION_STEPS',
        'ENVIRONMENT',
        'PLATFORM',
        'VERSION',
        'USER_TYPE',
        'ADDITIONAL_CONTEXT'
      ],
      tags: [
        'debugging',
        'systematic-approach',
        'root-cause-analysis',
        'problem-solving'
      ],
    },
    {
      id: 'architecture-design-review',
      name: 'Architecture Design Review',
      description: 'Template for reviewing architectural decisions and system design',
      category: 'architecture',
      content: `# Architecture Design Review

Please review this architectural design with focus on scalability, maintainability, and best practices:

## 1. System Overview
**System/Component**: {SYSTEM_NAME}
**Purpose**: {SYSTEM_PURPOSE}
**Scale Requirements**: {SCALE_REQUIREMENTS}
**Performance Goals**: {PERFORMANCE_GOALS}

## 2. Current Architecture
{CURRENT_ARCHITECTURE}

## 3. Proposed Changes
{PROPOSED_CHANGES}

## 4. Review Areas

### 4.1 Scalability & Performance
- Will this architecture handle the expected load?
- Are there potential bottlenecks in the design?
- How will it scale horizontally and vertically?
- What are the performance implications of design decisions?

### 4.2 Reliability & Resilience
- Single points of failure and mitigation strategies?
- Error handling and fallback mechanisms?
- Disaster recovery and backup strategies?
- Circuit breaker and timeout patterns implemented?

### 4.3 Security & Compliance
- Authentication and authorization architecture?
- Data encryption and privacy considerations?
- API security and rate limiting strategies?
- Compliance requirements addressed (GDPR, PCI DSS, etc.)?

### 4.4 Maintainability & Extensibility
- Is the architecture easy to understand and modify?
- How well does it separate concerns?
- How easy is it to add new features or modify existing ones?
- Documentation and knowledge transfer considerations?

### 4.5 Technology Choices
- Are technology choices appropriate for the use case?
- Vendor lock-in considerations and mitigation strategies?
- Team expertise and learning curve factors?
- Long-term support and maintenance considerations?

### 4.6 Operational Considerations
- Monitoring and observability strategies?
- Deployment and rollback procedures?
- Configuration management approach?
- Cost optimization opportunities?

## 5. Alternative Approaches
Please suggest alternative architectural approaches and compare:
- Trade-offs of different approaches
- When each approach would be most suitable
- Migration paths if changes are needed later

## 6. Implementation Roadmap
- Suggested phases for implementation
- Risk mitigation strategies for each phase
- Success metrics and validation approaches

{ADDITIONAL_REQUIREMENTS}

Please provide detailed feedback with specific recommendations and rationale.`,
      variables: [
        'SYSTEM_NAME',
        'SYSTEM_PURPOSE', 
        'SCALE_REQUIREMENTS',
        'PERFORMANCE_GOALS',
        'CURRENT_ARCHITECTURE',
        'PROPOSED_CHANGES',
        'ADDITIONAL_REQUIREMENTS'
      ],
      tags: [
        'architecture',
        'design-review',
        'scalability',
        'system-design',
        'best-practices'
      ],
    },
    {
      id: 'performance-optimization',
      name: 'Performance Optimization Analysis',
      description: 'Comprehensive performance analysis and optimization recommendations',
      category: 'performance',
      content: `# Performance Optimization Analysis

Let's analyze and optimize the performance of this system:

## 1. Performance Context
**Component/System**: {COMPONENT_NAME}
**Current Performance Issues**: {PERFORMANCE_ISSUES}
**Performance Goals**: {PERFORMANCE_GOALS}
**User Impact**: {USER_IMPACT}

## 2. Current Metrics
**Response Times**: {RESPONSE_TIMES}
**Throughput**: {THROUGHPUT}
**Resource Utilization**: {RESOURCE_UTILIZATION}
**Error Rates**: {ERROR_RATES}

## 3. Analysis Areas

### 3.1 Frontend Performance (if applicable)
- **Bundle Size Analysis**: Identify large dependencies and unused code
- **Loading Performance**: Critical rendering path optimization
- **Runtime Performance**: JavaScript execution optimization
- **Core Web Vitals**: LCP, FID, CLS optimization opportunities

### 3.2 Backend Performance
- **API Response Times**: Slow endpoints and optimization opportunities
- **Database Performance**: Query optimization, indexing strategies
- **Memory Usage**: Memory leaks, garbage collection optimization
- **CPU Utilization**: Algorithmic improvements, caching strategies

### 3.3 Database Optimization
- **Query Performance**: EXPLAIN ANALYZE results and optimization
- **Index Strategy**: Missing indexes, unused indexes cleanup  
- **Connection Pooling**: Pool size and configuration optimization
- **Data Model**: Normalization vs denormalization trade-offs

### 3.4 Caching Strategy
- **Current Caching**: What's currently cached and cache hit rates
- **Cache Opportunities**: Additional caching possibilities
- **Cache Invalidation**: Strategies for keeping cache fresh
- **CDN Usage**: Static asset optimization and global distribution

### 3.5 Infrastructure & Scaling
- **Resource Constraints**: CPU, memory, I/O bottlenecks
- **Auto-scaling**: Horizontal scaling opportunities
- **Load Balancing**: Distribution and routing optimization
- **Infrastructure Costs**: Cost-effective scaling strategies

## 4. Optimization Recommendations

### 4.1 Quick Wins (Low effort, high impact)
Please identify immediate optimization opportunities that can be implemented quickly:

### 4.2 Medium-term Improvements (Moderate effort, significant impact)
Suggest architectural or code improvements that require more effort:

### 4.3 Long-term Strategic Changes (High effort, transformational impact)
Recommend major changes for long-term performance gains:

## 5. Implementation Plan
- **Priority Ranking**: Order optimizations by impact vs effort
- **Success Metrics**: How to measure improvement
- **Testing Strategy**: Load testing and performance validation
- **Rollback Plan**: How to safely deploy and rollback changes

## 6. Monitoring & Alerting
- **Performance Metrics**: Key metrics to monitor ongoing
- **Alerting Thresholds**: When to alert on performance degradation
- **Regular Review**: Performance review cadence and process

## Code/Configuration Details
{CODE_DETAILS}

## Profiling Data
{PROFILING_DATA}

Please provide specific, actionable optimization recommendations with expected performance gains.`,
      variables: [
        'COMPONENT_NAME',
        'PERFORMANCE_ISSUES',
        'PERFORMANCE_GOALS',
        'USER_IMPACT',
        'RESPONSE_TIMES',
        'THROUGHPUT',
        'RESOURCE_UTILIZATION', 
        'ERROR_RATES',
        'CODE_DETAILS',
        'PROFILING_DATA'
      ],
      tags: [
        'performance',
        'optimization',
        'analysis',
        'metrics',
        'scalability'
      ],
    },
    {
      id: 'security-assessment',
      name: 'Security Assessment & Hardening',
      description: 'Comprehensive security analysis and hardening recommendations',
      category: 'security',
      content: `# Security Assessment & Hardening

Please conduct a comprehensive security assessment of this system:

## 1. System Context
**System/Application**: {SYSTEM_NAME}
**Type**: {SYSTEM_TYPE} (web app, API, mobile app, etc.)
**Sensitivity Level**: {DATA_SENSITIVITY}
**Compliance Requirements**: {COMPLIANCE_REQUIREMENTS}
**User Base**: {USER_BASE}

## 2. Current Security Measures
{CURRENT_SECURITY_MEASURES}

## 3. Security Assessment Areas

### 3.1 Authentication & Authorization
- **Authentication Mechanisms**: Strength and implementation review
- **Session Management**: Session security and lifecycle
- **Password Policies**: Strength requirements and storage
- **Multi-Factor Authentication**: Implementation and bypass protections
- **Authorization Controls**: Role-based access control effectiveness

### 3.2 Input Validation & Data Protection
- **Input Sanitization**: XSS, injection attack prevention
- **SQL Injection**: Parameterized queries and ORM usage
- **Data Validation**: Client-side and server-side validation
- **File Upload Security**: File type, size, and content validation
- **API Security**: Rate limiting, input validation, output encoding

### 3.3 Data Protection
- **Encryption at Rest**: Database, file system, backup encryption
- **Encryption in Transit**: TLS configuration and certificate management
- **Sensitive Data Handling**: PII, payment data, secrets management
- **Data Retention**: Policies and secure deletion procedures
- **Backup Security**: Backup encryption and access controls

### 3.4 Infrastructure Security
- **Server Hardening**: OS security, unnecessary services, patches
- **Network Security**: Firewall rules, VPN usage, network segmentation
- **Cloud Security**: Cloud service configuration and best practices
- **Container Security**: Image scanning, runtime security
- **Monitoring & Logging**: Security event monitoring and alerting

### 3.5 Application Security
- **Code Security**: Static analysis findings and recommendations
- **Dependency Management**: Vulnerable dependencies and updates
- **Error Handling**: Information disclosure prevention
- **Security Headers**: HTTPS, HSTS, CSP, X-Frame-Options
- **API Security**: Authentication, rate limiting, CORS configuration

### 3.6 Operational Security
- **Access Controls**: Administrative access and privilege management
- **Incident Response**: Security incident procedures and contacts
- **Security Training**: Team awareness and best practices
- **Regular Audits**: Security review cadence and scope
- **Penetration Testing**: External security assessments

## 4. Threat Modeling
Please analyze potential threats:

### 4.1 Common Attack Vectors
- **OWASP Top 10**: Specific risks for this application type
- **Injection Attacks**: SQL, NoSQL, LDAP, OS command injection
- **Broken Authentication**: Session hijacking, credential stuffing
- **Cross-Site Scripting**: Reflected, stored, DOM-based XSS
- **Insecure Direct Object References**: Authorization bypass

### 4.2 Advanced Persistent Threats
- **Supply Chain Attacks**: Third-party dependency risks
- **Insider Threats**: Malicious or negligent insider risks
- **Zero-Day Exploits**: Unknown vulnerability mitigation
- **Social Engineering**: Phishing and pretexting risks

## 5. Security Recommendations

### 5.1 Critical (Fix immediately)
High-risk vulnerabilities requiring immediate attention:

### 5.2 High Priority (Fix within 1 week)
Important security improvements with significant risk reduction:

### 5.3 Medium Priority (Fix within 1 month)
Security enhancements that improve overall posture:

### 5.4 Low Priority (Fix within 3 months)
Best practice improvements for defense-in-depth:

## 6. Compliance & Governance
- **Regulatory Compliance**: GDPR, PCI DSS, HIPAA, SOX requirements
- **Industry Standards**: ISO 27001, NIST, CIS Controls alignment
- **Security Policies**: Required policies and procedures
- **Audit Trail**: Logging and monitoring for compliance

## 7. Implementation Roadmap
- **Phase 1**: Critical security fixes
- **Phase 2**: High-priority improvements  
- **Phase 3**: Comprehensive security hardening
- **Ongoing**: Regular security maintenance and monitoring

## Additional Context
{ADDITIONAL_CONTEXT}

## Security Tools in Use
{SECURITY_TOOLS}

Please provide specific, prioritized security recommendations with clear implementation guidance.`,
      variables: [
        'SYSTEM_NAME',
        'SYSTEM_TYPE',
        'DATA_SENSITIVITY',
        'COMPLIANCE_REQUIREMENTS',
        'USER_BASE',
        'CURRENT_SECURITY_MEASURES',
        'ADDITIONAL_CONTEXT',
        'SECURITY_TOOLS'
      ],
      tags: [
        'security',
        'vulnerability-assessment',
        'compliance',
        'hardening',
        'risk-management'
      ],
    },
  ],
  metadata: {
    source_platform: 'Kiro',
    created_at: '2024-01-15T10:30:00.000Z',
    version: '2.1.0',
    total_templates: 5,
    categories: ['development', 'debugging', 'architecture', 'performance', 'security'],
  },
};

// Manifest Output Example
export const sampleManifestOutput: TaptikManifest = {
  build_id: 'build-abc123def-456789',
  taptik_version: '1.0.0',
  source_platform: 'Kiro',
  categories: ['personal-context', 'project-context', 'prompt-templates'],
  created_at: '2024-01-15T10:30:00.000Z',
  source_files: [
    {
      path: '.kiro/settings/context.md',
      type: 'context',
      size: 2048,
      last_modified: '2024-01-14T15:20:00.000Z',
    },
    {
      path: '.kiro/settings/user-preferences.md',
      type: 'preferences',
      size: 1536,
      last_modified: '2024-01-13T09:45:00.000Z',
    },
    {
      path: '.kiro/settings/project-spec.md',
      type: 'specification',
      size: 3072,
      last_modified: '2024-01-12T14:30:00.000Z',
    },
    {
      path: '.kiro/steering/react-patterns.md',
      type: 'steering',
      size: 4096,
      last_modified: '2024-01-10T11:15:00.000Z',
    },
    {
      path: '.kiro/steering/nextjs-conventions.md',
      type: 'steering',
      size: 2560,
      last_modified: '2024-01-08T16:45:00.000Z',
    },
    {
      path: '~/.kiro/prompts/code-review-comprehensive.md',
      type: 'prompt_template',
      size: 8192,
      last_modified: '2024-01-05T10:30:00.000Z',
    },
  ],
  output_files: [
    {
      filename: 'personal-context.json',
      category: 'personal-context',
      size: 5120,
    },
    {
      filename: 'project-context.json',
      category: 'project-context', 
      size: 12_288,
    },
    {
      filename: 'prompt-templates.json',
      category: 'prompt-templates',
      size: 16_384,
    },
    {
      filename: 'manifest.json',
      category: 'manifest',
      size: 2048,
    },
  ],
  build_metadata: {
    nodejs_version: '20.10.0',
    platform: 'darwin',
    build_duration_ms: 3450,
    warnings: [
      'Missing global settings directory: ~/.kiro/config',
      'Partial conversion for project-context due to missing steering files'
    ],
    errors: [],
  },
};

// Schema Validation Helpers
export const taptikSchemaValidators = {
  /**
   * Validate that a personal context object matches expected structure
   */
  validatePersonalContext: (object: any): object is TaptikPersonalContext => (
      object &&
      object.taptik_version === '1.0.0' &&
      object.context_type === 'personal' &&
      typeof object.created_at === 'string' &&
      typeof object.source_platform === 'string' &&
      object.user_info &&
      object.development_environment &&
      object.coding_preferences &&
      object.workflow_preferences &&
      object.ai_interaction_preferences
    ),

  /**
   * Validate that a project context object matches expected structure
   */
  validateProjectContext: (object: any): object is TaptikProjectContext => (
      object &&
      object.taptik_version === '1.0.0' &&
      object.context_type === 'project' &&
      typeof object.created_at === 'string' &&
      typeof object.source_platform === 'string' &&
      object.project_info &&
      object.technical_stack &&
      object.development_guidelines &&
      Array.isArray(object.architecture_patterns)
    ),

  /**
   * Validate that a prompt templates object matches expected structure
   */
  validatePromptTemplates: (object: any): object is TaptikPromptTemplates => (
      object &&
      object.taptik_version === '1.0.0' &&
      object.context_type === 'prompt_templates' &&
      typeof object.created_at === 'string' &&
      typeof object.source_platform === 'string' &&
      Array.isArray(object.templates) &&
      object.metadata &&
      object.templates.every((template: any) =>
        template.id &&
        template.name &&
        template.description &&
        template.category &&
        template.content &&
        Array.isArray(template.variables) &&
        Array.isArray(template.tags)
      )
    ),

  /**
   * Validate that a manifest object matches expected structure
   */
  validateManifest: (object: any): object is TaptikManifest => (
      object &&
      typeof object.build_id === 'string' &&
      object.taptik_version === '1.0.0' &&
      typeof object.source_platform === 'string' &&
      Array.isArray(object.categories) &&
      typeof object.created_at === 'string' &&
      Array.isArray(object.source_files) &&
      Array.isArray(object.output_files) &&
      object.build_metadata
    ),
};