---
inclusion: always
---

# Project Context

## Team Information

- Team size: 3 developers
- Project: NestJS application with health check functionality
- Development approach: Collaborative development with code reviews

## Current Architecture

- Framework: NestJS with TypeScript
- Health monitoring: @nestjs/terminus
- Testing: Jest
- Code quality: ESLint + Prettier

## Development Workflow

- Use `pnpm run start:dev` for development
- Run `pnpm run test` before committing
- Use `pnpm run lint` to check code style
- Health check available at `/health` endpoint

## Key Dependencies

- @nestjs/common, @nestjs/core, @nestjs/platform-express
- @nestjs/terminus for health checks
- TypeScript for type safety
- Jest for testing

## Build & Deployment

- Build command: `pnpm run build`
- Production start: `pnpm run start:prod`
- Application runs on port 3000 by default
