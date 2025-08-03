# NestJS Health Check Project

A minimal NestJS project with health check endpoint for a 3-person development team.

## Installation

```bash
npm install
```

## Running the app

```bash
# development
npm run start

# watch mode
npm run start:dev

# production mode
npm run start:prod
```

## Health Check

The health check endpoint is available at:
- `GET /health` - Returns application health status

## Test

```bash
# unit tests
npm run test

# e2e tests
npm run test:e2e

# test coverage
npm run test:cov
```

## Team Development

This project is set up for a 3-person team with:
- TypeScript configuration
- ESLint and Prettier for code formatting
- Jest for testing
- NestJS Terminus for health checks