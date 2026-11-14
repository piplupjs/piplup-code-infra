import { defineConfig } from 'eslint/config';
import prettierConfig from 'eslint-config-prettier/flat';
import globals from 'globals';

import { configs as compatConfigs } from '../../lint/plugins/compat.mjs';
import nPlugin from '../../lint/plugins/n.mjs';
import { EXTENSION_TS } from '../extensions.mjs';
import piplupPlugin from '../piplup/index.mjs';

import { config as imports } from './imports.mjs';
import { config as javascript } from './javascript.mjs';
import { config as json } from './json.mjs';
import { config as jsxA11y } from './jsx-a11y.mjs';
import { config as markdown } from './markdown.mjs';
import { config as packageJson } from './package-json.mjs';
import { config as perfectionist } from './perfectionist.mjs';
import { config as reactCompiler } from './react-compiler.mjs';
import { config as react } from './react.mjs';
import { languageOptions } from './shared.mjs';
import { specConfig as spec, config as test } from './test.mjs';
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
  languageOptions,
  name: 'piplup/compat',
});

/**
 * Turns off the rules that conflict with Prettier. Comes before the code configs in
 * `recommended`, so ours win where we want a rule anyway, such as `curly`.
 * @type {import('eslint').Linter.Config[]}
 */
const prettier = defineConfig({ extends: [prettierConfig], name: 'piplup/prettier' });

/**
 * One config object that registers, for every file, the plugins the given configs register for
 * some files. A config object of the project's own without `files` can then set those plugins'
 * rules, which ESLint otherwise rejects for files no config registered the plugin for, such as
 * JSON. The wrapped plugins' rules do nothing outside JavaScript.
 * @param {string} name
 * @param {import('eslint').Linter.Config[]} list
 * @returns {import('eslint').Linter.Config}
 */
function allPlugins(name, list) {
  /** @type {Record<string, import('eslint').ESLint.Plugin>} */
  const plugins = {};
  for (const config of list) {
    for (const [key, plugin] of Object.entries(config.plugins ?? {})) {
      if (plugins[key] && plugins[key] !== plugin) {
        throw new Error(`Two configs register different "${key}" plugins.`);
      }
      plugins[key] = plugin;
    }
  }
  return { name, plugins };
}

const recommendedConfigs = defineConfig(
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
);

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
   * recommended configs of the configs before it. Its plugins are registered for every file, so
   * the project's own rules can set them without `files`.
   * @type {import('eslint').Linter.Config[]}
   */
  recommended: defineConfig(
    allPlugins('piplup/recommended/plugins', recommendedConfigs),
    recommendedConfigs,
  ),
  spec,
  test,
  typescript,
};
