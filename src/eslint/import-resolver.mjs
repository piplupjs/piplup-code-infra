import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/**
 * The path of eslint-import-resolver-typescript, for `import/resolver`. eslint-plugin-import
 * loads a resolver by name from its own folder, so the name only works where the package manager
 * puts the resolver next to the plugin, which npm doesn't always do.
 */
export const TYPESCRIPT_RESOLVER = require.resolve('eslint-import-resolver-typescript');
