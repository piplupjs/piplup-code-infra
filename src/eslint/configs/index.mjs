import { defineConfig } from 'eslint/config';
import prettierConfig from 'eslint-config-prettier/flat';
import * as mdx from 'eslint-plugin-mdx';
import globals from 'globals';

import { configs as compatConfigs } from '../../lint/plugins/compat.mjs';
import nPlugin from '../../lint/plugins/n.mjs';
import { EXTENSION_TS } from '../extensions.mjs';
import { createJsonConfig } from '../json-config.mjs';
import { createPackageJsonConfig } from '../package-json-config.mjs';
import { createPerfectionistConfig } from '../perfectionist/base.mjs';
import piplupPlugin from '../piplup/index.mjs';
import { baseSpecRules, createTestConfig } from '../test-config.mjs';

import { config as imports } from './imports.mjs';
import { config as javascript } from './javascript.mjs';
import { config as jsxA11y } from './jsx-a11y.mjs';
import { config as reactCompiler } from './react-compiler.mjs';
import { config as react } from './react.mjs';
import { config as typescript } from './typescript.mjs';

/**
 * Globals, the `piplup` and `n` plugins, and the settings shared by the plugins.
 * @type {import('eslint').Linter.Config[]}
 */
const base = defineConfig({
  languageOptions: {
    ecmaVersion: 7,
    globals: {
      ...globals.es2020,
      ...globals.browser,
      ...globals.node,
    },
  },
  name: 'piplup/base',
  plugins: {
    // Registered once for all files, so consumers can enable `n/*` rules without registering
    // a second, possibly different, instance of the plugin.
    n: nPlugin,
    piplup: piplupPlugin,
  },
  settings: {
    // browserslist finds the project's .browserslistrc, or its package.json "browserslist", by
    // itself.
    browserslistOpts: {
      env: 'stable',
      ignoreUnknownVersions: true,
    },
    react: {
      version: 'detect',
    },
  },
});

/**
 * Browser support: reports APIs the project's browserslist targets don't support.
 * @type {import('eslint').Linter.Config[]}
 */
const compat = defineConfig({
  extends: [compatConfigs.recommended],
  files: [`**/*${EXTENSION_TS}`],
  name: 'piplup/compat',
});

/**
 * Markdown and MDX, through eslint-plugin-mdx. Severities for the Markdown checks live in the
 * project's `.remarkrc` (see `@piplup/code-infra/remark`), not here.
 * @type {import('eslint').Linter.Config[]}
 */
const markdown = defineConfig(
  {
    ...mdx.flat,
    name: 'piplup/markdown',
    rules: {
      ...mdx.flat.rules,
      'mdx/remark': 'error',
    },
  },
  { ...mdx.flatCodeBlocks, name: 'piplup/markdown/code-blocks' },
);

/**
 * Turns off the rules that conflict with Prettier. Comes before the code configs in
 * `recommended`, so ours win where we want a rule anyway, such as `curly`.
 * @type {import('eslint').Linter.Config[]}
 */
const prettier = defineConfig({ extends: [prettierConfig], name: 'piplup/prettier' });

/** @type {import('eslint').Linter.Config[]} */
const json = createJsonConfig();
/** @type {import('eslint').Linter.Config[]} */
const packageJson = createPackageJsonConfig();
/** @type {import('eslint').Linter.Config[]} */
const perfectionist = createPerfectionistConfig();
/** @type {import('eslint').Linter.Config[]} */
const test = createTestConfig();

/**
 * The named configs. Each sets its own `files`, so it can be used on its own, and registers the
 * plugins its rules need.
 */
export const configs = {
  base,
  compat,
  imports,
  javascript,
  json,
  jsxA11y,
  markdown,
  packageJson,
  perfectionist,
  prettier,
  react,
  reactCompiler,
  /**
   * Everything except `reactCompiler`, in an order where each config's rules win over the
   * recommended configs of the configs before it.
   * @type {import('eslint').Linter.Config[]}
   */
  recommended: defineConfig(
    base,
    json,
    packageJson,
    prettier,
    markdown,
    javascript,
    imports,
    jsxA11y,
    react,
    typescript,
    compat,
    perfectionist,
  ),
  /** Relaxed rules for `*.spec.*` files. */
  spec: defineConfig({ ...baseSpecRules, name: 'piplup/spec' }),
  /** Vitest and Testing Library. Has no `files`: scope it to your test files. */
  test,
  typescript,
};
