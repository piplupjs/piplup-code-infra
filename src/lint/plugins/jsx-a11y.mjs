import jsxA11yPlugin from 'eslint-plugin-jsx-a11y';

import { fixupConfigs, fixupPlugin } from './fixup.mjs';

/** eslint-plugin-jsx-a11y, for ESLint and oxlint's `jsPlugins`.
 * @type {import('eslint').ESLint.Plugin}
 */
const fixedPlugin = fixupPlugin(jsxA11yPlugin);

export default fixedPlugin;

/** @type {Record<string, import('eslint').Linter.Config[]>} */
export const configs = {
  recommended: fixupConfigs(jsxA11yPlugin.flatConfigs.recommended),
};
