import nextjs from '@next/eslint-plugin-next';

import { defineConfig } from 'eslint/config';

import { EXTENSION_TS } from './extensions.mjs';

/**
 * Lint config for a Next.js docs app. Exported from `@piplup/code-infra/eslint/docs` rather than
 * `@piplup/code-infra/eslint`, so projects without `@next/eslint-plugin-next` can load the base config.
 * @param {Object} [options]
 * @param {string} [options.rootDir] - Directory of the Next.js docs app, relative to the repo root. Defaults to `docs`.
 * @returns {import('eslint').Linter.Config[]}
 */
export function createDocsConfig({ rootDir = 'docs' } = {}) {
  /**
   * @type {any}
   */
  const nextjsAlias = nextjs;

  // `nextjs.flatConfig.recommended` for Next.js v15 supports.
  // `nextjs.configs.recommended` for Next.js v16 support
  // See https://github.com/vercel/next.js/pull/83763 for the breaking change details
  // Drop the `flatConfig` branch once Next.js 15 is no longer supported.
  const recommendedConfig = nextjs.flatConfig
    ? nextjsAlias.flatConfig.recommended
    : nextjsAlias.configs.recommended;

  return defineConfig(
    recommendedConfig,
    {
      settings: {
        next: {
          rootDir,
        },
      },
      files: [`**/*${EXTENSION_TS}`],
      rules: {
        'compat/compat': 'off',
        'jsx-a11y/anchor-is-valid': 'off',
        'no-irregular-whitespace': ['error', { skipJSXText: true, skipStrings: true }],
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
      rules: {
        '@typescript-eslint/no-deprecated': 'error',
      },
    },
  );
}
