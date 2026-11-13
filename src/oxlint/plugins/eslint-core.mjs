import { builtinRules } from 'eslint/use-at-your-own-risk';

import { withEslintDirectives } from './with-eslint-directives.mjs';

/**
 * ESLint's core rules as a plugin, so oxlint can load the ones it doesn't implement. oxlint runs
 * it as `eslint-js`.
 */
export default withEslintDirectives(
  { meta: { name: 'eslint-core' }, rules: Object.fromEntries(builtinRules) },
  '',
);
