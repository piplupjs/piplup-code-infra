import compatPlugin from 'eslint-plugin-compat';

import { fixupConfigs, fixupPlugin } from './fixup.mjs';

/** eslint-plugin-compat, for ESLint and oxlint's `jsPlugins`.
 * @type {import('eslint').ESLint.Plugin}
 */
const fixedPlugin = fixupPlugin(compatPlugin);

export default fixedPlugin;

/** @type {Record<string, import('eslint').Linter.Config[]>} */
export const configs = {
  recommended: fixupConfigs(compatPlugin.configs['flat/recommended']),
};
