import { defineConfig } from 'eslint/config';

import { EXTENSION_TEST_FILE, EXTENSION_TS } from './src/eslint/extensions.mjs';
import { configs, ignores, nodeSupport } from './src/eslint/index.mjs';

export default defineConfig(
  ignores(import.meta.dirname),
  configs.recommended,
  nodeSupport(import.meta.dirname),
  {
    files: [`**/*${EXTENSION_TS}`],
    rules: {
      'compat/compat': 'off',
      'jsx-a11y/control-has-associated-label': 'off',
      'jsx-a11y/no-autofocus': 'off',
      'piplup/filename-case': 'error',
      'react/prop-types': 'off',
    },
    settings: {
      'import/resolver': {
        typescript: {
          project: ['tsconfig.json'],
        },
      },
      // React isn't installed here, so it can't be detected. The rule tests use current React.
      react: {
        version: '19.2',
      },
    },
  },
  {
    extends: [configs.test],
    files: [`**/*${EXTENSION_TEST_FILE}`],
  },
  {
    files: ['scripts/**'],
    rules: {
      // Maintenance scripts report progress on stdout.
      'no-console': 'off',
    },
  },
);
