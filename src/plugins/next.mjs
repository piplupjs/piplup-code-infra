import nextPlugin from '@next/eslint-plugin-next';

import { fixupConfigs, fixupPlugin } from './fixup.mjs';

/** @type {any} */
const plugin = nextPlugin;

/**
 * @next/eslint-plugin-next, for ESLint and oxlint's `jsPlugins`. An optional peer dependency, so
 * only the docs config imports this module.
 * @type {import('eslint').ESLint.Plugin}
 */
const fixedPlugin = fixupPlugin(plugin);

export default fixedPlugin;

/** @type {Record<string, import('eslint').Linter.Config[]>} */
export const configs = {
  // Next.js 15 has `flatConfig.recommended`, Next.js 16 `configs.recommended`
  // (https://github.com/vercel/next.js/pull/83763). Drop `flatConfig` with Next.js 15 support.
  recommended: fixupConfigs(
    plugin.flatConfig ? plugin.flatConfig.recommended : plugin.configs.recommended,
  ),
};
