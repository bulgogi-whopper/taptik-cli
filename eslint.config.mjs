import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import unicorn from 'eslint-plugin-unicorn';
import importX from 'eslint-plugin-import-x';
import prettier from 'eslint-config-prettier';

export default [
  // Global ignores (replaces .eslintignore)
  {
    ignores: [
      'dist/**',
      'build/**',
      'out/**',
      '.next/**',
      '.nuxt/**',
      'node_modules/**',
      '.pnpm-store/**',
      'coverage/**',
      '.nyc_output/**',
      'tmp/**',
      'temp/**',
      '*.log',
      '*.d.ts.map',
      '*.js.map',
      '.env*',
      '.DS_Store',
      'Thumbs.db',
    ],
  },

  // Base JavaScript recommended rules
  js.configs.recommended,

  // Global configuration for all files
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        // Node.js globals
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
  },

  // TypeScript configuration
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: './tsconfig.json',
        tsconfigRootDir: process.cwd(),
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      unicorn,
      'import-x': importX,
    },
    settings: {
      'import-x/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: './tsconfig.json',
        },
        node: true,
      },
    },
    rules: {
      // TypeScript ESLint recommended rules
      ...tseslint.configs.recommended.rules,

      // TypeScript-specific overrides
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',

      // NestJS-specific TypeScript rules
      '@typescript-eslint/no-inferrable-types': 'off',
      '@typescript-eslint/interface-name-prefix': 'off',

      // Unicorn plugin rules - optimized for NestJS
      'unicorn/better-regex': 'error',
      'unicorn/catch-error-name': 'error',
      'unicorn/consistent-destructuring': 'error',
      'unicorn/error-message': 'error',
      'unicorn/escape-case': 'error',
      'unicorn/explicit-length-check': 'error',
      'unicorn/filename-case': [
        'error',
        {
          cases: {
            kebabCase: true,
            camelCase: true,
          },
          ignore: ['README.md', 'CHANGELOG.md', 'LICENSE'],
        },
      ],
      'unicorn/new-for-builtins': 'error',
      'unicorn/no-abusive-eslint-disable': 'error',
      'unicorn/no-array-for-each': 'off',
      'unicorn/no-array-reduce': 'off',
      'unicorn/no-console-spaces': 'error',
      'unicorn/no-for-loop': 'error',
      'unicorn/no-instanceof-array': 'error',
      'unicorn/no-keyword-prefix': 'off',
      'unicorn/no-lonely-if': 'error',
      'unicorn/no-nested-ternary': 'error',
      'unicorn/no-new-buffer': 'error',
      'unicorn/no-null': 'off',
      'unicorn/no-object-as-default-parameter': 'error',
      'unicorn/no-process-exit': 'error',
      'unicorn/no-static-only-class': 'off',
      'unicorn/no-thenable': 'error',
      'unicorn/no-this-assignment': 'error',
      'unicorn/no-typeof-undefined': 'error',
      'unicorn/no-unnecessary-await': 'error',
      'unicorn/no-unreadable-array-destructuring': 'error',
      'unicorn/no-unused-properties': 'error',
      'unicorn/no-useless-fallback-in-spread': 'error',
      'unicorn/no-useless-length-check': 'error',
      'unicorn/no-useless-spread': 'error',
      'unicorn/no-zero-fractions': 'error',
      'unicorn/number-literal-case': 'error',
      'unicorn/numeric-separators-style': 'error',
      'unicorn/prefer-array-find': 'error',
      'unicorn/prefer-array-flat': 'error',
      'unicorn/prefer-array-flat-map': 'error',
      'unicorn/prefer-array-index-of': 'error',
      'unicorn/prefer-array-some': 'error',
      'unicorn/prefer-at': 'error',
      'unicorn/prefer-code-point': 'error',
      'unicorn/prefer-date-now': 'error',
      'unicorn/prefer-default-parameters': 'error',
      'unicorn/prefer-includes': 'error',
      'unicorn/prefer-logical-operator-over-ternary': 'error',
      'unicorn/prefer-math-trunc': 'error',
      'unicorn/prefer-modern-math-apis': 'error',
      'unicorn/prefer-module': 'error',
      'unicorn/prefer-native-coercion-functions': 'error',
      'unicorn/prefer-negative-index': 'error',
      'unicorn/prefer-node-protocol': 'error',
      'unicorn/prefer-number-properties': 'error',
      'unicorn/prefer-object-from-entries': 'error',
      'unicorn/prefer-optional-catch-binding': 'error',
      'unicorn/prefer-regexp-test': 'error',
      'unicorn/prefer-set-has': 'error',
      'unicorn/prefer-set-size': 'error',
      'unicorn/prefer-spread': 'error',
      'unicorn/prefer-string-replace-all': 'error',
      'unicorn/prefer-string-slice': 'error',
      'unicorn/prefer-string-starts-ends-with': 'error',
      'unicorn/prefer-string-trim-start-end': 'error',
      'unicorn/prefer-switch': 'error',
      'unicorn/prefer-ternary': 'error',
      'unicorn/prefer-top-level-await': 'off',
      'unicorn/prefer-type-error': 'error',
      'unicorn/prevent-abbreviations': [
        'error',
        {
          replacements: {
            req: false,
            res: false,
            ctx: false,
            dto: false,
            db: false,
            env: false,
            config: false,
            auth: false,
            i: false,
            j: false,
            e: {
              error: true,
              event: false,
            },
          },
          ignore: ['\\.e2e$', '\\.spec$', '\\.test$'],
        },
      ],
      'unicorn/relative-url-style': 'error',
      'unicorn/require-array-join-separator': 'error',
      'unicorn/require-number-to-fixed-digits-argument': 'error',
      'unicorn/string-content': 'error',
      'unicorn/template-indent': 'warn',
      'unicorn/text-encoding-identifier-case': 'error',
      'unicorn/throw-new-error': 'error',

      // Import-X plugin rules - optimized for NestJS
      'import-x/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index',
            'type',
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
            {
              pattern: '@/**',
              group: 'internal',
              position: 'before',
            },
          ],
          pathGroupsExcludedImportTypes: ['builtin'],
        },
      ],
      'import-x/no-unresolved': 'error',
      'import-x/named': 'error',
      'import-x/default': 'error',
      'import-x/namespace': 'error',
      'import-x/no-absolute-path': 'error',
      'import-x/no-dynamic-require': 'error',
      'import-x/no-internal-modules': 'off',
      'import-x/no-webpack-loader-syntax': 'error',
      'import-x/no-self-import': 'error',
      'import-x/no-cycle': [
        'error',
        {
          maxDepth: 10,
          ignoreExternal: true,
        },
      ],
      'import-x/no-useless-path-segments': [
        'error',
        {
          noUselessIndex: true,
        },
      ],
      'import-x/no-relative-parent-imports': 'off',
      'import-x/no-relative-packages': 'error',
      'import-x/no-mutable-exports': 'error',
      'import-x/no-deprecated': 'warn',
      'import-x/no-extraneous-dependencies': [
        'error',
        {
          devDependencies: [
            '**/*.test.ts',
            '**/*.spec.ts',
            '**/*.e2e-spec.ts',
            'test/**/*',
            'tests/**/*',
          ],
          optionalDependencies: false,
          peerDependencies: false,
        },
      ],
      'import-x/no-commonjs': 'error',
      'import-x/no-amd': 'error',
      'import-x/no-duplicates': [
        'error',
        {
          considerQueryString: true,
        },
      ],
      'import-x/first': 'error',
      'import-x/max-dependencies': [
        'warn',
        {
          max: 15,
          ignoreTypeImports: true,
        },
      ],
      'import-x/no-anonymous-default-export': [
        'error',
        {
          allowArray: false,
          allowArrowFunction: false,
          allowAnonymousClass: false,
          allowAnonymousFunction: false,
          allowCallExpression: true,
          allowNew: false,
          allowLiteral: false,
          allowObject: false,
        },
      ],
      'import-x/no-default-export': 'off',
      'import-x/prefer-default-export': 'off',
      'import-x/group-exports': 'off',
      'import-x/exports-last': 'off',
      'import-x/no-namespace': 'off',
      'import-x/extensions': [
        'error',
        'ignorePackages',
        {
          js: 'never',
          jsx: 'never',
          ts: 'never',
          tsx: 'never',
        },
      ],
      'import-x/newline-after-import': [
        'error',
        {
          count: 1,
        },
      ],

      // Core ESLint rules - NestJS optimized
      'no-console': 'warn',
      'no-debugger': 'error',
      'no-alert': 'error',
      'no-await-in-loop': 'error',
      'no-return-await': 'off',
      'no-unused-vars': 'off',
      'prefer-const': 'error',
      'prefer-template': 'error',
      'prefer-arrow-callback': 'error',
      'arrow-body-style': ['error', 'as-needed'],
      'object-shorthand': 'error',
      'prefer-destructuring': [
        'error',
        {
          array: false,
          object: true,
        },
      ],
      'no-var': 'error',
      'no-param-reassign': [
        'error',
        {
          props: false,
        },
      ],
      'no-shadow': 'off',
      'no-use-before-define': 'off',
      'consistent-return': 'off',
      'class-methods-use-this': 'off',
      'max-classes-per-file': 'off',
    },
  },

  // Test files configuration
  {
    files: [
      '**/*.test.ts',
      '**/*.spec.ts',
      '**/*.e2e-spec.ts',
      'test/**/*',
      'tests/**/*',
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'unicorn/no-null': 'off',
      'unicorn/consistent-function-scoping': 'off',
      'import-x/no-extraneous-dependencies': 'off',
      'no-console': 'off',
    },
  },

  // CLI command files configuration
  {
    files: [
      '**/commands/**/*.ts',
      'src/commands/**/*.ts',
      'src/**/commands/**/*.ts',
    ],
    rules: {
      'no-console': 'off', // Allow console statements in CLI commands for user interaction
    },
  },

  // Configuration files
  {
    files: [
      '*.config.js',
      '*.config.ts',
      '*.config.mjs',
      'eslint.config.js',
      'jest.config.js',
      'nest-cli.json',
    ],
    rules: {
      'unicorn/prefer-module': 'off',
      'import-x/no-default-export': 'off',
      'import-x/no-commonjs': 'off',
    },
  },

  // Prettier integration - must be last
  prettier,
];
