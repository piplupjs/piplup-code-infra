import reactPlugin from 'eslint-plugin-react';

import { fixupConfigs, fixupPlugin } from './fixup.mjs';

/** eslint-plugin-react, for ESLint and oxlint's `jsPlugins`.
 * @type {import('eslint').ESLint.Plugin}
 */
const fixedPlugin = fixupPlugin(reactPlugin);

export default fixedPlugin;

/** @type {Record<string, import('eslint').Linter.Config[]>} */
export const configs = {
  recommended: fixupConfigs(reactPlugin.configs.flat.recommended),
};
