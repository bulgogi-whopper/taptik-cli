Analyze staged files and codes and add commit message. Please refer following git commit message guideline.

---
inclusion: always
---

# Git Commit Standards

## Commit Message Format

**Required Format**: `<gitmoji> <English commit message>`

All commit messages must use gitmoji followed by English description in present tense, under 50
characters.

## Essential Gitmoji Reference

| Gitmoji | Usage                          | Example                               |
| ------- | ------------------------------ | ------------------------------------- |
| 🎉      | Project/feature initialization | `🎉 Initialize health check module`   |
| ✨      | New features                   | `✨ Add user authentication API`      |
| 🐛      | Bug fixes                      | `🐛 Fix health check response error`  |
| 📝      | Documentation                  | `📝 Update API documentation`         |
| 🎨      | Code structure/formatting      | `🎨 Refactor controller code`         |
| ⚡      | Performance improvements       | `⚡ Optimize database queries`        |
| ✅      | Tests                          | `✅ Add
 health check unit tests`      |
| 🔧      | Configuration                  | `🔧 Update ESLint configuration`      |
| 🔒      | Security fixes                 | `🔒 Fix authentication vulnerability` |
| ⬆️      | Dependency upgrades            | `⬆️ Upgrade NestJS version`           |
| 🔥      | Code removal                   | `🔥 Remove unused service`            |
| 🚀      | Deployment                     | `🚀 Add production deployment config` |

## NestJS-Specific Commit Patterns

- **Controllers**: `✨ Add [module] controller [feature]`
- **Services**: `✨ Implement [module] service [feature]`
- **Modules**: `🎉 Create [module] module`
- **DTOs**: `✨ Define [module] DTO`
- **Tests**: `✅ Add [module] [test-type] tests`
- **Config**: `🔧 Add [config-name] environment config`
- **Guards**: `🔒 Add [module] auth guard`
- **Interceptors**: `⚡ Add [module] response interceptor`
- **Pipes**: `✨ Add [module] validation pipe`
- **Filters**: `🐛 Add [module] exception filter`

## Commit Message Guidelines

- **Character limit**: 50 characters maximum
- **Present tense**: Use imperative mood ("Add" not "Added")
- **Be specific**: Include module/component name when applicable
- **Scope clarity**: Indicate what part of the system is affected
- **No periods**: Don't end commit messages with periods
- **Capitalize**: First letter after gitmoji should be capitalized

## Branch Naming Convention

- **Feature branches**: `feature/[module]-[description]`
- **Bug fixes**: `fix/[module]-[issue-description]`
- **Hotfixes**: `hotfix/[critical-issue]`
- **Refactoring**: `refactor/[module]-[improvement]`

Examples:

```
feature/health-check-endpoint
fix/auth-token-validation
hotfix/memory-leak-service
refactor/user-service-cleanup
```

## Examples for This Project

```
✨ Add health check controller
🐛 Fix health check response status
📝 Add health check API documentation
✅ Add health controller unit tests
🔧 Configure Jest test environment
🎉 Initialize NestJS application
🔒 Add health check auth guard
⚡ Optimize health check response time
```
