import plugin from '../../plugins/import.mjs';

import { withEslintDirectives } from './with-eslint-directives.mjs';

/** eslint-plugin-import for oxlint, which runs it as `import-js`.
 * @type {import('eslint').ESLint.Plugin}
 */
const wrapped = withEslintDirectives(plugin, 'import');

export default wrapped;
