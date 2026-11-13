import plugin from '../../lint/plugins/react.mjs';

import { withEslintDirectives } from './with-eslint-directives.mjs';

/** eslint-plugin-react for oxlint, which runs it as `react-js`.
 * @type {import('eslint').ESLint.Plugin}
 */
const wrapped = withEslintDirectives(plugin, 'react');

export default wrapped;
