// @ts-check

import { config as piplupConfig } from './prettier.mjs';

/**
 * An oxfmt config that formats like a Prettier config: by default the one from
 * `@piplup/code-infra/prettier`, or your own, so your changes carry over:
 *
 * ```ts
 * import prettierConfig from './prettier.config.mjs';
 *
 * export default createOxfmtConfig(prettierConfig);
 * ```
 *
 * oxfmt takes Prettier's options and overrides, so this is that config with oxfmt's extra
 * formatting features turned off: Prettier doesn't sort imports, `package.json` keys or Tailwind
 * classes. Import order is left to the `import/order` lint rule. Prettier `plugins` are left out,
 * since oxfmt can't load them.
 *
 * @param {import('prettier').Config} [prettierConfig] - Defaults to the config from
 * `@piplup/code-infra/prettier`.
 * @returns {import('oxfmt').OxfmtConfig}
 */
export function createOxfmtConfig(prettierConfig = piplupConfig) {
  const { plugins, ...options } = prettierConfig;
  return {
    .../** @type {import('oxfmt').OxfmtConfig} */ (options),
    sortImports: false,
    sortPackageJson: false,
    sortTailwindcss: false,
  };
}
