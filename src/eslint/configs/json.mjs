import json from '@eslint/json';
import { defineConfig } from 'eslint/config';

/**
 * JSON, JSONC and JSON5 files, through @eslint/json. package.json files have their own config.
 * @type {import('eslint').Linter.Config[]}
 */
export const config = defineConfig([
  {
    extends: [json.configs.recommended],
    files: ['**/*.json'],
    // package.json is linted by eslint-plugin-package-json, whose rules need the jsonc-eslint-parser AST.
    ignores: ['package-lock.json', '**/package.json'],
    language: 'json/json',
    name: 'piplup/json',
    plugins: { json },
  },

  {
    extends: [json.configs.recommended],
    files: [
      '**/*.jsonc',
      '**/tsconfig.json',
      '**/tsconfig.*.json',
      '.vscode/**/*.json',
      'renovate.json',
    ],
    language: 'json/jsonc',
    name: 'piplup/jsonc',
    plugins: { json },
  },

  {
    extends: [json.configs.recommended],
    files: ['**/*.json5'],
    language: 'json/json5',
    name: 'piplup/json5',
    plugins: { json },
  },
]);
