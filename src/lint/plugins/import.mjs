import importPlugin from 'eslint-plugin-import';

import { fixupConfigs, fixupPlugin } from './fixup.mjs';

/** eslint-plugin-import, for ESLint and oxlint's `jsPlugins`.
 * @type {import('eslint').ESLint.Plugin}
 */
const fixedPlugin = fixupPlugin(importPlugin);

export default fixedPlugin;

/** @type {Record<string, import('eslint').Linter.Config[]>} */
export const configs = {
  react: fixupConfigs(importPlugin.flatConfigs.react),
  recommended: fixupConfigs(importPlugin.flatConfigs.recommended),
  typescript: fixupConfigs(importPlugin.flatConfigs.typescript),
};
