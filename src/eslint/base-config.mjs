import fs from 'node:fs';
import * as path from 'node:path';

import { includeIgnoreFile } from '@eslint/compat';
import eslintJs from '@eslint/js';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier/flat';
import * as mdx from 'eslint-plugin-mdx';
import globals from 'globals';
import * as tseslint from 'typescript-eslint';

import { configs as compatConfigs } from '../lint/plugins/compat.mjs';
import { configs as importConfigs } from '../lint/plugins/import.mjs';
import { configs as jsxA11yConfigs } from '../lint/plugins/jsx-a11y.mjs';
import nPlugin from '../lint/plugins/n.mjs';
import { configs as reactCompilerConfigs } from '../lint/plugins/react-compiler.mjs';
import { configs as reactHooksConfigs } from '../lint/plugins/react-hooks.mjs';
import { configs as reactConfigs } from '../lint/plugins/react.mjs';

import { EXTENSION_TS } from './extensions.mjs';
import { createJsonConfig } from './json-config.mjs';
import { createNodeSupportConfig } from './node-support-config.mjs';
import { createPackageJsonConfig } from './package-json-config.mjs';
import { createPerfectionistConfig } from './perfectionist/base.mjs';
import { createCoreConfig } from './piplup/config.mjs';
import piplupPlugin from './piplup/index.mjs';

/**
 * @param {string} filePath
 * @param {string | undefined} description
 */
function includeIgnoreIfExists(filePath, description) {
  if (fs.existsSync(filePath)) {
    return includeIgnoreFile(filePath, description);
  }
  return [];
}

/**
 * @param {Object} [params]
 * @param {boolean} [params.enableReactCompiler] - Whether to enable React Compiler.
 * @param {boolean} [params.consistentTypeImports] - Whether to enforce consistent type imports. Defaults to `true`.
 * @param {string} [params.baseDirectory] - The base directory for the configuration.
 * @param {boolean} [params.markdown] - Whether to lint Markdown and MDX files. Defaults to `true`.
 * @returns {import('eslint').Linter.Config[]}
 */
export function createBaseConfig({
  baseDirectory = process.cwd(),
  consistentTypeImports = true,
  enableReactCompiler = false,
  markdown = true,
} = {}) {
  const browserslistrcPath = path.join(baseDirectory, '.browserslistrc');

  return defineConfig([
    {
      languageOptions: {
        ecmaVersion: 7,
        globals: {
          ...globals.es2020,
          ...globals.browser,
          ...globals.node,
        },
      },
      name: 'settings',
      plugins: {
        // Registered once for all files, so consumers can enable `n/*` rules without registering
        // a second, possibly different, instance of the plugin.
        n: nPlugin,
        piplup: piplupPlugin,
      },
      settings: {
        browserslistOpts: {
          // Fall back to browserslist's own config lookup when the project has no .browserslistrc.
          config: fs.existsSync(browserslistrcPath) ? browserslistrcPath : undefined,
          env: 'stable',
          ignoreUnknownVersions: true,
        },
        react: {
          version: 'detect',
        },
      },
    },
    includeIgnoreIfExists(path.join(baseDirectory, '.gitignore'), `Ignore rules from .gitignore`),
    includeIgnoreIfExists(path.join(baseDirectory, '.lintignore'), `Ignore rules from .lintignore`),
    createJsonConfig(),
    createNodeSupportConfig(baseDirectory),
    createPackageJsonConfig(),
    prettier,
    // Markdown + MDX linting via eslint-plugin-mdx. Severities for markdown
    // quality checks live in the project's `.remarkrc` (see
    // `@piplup/code-infra/remark`), not here.
    markdown
      ? [
          {
            ...mdx.flat,
            rules: {
              ...mdx.flat.rules,
              'mdx/remark': 'error',
            },
          },
          mdx.flatCodeBlocks,
        ]
      : [],
    {
      extends: defineConfig([
        eslintJs.configs.recommended,
        importConfigs.recommended,
        importConfigs.react,
        jsxA11yConfigs.recommended,
        reactConfigs.recommended,
        reactHooksConfigs.recommended,
        tseslint.configs.recommended,
        importConfigs.typescript,
        enableReactCompiler ? reactCompilerConfigs.recommended : {},
        compatConfigs.recommended,
        {
          extends: createCoreConfig({ consistentTypeImports, enableReactCompiler }),
          name: 'core',
        },
        // Disallow TypeScript namespaces: they can produce non-portable declaration types and break
        // some bundlers, and tooling support for them is poor. Treat them as deprecated.
        {
          rules: {
            '@typescript-eslint/no-namespace': 'error',
          },
        },
        // Part of the migration away from airbnb config. Turned off initially.
        {
          rules: {
            '@typescript-eslint/no-empty-object-type': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unsafe-function-type': 'off',
          },
        },
        // New ESLint 10 rules - turned off initially to ease migration
        {
          name: 'ESLint 10 new rules',
          rules: {
            // Disallows unused vars without explicit init (use @typescript-eslint/no-unused-vars instead)
            'no-unassigned-vars': 'off',
            // Disallows assignments that are never used
            'no-useless-assignment': 'off',
            // Requires attaching caught errors as `cause` when re-throwing
            'preserve-caught-error': 'off',
          },
        },
        // @TODO: Remove this once @typescript-eslint/no-shadow supports wrapped functions
        //   See https://github.com/eslint/eslint/pull/20982 (once merged also needs port to `typescript-eslint`)
        {
          name: 'Disabled tseslint-plugins',
          rules: {
            '@typescript-eslint/no-shadow': 'off',
          },
        },
      ]),
      files: [`**/*${EXTENSION_TS}`],
      name: 'Base config',
    },
    createPerfectionistConfig(),
    {
      files: ['**/*.mjs'],
      name: 'ESM JS files',
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
  ]);
}
