// @ts-check

/**
 * @typedef {Exclude<import('prettier').Config['overrides'], undefined>[number]} Override
 */

/**
 * Narrower print width for docs sources, so code blocks don't overflow on the docs site.
 * @type {Override[]}
 */
export const docsOverrides = [
  {
    files: [
      'docs/**/*.md',
      'docs/src/pages/**/*.{js,tsx}',
      'docs/src/app/**/*.{js,tsx}',
      'docs/data/**/*.{js,tsx}',
    ],
    options: {
      printWidth: 85,
    },
  },
];

/**
 * @type {Override}
 */
const jsonOverride = {
  files: ['**/*.json'],
  options: {
    trailingComma: 'none',
  },
};

/**
 * @param {Object} [options={}]
 * @param {Override[]} [options.overrides]
 * @returns {import('prettier').Config}
 */
export function createBaseConfig(options = {}) {
  return {
    overrides: [jsonOverride, ...(options.overrides ?? [])],
    printWidth: 100,
    singleQuote: true,
    trailingComma: 'all',
  };
}
