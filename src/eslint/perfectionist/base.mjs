import { defineConfig } from 'eslint/config';

import perfectionistPlugin from '../../lint/plugins/perfectionist.mjs';
import { EXTENSION_JS, EXTENSION_TS } from '../extensions.mjs';

/**
 * @returns {import('eslint').Linter.Config[]}
 */
export function createPerfectionistConfig() {
  return defineConfig([
    {
      files: [`**/*${EXTENSION_TS}`, `**/*${EXTENSION_JS}`],
      languageOptions: {
        parserOptions: {
          ecmaFeatures: {
            jsx: true,
          },
        },
      },
      name: 'perfectionist',
      plugins: {
        perfectionist: perfectionistPlugin,
      },
      rules: {
        'perfectionist/sort-array-includes': [
          'error',
          {
            // Literals first. Spread elements split the array into separately sorted parts.
            groups: ['literal'],
            ignoreCase: true,
            order: 'asc',
            type: 'alphabetical',
          },
        ],
        'perfectionist/sort-enums': [
          'error',
          {
            order: 'asc',
            type: 'natural',
          },
        ],
        'perfectionist/sort-exports': [
          'error',
          {
            order: 'asc',
            type: 'natural',
          },
        ],
        'perfectionist/sort-interfaces': [
          'error',
          {
            order: 'asc',
            type: 'natural',
          },
        ],
        'perfectionist/sort-jsx-props': [
          'error',
          {
            groups: ['multiline-prop', 'unknown', 'shorthand-prop'],
            order: 'asc',
            type: 'natural',
          },
        ],
        'perfectionist/sort-maps': [
          'error',
          {
            order: 'asc',
            type: 'natural',
          },
        ],
        'perfectionist/sort-named-exports': [
          'error',
          {
            order: 'asc',
            type: 'natural',
          },
        ],
        'perfectionist/sort-object-types': [
          'error',
          {
            customGroups: [],
            groups: [],
            ignoreCase: true,
            order: 'asc',
            partitionByNewLine: false,
            type: 'alphabetical',
          },
        ],
        'perfectionist/sort-objects': [
          'error',
          {
            ignoreCase: true,
            order: 'asc',
            partitionByComment: false,
            partitionByNewLine: false,
            styledComponents: true,
            type: 'alphabetical',
          },
        ],
        'perfectionist/sort-union-types': [
          'error',
          {
            order: 'asc',
            type: 'natural',
          },
        ],
      },
    },
  ]);
}
