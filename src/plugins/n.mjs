import nPlugin from 'eslint-plugin-n';

import { fixupPlugin } from './fixup.mjs';

/** eslint-plugin-n, for ESLint and oxlint's `jsPlugins`.
 * @type {import('eslint').ESLint.Plugin}
 */
const fixedPlugin = fixupPlugin(nPlugin);

export default fixedPlugin;
