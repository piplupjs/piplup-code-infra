import vitestPlugin from '@vitest/eslint-plugin';

import { fixupConfigs, fixupPlugin } from './fixup.mjs';

/** @vitest/eslint-plugin, for ESLint and oxlint's `jsPlugins`.
 * @type {import('eslint').ESLint.Plugin}
 */
const fixedPlugin = fixupPlugin(vitestPlugin);

export default fixedPlugin;

/** @type {Record<string, import('eslint').Linter.Config[]>} */
export const configs = {
  recommended: fixupConfigs(vitestPlugin.configs.recommended),
};
