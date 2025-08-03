# ESLint & Prettier Configuration Guide

## Overview

This project uses a modern ESLint v9 flat configuration with comprehensive TypeScript support,
optimized for NestJS development patterns. The setup includes powerful plugins for code quality,
import organization, and consistent formatting.

## Configuration Files

### ESLint Configuration (`eslint.config.js`)

The project uses ESLint v9's new flat configuration format with the following key features:

- **Modern ES Module syntax** with proper imports
- **TypeScript-first approach** with `@typescript-eslint` integration
- **NestJS-optimized rules** that understand framework patterns
- **Advanced plugin integration** with `unicorn` and `import-x`
- **Prettier integration** for seamless formatting

### Prettier Configuration (`.prettierrc`)

Prettier is configured with sensible defaults for TypeScript/NestJS projects:

```json
{
  "semi": true,
  "trailingComma": "all",
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2,
  "useTabs": false
}
```

## Installed Plugins

### 1. ESLint Plugin Unicorn (`eslint-plugin-unicorn`)

**Version**: v60.0.0  
**Purpose**: Provides 100+ powerful ESLint rules for better JavaScript/TypeScript code

**Key Rules Enabled**:

- `unicorn/better-regex` - Improve regex patterns
- `unicorn/catch-error-name` - Enforce consistent error naming
- `unicorn/explicit-length-check` - Prefer explicit length checks
- `unicorn/filename-case` - Enforce consistent filename casing
- `unicorn/no-array-for-each` - Disabled for NestJS compatibility
- `unicorn/no-null` - Disabled for NestJS compatibility
- `unicorn/prefer-node-protocol` - Use `node:` protocol for imports
- `unicorn/prevent-abbreviations` - Prevent unclear abbreviations

**NestJS-Specific Customizations**:

```javascript
'unicorn/prevent-abbreviations': [
  'error',
  {
    replacements: {
      req: false,    // Allow in request handlers
      res: false,    // Allow in response handlers
      ctx: false,    // Allow in context objects
      dto: false,    // Allow Data Transfer Objects
      db: false,     // Allow database references
      env: false,    // Allow environment variables
      config: false, // Allow configuration objects
      auth: false,   // Allow authentication references
    },
  },
],
```

### 2. ESLint Plugin Import-X (`eslint-plugin-import-x`)

**Version**: v4.16.1  
**Purpose**: Enhanced import/export linting with better performance than the original
`eslint-plugin-import`

**Key Rules Enabled**:

- `import-x/order` - Enforce import order with custom grouping
- `import-x/no-unresolved` - Ensure imports resolve correctly
- `import-x/no-cycle` - Prevent circular dependencies
- `import-x/no-duplicates` - Prevent duplicate imports
- `import-x/newline-after-import` - Enforce newlines after imports
- `import-x/extensions` - Control file extension usage

**Import Order Configuration**:

```javascript
'import-x/order': [
  'error',
  {
    groups: [
      'builtin',    // Node.js built-ins
      'external',   // npm packages
      'internal',   // Internal modules
      'parent',     // Parent directory imports
      'sibling',    // Same directory imports
      'index',      // Index file imports
      'type',       // TypeScript type imports
    ],
    'newlines-between': 'always',
    alphabetize: {
      order: 'asc',
      caseInsensitive: true,
    },
    pathGroups: [
      {
        pattern: '@nestjs/**',
        group: 'external',
        position: 'before',
      },
    ],
  },
],
```

## Available Scripts

### Linting Scripts

```bash
# Run ESLint with auto-fix
pnpm run lint

# Run ESLint without auto-fix (check only)
pnpm run lint:check
```

### Formatting Scripts

```bash
# Format all supported files
pnpm run format
```

## File-Specific Configurations

### TypeScript Files (`**/*.ts`, `**/*.tsx`)

- Full TypeScript ESLint rules enabled
- Unicorn plugin rules optimized for NestJS
- Import-X plugin with TypeScript resolver
- Strict type checking with project references

### Test Files (`**/*.test.ts`, `**/*.spec.ts`, `**/*.e2e-spec.ts`)

Relaxed rules for test files:

- `@typescript-eslint/no-explicit-any`: off
- `@typescript-eslint/no-non-null-assertion`: off
- `unicorn/no-null`: off
- `no-console`: off

### Configuration Files (`*.config.js`, `eslint.config.js`, etc.)

- Allow CommonJS patterns
- Allow default exports
- Relaxed module system rules

## Integration with Development Workflow

### Pre-commit Hooks (Recommended)

Add to your `package.json`:

```json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged"
    }
  },
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"]
  }
}
```

### IDE Integration

#### VS Code

Install the following extensions:

- ESLint (`ms-vscode.vscode-eslint`)
- Prettier (`esbenp.prettier-vscode`)

Add to your `.vscode/settings.json`:

```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "eslint.experimental.useFlatConfig": true
}
```

## Troubleshooting

### Common Issues

1. **Module Resolution Errors**

   - Ensure `eslint-import-resolver-typescript` is installed
   - Check that `tsconfig.json` paths are correctly configured

2. **Performance Issues**

   - The configuration includes performance optimizations
   - Consider using `--cache` flag for large projects

3. **Rule Conflicts**
   - Prettier rules are configured to override conflicting ESLint rules
   - The configuration includes `eslint-config-prettier` as the last config

### Customization

To customize rules for your specific needs:

1. **Disable a rule**:

   ```javascript
   rules: {
     'unicorn/prevent-abbreviations': 'off',
   }
   ```

2. **Change rule severity**:

   ```javascript
   rules: {
     'no-console': 'warn', // instead of 'error'
   }
   ```

3. **Add file-specific overrides**:
   ```javascript
   {
     files: ['src/legacy/**/*.ts'],
     rules: {
       'unicorn/prefer-module': 'off',
     },
   }
   ```

## Best Practices

1. **Run linting before commits** - Use pre-commit hooks
2. **Fix auto-fixable issues** - Use `pnpm run lint` regularly
3. **Review warnings** - Don't ignore linting warnings
4. **Keep configuration updated** - Regularly update plugins
5. **Document exceptions** - Use ESLint disable comments sparingly and with explanations

## Migration Notes

This configuration uses ESLint v9's flat config format. If migrating from legacy `.eslintrc.*`
files:

1. The `ignores` property replaces `.eslintignore`
2. Plugin imports use ES modules
3. Configuration is more explicit and type-safe
4. Better performance and more predictable behavior

## Dependencies

The following packages are required for this configuration:

```json
{
  "devDependencies": {
    "@eslint/js": "^9.32.0",
    "@typescript-eslint/eslint-plugin": "^8.38.0",
    "@typescript-eslint/parser": "^8.38.0",
    "eslint": "^9.32.0",
    "eslint-config-prettier": "^10.1.8",
    "eslint-import-resolver-typescript": "^4.4.4",
    "eslint-plugin-import-x": "^4.16.1",
    "eslint-plugin-unicorn": "^60.0.0",
    "prettier": "^3.6.2",
    "typescript": "^5.8.3"
  }
}
```

This setup provides a robust, modern linting and formatting solution optimized for NestJS
development with TypeScript.
