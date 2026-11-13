import importPlugin from 'eslint-plugin-import';

import { fixupConfigs, fixupPlugin } from './fixup.mjs';

/** eslint-plugin-import, for ESLint and oxlint's `jsPlugins`.
 * @type {import('eslint').ESLint.Plugin}
 */
const fixedPlugin = fixupPlugin(importPlugin);

export default fixedPlugin;

/** @type {Record<string, import('eslint').Linter.Config[]>} */
export const configs = {
  recommended: fixupConfigs(importPlugin.flatConfigs.recommended),
  react: fixupConfigs(importPlugin.flatConfigs.react),
  typescript: fixupConfigs(importPlugin.flatConfigs.typescript),
};
