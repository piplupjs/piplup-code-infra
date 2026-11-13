import plugin from '../../lint/plugins/vitest.mjs';

import { withEslintDirectives } from './with-eslint-directives.mjs';

/** @vitest/eslint-plugin for oxlint, which runs it as `vitest-js`.
 * @type {import('eslint').ESLint.Plugin}
 */
const wrapped = withEslintDirectives(plugin, 'vitest');

export default wrapped;
