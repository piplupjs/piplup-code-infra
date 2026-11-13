import * as tseslint from 'typescript-eslint';

import { configs as compatConfigs } from '../../lint/plugins/compat.mjs';
import { configs as importConfigs } from '../../lint/plugins/import.mjs';
import { configs as jsxA11yConfigs } from '../../lint/plugins/jsx-a11y.mjs';
import { configs as reactConfigs } from '../../lint/plugins/react.mjs';
import piplupPlugin from '../piplup/index.mjs';

/**
 * typescript-eslint's parser, which parses JavaScript too. Every config for code sets it, so each
 * can lint TypeScript on its own.
 * @type {import('eslint').Linter.LanguageOptions}
 */
export const languageOptions = { parser: tseslint.parser };

/**
 * The plugin a plugin's recommended config registers. Some plugins register a different object
 * there than their default export, and ESLint won't take two objects under one name.
 * @param {import('eslint').Linter.Config[]} configs
 * @param {string} name
 * @returns {import('eslint').ESLint.Plugin}
 */
function registeredPlugin(configs, name) {
  const plugin = configs.find((config) => config.plugins?.[name])?.plugins?.[name];
  if (!plugin) {
    throw new Error(`No config registers the ${name} plugin.`);
  }
  return plugin;
}

/**
 * The plugins whose rules the test, spec and docs configs adjust. ESLint rejects a rule, even one
 * turned off, from a plugin it can't find, so those configs register them. They're the objects the
 * other configs register, so registering them again doesn't conflict.
 * @type {Record<string, import('eslint').ESLint.Plugin>}
 */
export const adjustedPlugins = {
  '@typescript-eslint': /** @type {import('eslint').ESLint.Plugin} */ (tseslint.plugin),
  compat: registeredPlugin(compatConfigs.recommended, 'compat'),
  import: registeredPlugin(importConfigs.recommended, 'import'),
  'jsx-a11y': registeredPlugin(jsxA11yConfigs.recommended, 'jsx-a11y'),
  piplup: piplupPlugin,
  react: registeredPlugin(reactConfigs.recommended, 'react'),
};
