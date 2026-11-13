import { fileURLToPath } from 'node:url';

import * as postcssStyledSyntax from 'postcss-styled-syntax';

/** @type {import('stylelint').Config} */
export default {
  // Extend by resolved path so stylelint resolves the preset's own `extends` from its install
  // location. Spreading the imported object breaks under pnpm's strict node_modules layout.
  extends: fileURLToPath(import.meta.resolve('stylelint-config-standard')),
  overrides: [
    {
      customSyntax: postcssStyledSyntax,
      files: ['**/*.?(c|m)[jt]s?(x)'],
    },
  ],
  rules: {
    'alpha-value-notation': null,

    // Responsibility of prettier:
    'at-rule-empty-line-before': null,
    // Tailwind
    'at-rule-no-unknown': [true, { ignoreAtRules: ['theme', 'config'] }],
    // Responsibility of a minifier
    'color-hex-length': null,
    'comment-empty-line-before': null,
    'custom-property-empty-line-before': null,
    'custom-property-pattern': null,
    'declaration-block-no-redundant-longhand-properties': null,
    'declaration-empty-line-before': null,

    'declaration-property-value-keyword-no-deprecated': null,
    'import-notation': null,
    'media-feature-range-notation': null,
    // Too opinionated?
    'no-descending-specificity': null,
    'no-empty-source': null,

    'property-no-deprecated': null,

    // Don't assume we use a preprocessor
    'property-no-vendor-prefix': null,
    'rule-empty-line-before': null,
    'selector-class-pattern': null,

    'string-no-newline': null, // not compatible with prettier
    'value-keyword-case': null,
  },
};
