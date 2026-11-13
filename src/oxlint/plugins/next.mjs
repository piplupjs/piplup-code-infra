import plugin from '../../lint/plugins/next.mjs';

import { withEslintDirectives } from './with-eslint-directives.mjs';

/** @next/eslint-plugin-next for oxlint, which runs it as `next-js`.
 * @type {import('eslint').ESLint.Plugin}
 */
const wrapped = withEslintDirectives(plugin, '@next/next');

export default wrapped;
