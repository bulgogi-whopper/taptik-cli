---
inclusion: always
---

# NestJS Development Standards

## Code Style & Structure

- Use TypeScript strict mode and proper typing
- Follow NestJS naming conventions (controllers end with `.controller.ts`, services with `.service.ts`)
- Use dependency injection properly with constructor injection
- Implement proper error handling with NestJS exception filters
- Use DTOs for request/response validation with class-validator
- Keep controllers thin - business logic belongs in services

## File Organization

- Group related functionality in modules
- Place shared utilities in a `common/` directory
- Use barrel exports (index.ts) for clean imports
- Keep test files alongside source files with `.spec.ts` extension

## API Standards

- Use proper HTTP status codes
- Implement consistent error response format
- Add OpenAPI/Swagger documentation for all endpoints
- Use proper HTTP methods (GET, POST, PUT, DELETE, PATCH)
- Implement request validation and sanitization

## Testing Requirements

- Write unit tests for all services and controllers
- Maintain minimum 80% test coverage
- Use descriptive test names that explain the scenario
- Mock external dependencies properly
- Write integration tests for critical paths

## Team Collaboration

- Use conventional commit messages
- Create feature branches from main
- Require code review from at least one team member
- Run tests and linting before committing
- Keep pull requests focused and small
