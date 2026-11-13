import reactHooksPlugin from 'eslint-plugin-react-hooks';

import { fixupConfigs, fixupPlugin } from './fixup.mjs';

/** eslint-plugin-react-hooks, for ESLint and oxlint's `jsPlugins`.
 * @type {import('eslint').ESLint.Plugin}
 */
const fixedPlugin = fixupPlugin(reactHooksPlugin);

export default fixedPlugin;

/** @type {Record<string, import('eslint').Linter.Config[]>} */
export const configs = {
  recommended: fixupConfigs(reactHooksPlugin.configs.flat.recommended),
};
