---
inclusion: fileMatch
fileMatchPattern: "**/*.controller.ts"
---

# API Development Guidelines

## Controller Best Practices
- Use proper HTTP decorators (@Get, @Post, @Put, @Delete, @Patch)
- Implement request validation with DTOs and ValidationPipe
- Use proper HTTP status codes for responses
- Handle errors gracefully with exception filters
- Keep controllers focused on HTTP concerns only

## Response Format
```typescript
// Success response
{
  "data": any,
  "message": "Success message",
  "statusCode": 200
}

// Error response
{
  "error": "Error message",
  "statusCode": 400,
  "timestamp": "2025-01-01T00:00:00.000Z",
  "path": "/api/endpoint"
}
```

## Health Check Standards
- Health checks should be lightweight and fast
- Include essential service dependencies
- Return proper HTTP status codes (200 for healthy, 503 for unhealthy)
- Provide meaningful health check names and descriptions

## Validation
- Use class-validator decorators in DTOs
- Validate all incoming request data
- Sanitize user inputs
- Return clear validation error messages