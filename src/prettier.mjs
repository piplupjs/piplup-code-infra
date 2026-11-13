// @ts-check

/**
 * @typedef {Exclude<import('prettier').Config['overrides'], undefined>[number]} Override
 */

/**
 * Narrower print width for docs sources, so code blocks don't overflow on the docs site. Add them
 * to the config's `overrides`.
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
 * The Prettier config. Use it as it is, or spread it into your own:
 *
 * ```js
 * export default { ...config, overrides: [...config.overrides, ...docsOverrides] };
 * ```
 * @type {import('prettier').Config & { overrides: Override[] }}
 */
export const config = {
  overrides: [
    {
      files: ['**/*.json'],
      options: {
        trailingComma: 'none',
      },
    },
  ],
  printWidth: 100,
  singleQuote: true,
  trailingComma: 'all',
};

export default config;
