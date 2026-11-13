import fs from 'node:fs';
import * as path from 'node:path';

import { includeIgnoreFile } from '@eslint/compat';
import eslintJs from '@eslint/js';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier/flat';
import * as mdx from 'eslint-plugin-mdx';
import globals from 'globals';
import * as tseslint from 'typescript-eslint';

import { configs as compatConfigs } from '../plugins/compat.mjs';
import { configs as importConfigs } from '../plugins/import.mjs';
import { configs as jsxA11yConfigs } from '../plugins/jsx-a11y.mjs';
import nPlugin from '../plugins/n.mjs';
import { configs as reactCompilerConfigs } from '../plugins/react-compiler.mjs';
import { configs as reactHooksConfigs } from '../plugins/react-hooks.mjs';
import { configs as reactConfigs } from '../plugins/react.mjs';

import { EXTENSION_TS } from './extensions.mjs';
import { createJsonConfig } from './json-config.mjs';
import { createNodeSupportConfig } from './node-support-config.mjs';
import { createPackageJsonConfig } from './package-json-config.mjs';
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
  enableReactCompiler = false,
  consistentTypeImports = true,
  markdown = true,
  baseDirectory = process.cwd(),
} = {}) {
  const browserslistrcPath = path.join(baseDirectory, '.browserslistrc');

  return defineConfig([
    {
      name: 'settings',
      languageOptions: {
        ecmaVersion: 7,
        globals: {
          ...globals.es2020,
          ...globals.browser,
          ...globals.node,
        },
      },
      plugins: {
        piplup: piplupPlugin,
        // Registered once for all files, so consumers can enable `n/*` rules without registering
        // a second, possibly different, instance of the plugin.
        n: nPlugin,
      },
      settings: {
        react: {
          version: 'detect',
        },
        browserslistOpts: {
          // Fall back to browserslist's own config lookup when the project has no .browserslistrc.
          config: fs.existsSync(browserslistrcPath) ? browserslistrcPath : undefined,
          env: 'stable',
          ignoreUnknownVersions: true,
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
      name: 'Base config',
      files: [`**/*${EXTENSION_TS}`],
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
          name: 'core',
          extends: createCoreConfig({ enableReactCompiler, consistentTypeImports }),
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
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unsafe-function-type': 'off',
            '@typescript-eslint/no-empty-object-type': 'off',
          },
        },
        // New ESLint 10 rules - turned off initially to ease migration
        {
          name: 'ESLint 10 new rules',
          rules: {
            // Requires attaching caught errors as `cause` when re-throwing
            'preserve-caught-error': 'off',
            // Disallows assignments that are never used
            'no-useless-assignment': 'off',
            // Disallows unused vars without explicit init (use @typescript-eslint/no-unused-vars instead)
            'no-unassigned-vars': 'off',
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
    },
    {
      name: 'ESM JS files',
      files: ['**/*.mjs'],
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
