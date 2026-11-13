import testingLibraryPlugin from 'eslint-plugin-testing-library';

import { fixupConfigs, fixupPlugin } from './fixup.mjs';

/** eslint-plugin-testing-library, for ESLint and oxlint's `jsPlugins`.
 * @type {import('eslint').ESLint.Plugin}
 */
const fixedPlugin = fixupPlugin(testingLibraryPlugin);

export default fixedPlugin;

/** @type {Record<string, import('eslint').Linter.Config[]>} */
export const configs = {
  dom: fixupConfigs(testingLibraryPlugin.configs['flat/dom']),
  react: fixupConfigs(testingLibraryPlugin.configs['flat/react']),
};
