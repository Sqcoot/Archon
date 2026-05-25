import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
  // Global ignores (applied to all configs)
  {
    ignores: [
      'node_modules/**',
      'packages/*/node_modules/**',
      'packages/*/dist/**',
      'dist/**',
      'coverage/**',
      '.agents/**',
      'packages/docs-web/**',
      'party-mode-output*/**',
      'workspace/**',
      'worktrees/**',
      '.claude/worktrees/**',
      '.claude/skills/**',
      '.archon/**', // User workflow/script/command content — not in any tsconfig project
      '**/*.generated.ts', // Auto-generated source files (content inlined via JSON.stringify)
      '**/*.js',
      '*.mjs',
      '**/*.test.ts',
      '**/src/test/**', // Test helper files (mock factories, fixtures)
      '*.d.ts', // Root-level declaration files (not in tsconfig project scope)
      '**/*.generated.d.ts', // Auto-generated declaration files (e.g. openapi-typescript output)
      'packages/web/vite.config.ts', // Vite config doesn't need type-checked linting
      'packages/web/components.json',
      'packages/web/src/components/ui/**', // shadcn/ui auto-generated components
      'packages/web/src/lib/utils.ts', // shadcn/ui utility file
    ],
  },

  // Base configs
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  // Prettier integration
  prettierConfig,

  // Project-specific settings
  {
    files: ['packages/*/src/**/*.{ts,tsx}', 'scripts/**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // === ENFORCED RULES (errors) ===
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      quotes: ['error', 'single', { avoidEscape: true }],
      semi: ['error', 'always'],
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'interface',
          format: ['PascalCase'],
          custom: { regex: '^I?[A-Z]', match: true },
        },
        { selector: 'typeAlias', format: ['PascalCase'] },
        { selector: 'function', format: ['camelCase', 'PascalCase'] },
        { selector: 'variable', format: ['camelCase', 'UPPER_CASE'] },
      ],
      '@typescript-eslint/no-non-null-assertion': 'error',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@archon/*/src/*'],
              message: 'Import through public package exports instead of package internals.',
            },
          ],
        },
      ],

      // === DISABLED RULES ===

      // --- Template/expression rules ---
      // Numbers/booleans in template literals are valid JS (auto-converted to string)
      '@typescript-eslint/restrict-template-expressions': 'off',
      // Mixed operands in + are often intentional (string concatenation)
      '@typescript-eslint/restrict-plus-operands': 'off',

      // --- Defensive coding patterns ---
      // Switch defaults, null checks, and defensive guards are valuable
      '@typescript-eslint/no-unnecessary-condition': 'off',
      // Env var checks need || for truthy evaluation (empty string = missing)
      '@typescript-eslint/prefer-nullish-coalescing': 'off',

      // --- External SDK interop (types are often `any` or incomplete) ---
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      // Event handler patterns in SDKs often have promise mismatches
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/no-floating-promises': 'off',

      // --- Style preferences (not critical for type safety) ---
      // Catch variable typing preference
      '@typescript-eslint/use-unknown-in-catch-callback-variable': 'off',
      // Allow using deprecated APIs during migration periods
      '@typescript-eslint/no-deprecated': 'off',
      // Empty async functions valid for interface compliance
      '@typescript-eslint/require-await': 'off',
      // Constructor style preference
      '@typescript-eslint/consistent-generic-constructors': 'off',
    },
  },

  // ACO core is pure domain code: no runtime adapters, SDKs, process globals, or IO.
  {
    files: ['packages/aco-core/src/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/no-floating-promises': 'error',
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'fs', message: 'ACO core must not import filesystem APIs.' },
            { name: 'fs/promises', message: 'ACO core must not import filesystem APIs.' },
            { name: 'node:fs', message: 'ACO core must not import filesystem APIs.' },
            { name: 'node:fs/promises', message: 'ACO core must not import filesystem APIs.' },
            { name: 'path', message: 'ACO core paths must use branded contracts.' },
            { name: 'node:path', message: 'ACO core paths must use branded contracts.' },
            { name: 'process', message: 'ACO core must not read process-global config.' },
            { name: 'node:process', message: 'ACO core must not read process-global config.' },
            { name: 'child_process', message: 'ACO core must not spawn processes.' },
            { name: 'node:child_process', message: 'ACO core must not spawn processes.' },
            { name: '@hono/zod-openapi', message: 'OpenAPI belongs in server adapters.' },
            {
              name: '@anthropic-ai/claude-agent-sdk',
              message: 'Provider SDKs belong in provider adapters.',
            },
            { name: '@openai/codex-sdk', message: 'Provider SDKs belong in provider adapters.' },
            {
              name: '@mariozechner/pi-ai',
              message: 'Provider SDKs belong in provider adapters.',
            },
            {
              name: '@mariozechner/pi-coding-agent',
              message: 'Provider SDKs belong in provider adapters.',
            },
          ],
          patterns: [
            {
              group: ['@archon/*', '@archon/*/src/*'],
              message: 'ACO core must not import Archon runtime packages or internals.',
            },
          ],
        },
      ],
    },
  },

  // ACO ledgers may depend on ACO core and zod only; runtime IO lives in future adapters.
  {
    files: ['packages/aco-ledgers/src/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/no-floating-promises': 'error',
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'fs',
              message: 'ACO ledgers production source must not import filesystem APIs.',
            },
            {
              name: 'fs/promises',
              message: 'ACO ledgers production source must not import filesystem APIs.',
            },
            {
              name: 'node:fs',
              message: 'ACO ledgers production source must not import filesystem APIs.',
            },
            {
              name: 'node:fs/promises',
              message: 'ACO ledgers production source must not import filesystem APIs.',
            },
            {
              name: 'path',
              message: 'ACO ledgers production source must not import path APIs.',
            },
            {
              name: 'node:path',
              message: 'ACO ledgers production source must not import path APIs.',
            },
            {
              name: 'process',
              message: 'ACO ledgers production source must not read process-global config.',
            },
            {
              name: 'node:process',
              message: 'ACO ledgers production source must not read process-global config.',
            },
            { name: 'child_process', message: 'ACO ledgers production source must not spawn.' },
            {
              name: 'node:child_process',
              message: 'ACO ledgers production source must not spawn.',
            },
          ],
          patterns: [
            {
              group: ['@archon/adapters*', '@archon/cli*', '@archon/server*', '@archon/web*'],
              message: 'ACO ledgers must not import runtime package adapters.',
            },
          ],
        },
      ],
    },
  },

  // ACO Codex is a pure bootstrap/harness contract package; runtime IO lives in future adapters.
  {
    files: ['packages/aco-codex/src/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/no-floating-promises': 'error',
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'fs',
              message: 'ACO Codex production source must not import filesystem APIs.',
            },
            {
              name: 'fs/promises',
              message: 'ACO Codex production source must not import filesystem APIs.',
            },
            {
              name: 'node:fs',
              message: 'ACO Codex production source must not import filesystem APIs.',
            },
            {
              name: 'node:fs/promises',
              message: 'ACO Codex production source must not import filesystem APIs.',
            },
            {
              name: 'path',
              message: 'ACO Codex production source must not import path APIs.',
            },
            {
              name: 'node:path',
              message: 'ACO Codex production source must not import path APIs.',
            },
            {
              name: 'process',
              message: 'ACO Codex production source must not read process-global config.',
            },
            {
              name: 'node:process',
              message: 'ACO Codex production source must not read process-global config.',
            },
            { name: 'child_process', message: 'ACO Codex production source must not spawn.' },
            {
              name: 'node:child_process',
              message: 'ACO Codex production source must not spawn.',
            },
          ],
          patterns: [
            {
              group: [
                '@archon/adapters*',
                '@archon/cli*',
                '@archon/server*',
                '@archon/web*',
                '@archon/workflows*',
                '@archon/providers*',
              ],
              message: 'ACO Codex must not import runtime package adapters.',
            },
          ],
        },
      ],
    },
  }
);
