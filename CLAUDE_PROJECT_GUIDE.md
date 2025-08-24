# Project Guide

## Current Work Overview
The deploy command currently only supports Claude Code platform. We are working on adding Cursor platform support.

## Work Process
1. PRD and design and task list are already written
2. Work through tasks starting from 1.1 in order
3. For each task:
   - First explain plan in Korean (no coding)
   - Start coding when user says 'go'
   - After completion, check tasks.md: `[]` -> `[x]`
   - Commit with `/git-commit` command

## Key Files
- `design.md`: Design specifications
- `requirements.md`: Detailed requirements
- `tasks.md`: Task list and progress tracking

## Development Commands
- `pnpm run cli` - Run CLI in development mode
- `pnpm run test:run` - Run tests
- `pnpm run lint` - Run linting
- `pnpm run build` - Build project

## Coding Rules
- Create files only when absolutely necessary
- Prefer editing existing files
- Create documentation files only when explicitly requested
- Respond in Korean

## Current Branch: feat/deploy-cursor
Main Branch: main