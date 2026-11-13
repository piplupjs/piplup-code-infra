import perfectionistPlugin from 'eslint-plugin-perfectionist';

import { fixupPlugin } from './fixup.mjs';

/**
 * eslint-plugin-perfectionist, for ESLint and oxlint's `jsPlugins`.
 * @type {import('eslint').ESLint.Plugin}
 */
const fixedPlugin = fixupPlugin(perfectionistPlugin);

export default fixedPlugin;
