import { defineConfig } from 'eslint/config';

import { configs as importConfigs } from '../../lint/plugins/import.mjs';
import { EXTENSION_TS } from '../extensions.mjs';
import { TYPESCRIPT_RESOLVER } from '../import-resolver.mjs';

import { languageOptions } from './shared.mjs';

/**
 * eslint-plugin-import rules on top of its recommended, react and typescript configs.
 * @type {import('eslint').Linter.RulesRecord}
 */
export const rules = {
  // Keep `import type` separate from value imports, with `@typescript-eslint/consistent-type-imports`.
  'import/consistent-type-specifier-style': ['error', 'prefer-top-level'],
  // TypeScript extensions handling
  'import/extensions': [
    'error',
    'ignorePackages',
    {
      js: 'never',
      jsx: 'never',
      mjs: 'never',
      ts: 'never',
      tsx: 'never',
    },
  ],
  'import/first': 'error',
  // The following rules are enabled in Airbnb config, but are recommended to be disabled within TypeScript projects
  // See: https://github.com/typescript-eslint/typescript-eslint/blob/13583e65f5973da2a7ae8384493c5e00014db51b/docs/linting/TROUBLESHOOTING.md#eslint-plugin-import
  // Also, "not sure why it doesn't work".
  'import/named': 'off',
  // https://github.com/import-js/eslint-plugin-import/blob/master/docs/rules/namespace.md
  'import/namespace': 'off',
  'import/newline-after-import': 'error',
  'import/no-cycle': 'off',
  // Forbid require() calls with expressions
  // https://github.com/import-js/eslint-plugin-import/blob/master/docs/rules/no-dynamic-require.md
  'import/no-dynamic-require': 'error',
  // Missing yarn workspace support
  'import/no-extraneous-dependencies': 'off',
  'import/no-mutable-exports': 'error',
  'import/no-named-as-default-member': 'off',
  'import/no-relative-packages': 'error',
  'import/no-unresolved': 'off',
  // The code is already coupled to webpack. Prefer explicit coupling.
  'import/no-webpack-loader-syntax': 'off',
  // Import rules (critical ones not in recommended)
  'import/order': [
    'error',
    {
      alphabetize: { caseInsensitive: true, order: 'asc' },
      groups: [
        'builtin', // Node.js built-in modules
        'external', // React, next, node_modules
        'internal', // @/
        'parent', // ../
        'sibling', // ./
        'index',
        'object',
        'type',
      ],
      'newlines-between': 'always',
      pathGroups: [
        // 1. CSS files first
        {
          group: 'builtin',
          pattern: '**/*.css',
          position: 'before',
        },
        {
          group: 'builtin',
          pattern: '**/*.scss',
          position: 'before',
        },
        // 2. Node built-ins are already in "builtin" group (no extra config needed)

        // 3. React & Next come before other external packages
        {
          group: 'external',
          pattern: 'react',
          position: 'before',
        },
        {
          group: 'external',
          pattern: 'react-dom',
          position: 'before',
        },
        {
          group: 'external',
          pattern: 'next',
          position: 'before',
        },
        {
          group: 'external',
          pattern: 'next/**',
          position: 'before',
        },
        {
          group: 'external',
          pattern: '@next/**',
          position: 'before',
        },
      ],
      pathGroupsExcludedImportTypes: ['builtin'],
    },
  ],
  // Not needed in general, can be turned on for specific files
  'import/prefer-default-export': 'off',
};

/**
 * How eslint-plugin-import finds and parses modules.
 * @type {Record<string, unknown>}
 */
export const settings = {
  'import/core-modules': [],
  'import/extensions': ['.js', '.mjs', '.jsx', '.ts', '.tsx', '.d.ts'],
  // Extend Airbnb extensions with TypeScript
  'import/external-module-folders': ['node_modules', 'node_modules/@types'],
  'import/ignore': ['node_modules', '\\.(css|svg|json)$'],
  // Override with TypeScript-specific settings
  'import/parsers': {
    '@typescript-eslint/parser': ['.ts', '.tsx'],
  },
  'import/resolver': {
    node: {
      extensions: ['.mjs', '.js', '.json'],
    },
    [TYPESCRIPT_RESOLVER]: {
      project: ['tsconfig.node.json', 'apps/*/tsconfig.json', 'packages/*/tsconfig.json'],
    },
  },
};

/**
 * Imports: eslint-plugin-import's recommended, react and typescript configs, and ours.
 * @type {import('eslint').Linter.Config[]}
 */
export const config = defineConfig(
  {
    extends: [importConfigs.recommended, importConfigs.react, importConfigs.typescript],
    files: [`**/*${EXTENSION_TS}`],
    languageOptions,
    name: 'piplup/imports',
    rules,
    settings,
  },
  {
    // Node.js needs the extension in ES module imports.
    // oxlint and oxfmt load their config files with Node.js too, so those need extensions as well.
    files: ['**/*.mjs', '**/oxlint.config.ts', '**/oxfmt.config.ts'],
    name: 'piplup/imports/esm',
    rules: {
      'import/extensions': [
        'error',
        'ignorePackages',
        {
          js: 'always',
          mjs: 'always',
        },
      ],
    },
  },
);
