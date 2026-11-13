// @ts-check

import { createBaseConfig as createPrettierConfig, docsOverrides } from './prettier.mjs';

export { docsOverrides };

/**
 * @typedef {Exclude<import('prettier').Config['overrides'], undefined>[number]} Override
 */

/**
 * oxfmt config that formats like the Prettier config from `@piplup/code-infra/prettier`. oxfmt
 * takes Prettier's options and overrides, so this is that config with oxfmt's extra formatting
 * features turned off: Prettier doesn't sort imports, `package.json` keys or Tailwind classes.
 * Import order is left to the `import/order` lint rule.
 *
 * @param {Object} [options={}]
 * @param {Override[]} [options.overrides] - Same as the Prettier `createBaseConfig`, e.g. `docsOverrides`.
 * @returns {import('oxfmt').OxfmtConfig}
 */
export function createOxfmtConfig(options = {}) {
  return {
    .../** @type {import('oxfmt').OxfmtConfig} */ (createPrettierConfig(options)),
    sortImports: false,
    sortPackageJson: false,
    sortTailwindcss: false,
  };
}
