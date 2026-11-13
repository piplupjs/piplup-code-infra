import { defineConfig } from 'eslint/config';

import { configs as nextConfigs } from '../lint/plugins/next.mjs';

import { adjustedPlugins, languageOptions } from './configs/shared.mjs';
import { EXTENSION_TS } from './extensions.mjs';

/**
 * Configs for a Next.js docs app. Exported from `@piplup/code-infra/eslint/docs` rather than
 * `@piplup/code-infra/eslint`, so projects without `@next/eslint-plugin-next` can load the others.
 */
export const configs = {
  /**
   * The Next.js rules, and type-aware checks of the docs code. Expects the Next.js app in `docs`;
   * set `settings.next.rootDir` to change that.
   * @type {import('eslint').Linter.Config[]}
   */
  docs: defineConfig(
    // Not limited to code files: the Next.js rules also check the code in MDX pages.
    { extends: [nextConfigs.recommended], name: 'piplup/docs/next' },
    {
      files: [`**/*${EXTENSION_TS}`],
      name: 'piplup/docs',
      plugins: adjustedPlugins,
      rules: {
        'compat/compat': 'off',
        'jsx-a11y/anchor-is-valid': 'off',
        'no-irregular-whitespace': ['error', { skipJSXText: true, skipStrings: true }],
      },
      settings: {
        next: {
          rootDir: 'docs',
        },
      },
    },
    {
      // Build configuration and maintenance scripts aren't documentation examples
      // and are often intentionally outside the docs TypeScript project.
      files: [`**/*${EXTENSION_TS}`],
      ignores: ['**/*.config.*', '**/scripts/**'],
      languageOptions: {
        ...languageOptions,
        parserOptions: {
          projectService: true,
          tsconfigRootDir: process.cwd(),
        },
      },
      name: 'piplup/docs/type-aware',
      plugins: adjustedPlugins,
      rules: {
        '@typescript-eslint/no-deprecated': 'error',
      },
    },
  ),
};
