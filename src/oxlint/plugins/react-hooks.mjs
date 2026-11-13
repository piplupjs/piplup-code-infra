import plugin from '../../plugins/react-hooks.mjs';

import { withEslintDirectives } from './with-eslint-directives.mjs';

/** eslint-plugin-react-hooks for oxlint, which runs it as `react-hooks-js`.
 * @type {import('eslint').ESLint.Plugin}
 */
const wrapped = withEslintDirectives(plugin, 'react-hooks');

export default wrapped;
