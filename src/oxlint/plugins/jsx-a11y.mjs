import plugin from '../../lint/plugins/jsx-a11y.mjs';

import { withEslintDirectives } from './with-eslint-directives.mjs';

/** eslint-plugin-jsx-a11y for oxlint, which runs it as `jsx-a11y-js`.
 * @type {import('eslint').ESLint.Plugin}
 */
const wrapped = withEslintDirectives(plugin, 'jsx-a11y');

export default wrapped;
