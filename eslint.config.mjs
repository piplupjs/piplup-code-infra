import { defineConfig } from 'eslint/config';

import { createBaseConfig } from './src/eslint/base-config.mjs';
import { EXTENSION_TEST_FILE, EXTENSION_TS } from './src/eslint/extensions.mjs';
import { createTestConfig } from './src/eslint/test-config.mjs';

export default defineConfig(
  createBaseConfig({ baseDirectory: import.meta.dirname }),
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
    },
  },
  {
    extends: createTestConfig(),
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
