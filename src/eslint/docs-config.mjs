import { defineConfig } from 'eslint/config';

import { configs as nextConfigs } from '../lint/plugins/next.mjs';

import { EXTENSION_TS } from './extensions.mjs';

/**
 * Lint config for a Next.js docs app. Exported from `@piplup/code-infra/eslint/docs` rather than
 * `@piplup/code-infra/eslint`, so projects without `@next/eslint-plugin-next` can load the base config.
 * @param {Object} [options]
 * @param {string} [options.rootDir] - Directory of the Next.js docs app, relative to the repo root. Defaults to `docs`.
 * @returns {import('eslint').Linter.Config[]}
 */
export function createDocsConfig({ rootDir = 'docs' } = {}) {
  return defineConfig(
    nextConfigs.recommended,
    {
      files: [`**/*${EXTENSION_TS}`],
      name: 'piplup/docs',
      rules: {
        'compat/compat': 'off',
        'jsx-a11y/anchor-is-valid': 'off',
        'no-irregular-whitespace': ['error', { skipJSXText: true, skipStrings: true }],
      },
      settings: {
        next: {
          rootDir,
        },
      },
    },
    {
      // Build configuration and maintenance scripts aren't documentation examples
      // and are often intentionally outside the docs TypeScript project.
      files: [`**/*${EXTENSION_TS}`],
      ignores: ['**/*.config.*', '**/scripts/**'],
      languageOptions: {
        parserOptions: {
          projectService: true,
          tsconfigRootDir: process.cwd(),
        },
      },
      name: 'piplup/docs/type-aware',
      rules: {
        '@typescript-eslint/no-deprecated': 'error',
      },
    },
  );
}

/**
 * The docs configs for `@piplup/code-infra/eslint/docs`. `docs` expects the Next.js app in `docs`;
 * set `settings.next.rootDir` to change that.
 */
export const configs = {
  /** @type {import('eslint').Linter.Config[]} */
  docs: createDocsConfig(),
};
