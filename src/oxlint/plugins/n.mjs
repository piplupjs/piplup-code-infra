import plugin from '../../lint/plugins/n.mjs';

import { withEslintDirectives } from './with-eslint-directives.mjs';

/** eslint-plugin-n for oxlint, which runs it as `node-js`.
 * @type {import('eslint').ESLint.Plugin}
 */
const wrapped = withEslintDirectives(plugin, 'n');

export default wrapped;
