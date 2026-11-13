import reactCompilerPlugin from 'eslint-plugin-react-compiler';

import { fixupConfigs, fixupPlugin } from './fixup.mjs';

/** eslint-plugin-react-compiler, for ESLint and oxlint's `jsPlugins`.
 * @type {import('eslint').ESLint.Plugin}
 */
const fixedPlugin = fixupPlugin(reactCompilerPlugin);

export default fixedPlugin;

/** @type {Record<string, import('eslint').Linter.Config[]>} */
export const configs = {
  recommended: fixupConfigs(reactCompilerPlugin.configs.recommended),
};
